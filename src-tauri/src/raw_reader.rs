use std::fs::File;
use std::io::Read;
use std::path::Path;

pub const RAW_EXTS: &[&str] = &[
    "arw", "srf", "sr2", "cr2", "cr3", "nef", "nrw", "dng", "raf", "rw2", "orf", "pef", "3fr",
];

pub fn is_raw_file(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|ext| RAW_EXTS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

/// Fast embedded JPEG preview extractor for camera RAW files.
/// Locates the largest embedded JPEG stream in the RAW container.
pub fn extract_raw_preview(path: &Path) -> Option<Vec<u8>> {
    let mut file = File::open(path).ok()?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes).ok()?;

    find_largest_embedded_jpeg(&bytes)
}

fn find_largest_embedded_jpeg(bytes: &[u8]) -> Option<Vec<u8>> {
    if bytes.len() < 1024 {
        return None;
    }

    let mut best_start = 0;
    let mut best_len = 0;
    let mut i = 0;
    let len = bytes.len();

    while i + 3 < len {
        // Look for JPEG SOI marker: FF D8 FF
        if bytes[i] == 0xFF && bytes[i + 1] == 0xD8 && bytes[i + 2] == 0xFF {
            let start = i;
            i += 3;
            // Scan for corresponding EOI marker: FF D9
            while i + 1 < len {
                if bytes[i] == 0xFF && bytes[i + 1] == 0xD9 {
                    let end = i + 2;
                    let cur_len = end - start;
                    // Prefer JPEGs larger than 32KB (real previews, not tiny thumbnails)
                    if cur_len > best_len {
                        best_start = start;
                        best_len = cur_len;
                    }
                    i = end;
                    break;
                }
                i += 1;
            }
        } else {
            i += 1;
        }
    }

    if best_len >= 32 * 1024 {
        Some(bytes[best_start..best_start + best_len].to_vec())
    } else {
        None
    }
}
