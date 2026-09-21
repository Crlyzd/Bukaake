// Bukaake — High Performance Image Viewer
// Pure Rust Zero-Dependency EBML WebM Duration Patcher (< 300 lines per Pillar 5)
//
// Injects or updates the container-level Segment Info Duration (0x4489)
// in WebM recordings produced by Chromium MediaRecorder so that media players
// (Windows Media Player, web browsers, Discord) display accurate durations and seekbars.

use std::fs::{self, File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::Path;

const EBML_HEADER_ID: u32 = 0x1A45DFA3;
const SEGMENT_ID: u32 = 0x18538067;
const INFO_ID: u32 = 0x1549A966;
const DURATION_ID: u32 = 0x4489;

/// Reads an EBML Element ID from the slice at `pos`.
/// Returns (element_id, total_id_bytes_consumed).
fn read_ebml_id(buf: &[u8], pos: usize) -> Option<(u32, usize)> {
    if pos >= buf.len() {
        return None;
    }
    let first = buf[pos];
    let (num_bytes, _) = get_vint_length(first)?;
    if pos + num_bytes > buf.len() || num_bytes > 4 {
        return None;
    }
    let mut id = 0u32;
    for i in 0..num_bytes {
        id = (id << 8) | (buf[pos + i] as u32);
    }
    Some((id, num_bytes))
}

/// Reads a variable-length integer (VINT) representing an element's data size.
/// Returns (size_value, is_unknown_size, vint_bytes_consumed).
fn read_vint_size(buf: &[u8], pos: usize) -> Option<(u64, bool, usize)> {
    if pos >= buf.len() {
        return None;
    }
    let first = buf[pos];
    let (num_bytes, mask) = get_vint_length(first)?;
    if pos + num_bytes > buf.len() || num_bytes > 8 {
        return None;
    }
    let mut val = (first & mask) as u64;
    let mut all_ones = (first & mask) == mask;
    for i in 1..num_bytes {
        let b = buf[pos + i];
        val = (val << 8) | (b as u64);
        if b != 0xFF {
            all_ones = false;
        }
    }
    Some((val, all_ones, num_bytes))
}

fn get_vint_length(first_byte: u8) -> Option<(usize, u8)> {
    if first_byte & 0x80 != 0 {
        Some((1, 0x7F))
    } else if first_byte & 0x40 != 0 {
        Some((2, 0x3F))
    } else if first_byte & 0x20 != 0 {
        Some((3, 0x1F))
    } else if first_byte & 0x10 != 0 {
        Some((4, 0x0F))
    } else if first_byte & 0x08 != 0 {
        Some((5, 0x07))
    } else if first_byte & 0x04 != 0 {
        Some((6, 0x03))
    } else if first_byte & 0x02 != 0 {
        Some((7, 0x01))
    } else if first_byte & 0x01 != 0 {
        Some((8, 0x00))
    } else {
        None
    }
}

/// Encodes a value as an EBML VINT with the exact given byte length.
fn encode_vint(val: u64, num_bytes: usize) -> Option<Vec<u8>> {
    if num_bytes < 1 || num_bytes > 8 {
        return None;
    }
    let marker = 1u64 << (7 * num_bytes);
    let encoded = marker | val;
    let mut bytes = Vec::with_capacity(num_bytes);
    for i in (0..num_bytes).rev() {
        bytes.push(((encoded >> (i * 8)) & 0xFF) as u8);
    }
    Some(bytes)
}

/// Patches the WebM recording at `temp_path` with `duration_ms` and saves to `dest_path`.
pub fn patch_webm_duration(temp_path: &Path, dest_path: &Path, duration_ms: f64) -> Result<(), String> {
    if duration_ms <= 0.0 {
        return fallback_save(temp_path, dest_path);
    }

    let mut file = OpenOptions::new()
        .read(true)
        .write(true)
        .open(temp_path)
        .map_err(|e| format!("Failed to open temp recording: {}", e))?;

    // Read up to 8KB header where EBML, Segment, and Info reside
    let mut header = vec![0u8; 8192];
    let bytes_read = file.read(&mut header).map_err(|e| e.to_string())?;
    header.truncate(bytes_read);

    let (_ebml_id, ebml_id_len) = match read_ebml_id(&header, 0) {
        Some(res) if res.0 == EBML_HEADER_ID => res,
        _ => return fallback_save(temp_path, dest_path),
    };

    let (_, _, ebml_size_len) = match read_vint_size(&header, ebml_id_len) {
        Some(res) => res,
        None => return fallback_save(temp_path, dest_path),
    };

    let mut cur = ebml_id_len + ebml_size_len;
    // Skip past EBML header element payload
    let ebml_payload_size = match read_vint_size(&header, ebml_id_len) {
        Some((s, false, _)) => s as usize,
        _ => return fallback_save(temp_path, dest_path),
    };
    cur += ebml_payload_size;

    // Locate Segment
    let (_seg_id, seg_id_len) = match read_ebml_id(&header, cur) {
        Some(res) if res.0 == SEGMENT_ID => res,
        _ => return fallback_save(temp_path, dest_path),
    };
    cur += seg_id_len;

    let (_, _, seg_size_len) = match read_vint_size(&header, cur) {
        Some(res) => res,
        None => return fallback_save(temp_path, dest_path),
    };
    cur += seg_size_len;

    // Search children inside Segment for Info element (0x1549A966)
    let mut info_offset = None;
    let mut info_vint_len = 0;
    let mut info_size = 0usize;
    let mut info_payload_start = 0usize;

    while cur + 4 < header.len() {
        let (elem_id, elem_id_len) = match read_ebml_id(&header, cur) {
            Some(res) => res,
            None => break,
        };
        let (elem_size, _, elem_size_len) = match read_vint_size(&header, cur + elem_id_len) {
            Some(res) => res,
            None => break,
        };

        if elem_id == INFO_ID {
            info_offset = Some(cur);
            info_vint_len = elem_size_len;
            info_size = elem_size as usize;
            info_payload_start = cur + elem_id_len + elem_size_len;
            break;
        }

        // Advance to next sibling element if size known
        cur += elem_id_len + elem_size_len + (elem_size as usize);
    }

    let _info_pos = match info_offset {
        Some(p) => p,
        None => return fallback_save(temp_path, dest_path),
    };

    let info_end = info_payload_start + info_size;
    if info_end > header.len() {
        return fallback_save(temp_path, dest_path);
    }

    // Inspect Info child elements for Duration (0x4489)
    let mut child_cur = info_payload_start;
    let mut duration_offset = None;
    let mut duration_len = 0usize;

    while child_cur < info_end {
        let (cid, cid_len) = match read_ebml_id(&header, child_cur) {
            Some(res) => res,
            None => break,
        };
        let (csize, _, csize_len) = match read_vint_size(&header, child_cur + cid_len) {
            Some(res) => res,
            None => break,
        };

        if cid == DURATION_ID {
            duration_offset = Some(child_cur + cid_len + csize_len);
            duration_len = csize as usize;
            break;
        }

        child_cur += cid_len + csize_len + (csize as usize);
    }

    // Path 1: Duration exists in-place -> overwrite 4 or 8 byte float
    if let Some(d_off) = duration_offset {
        file.seek(SeekFrom::Start(d_off as u64)).map_err(|e| e.to_string())?;
        if duration_len == 4 {
            file.write_all(&(duration_ms as f32).to_be_bytes()).map_err(|e| e.to_string())?;
        } else {
            file.write_all(&(duration_ms as f64).to_be_bytes()).map_err(|e| e.to_string())?;
        }
        file.flush().map_err(|e| e.to_string())?;
        drop(file);
        return fallback_save(temp_path, dest_path);
    }

    // Path 2: Duration missing -> inject 11 bytes into Info (0x4489 + 0x88 + 8 bytes float)
    let new_info_size = info_size + 11;
    let new_vint = match encode_vint(new_info_size as u64, info_vint_len) {
        Some(v) => v,
        None => return fallback_save(temp_path, dest_path),
    };

    // Construct injected duration element: Tag 0x4489, Size 0x88 (8 bytes), Value f64
    let mut injected = vec![0x44, 0x89, 0x88];
    injected.extend_from_slice(&(duration_ms as f64).to_be_bytes());

    // Write patched destination file
    let mut out = File::create(dest_path).map_err(|e| e.to_string())?;
    let vint_pos = info_payload_start - info_vint_len;

    out.write_all(&header[..vint_pos]).map_err(|e| e.to_string())?;
    out.write_all(&new_vint).map_err(|e| e.to_string())?;
    out.write_all(&header[info_payload_start..info_end]).map_err(|e| e.to_string())?;
    out.write_all(&injected).map_err(|e| e.to_string())?;

    // Stream remainder of temp file from info_end onwards
    file.seek(SeekFrom::Start(info_end as u64)).map_err(|e| e.to_string())?;
    std::io::copy(&mut file, &mut out).map_err(|e| e.to_string())?;
    out.flush().map_err(|e| e.to_string())?;

    drop(file);
    drop(out);
    let _ = fs::remove_file(temp_path);
    Ok(())
}

fn fallback_save(temp_path: &Path, dest_path: &Path) -> Result<(), String> {
    if let Err(_) = fs::rename(temp_path, dest_path) {
        fs::copy(temp_path, dest_path).map_err(|e| format!("Failed to copy recording: {}", e))?;
        let _ = fs::remove_file(temp_path);
    }
    Ok(())
}
