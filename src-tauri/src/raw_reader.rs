use base64::prelude::*;
use std::path::Path;

#[cfg(windows)]
use std::os::windows::ffi::OsStrExt;

pub const RAW_EXTS: &[&str] = &[
    "arw", "srf", "sr2", "cr2", "cr3", "nef", "nrw", "dng", "raf", "rw2", "orf", "pef", "3fr",
    "mrw", "srw", "x3f", "mos", "mef", "raw", "kdc", "dcr", "rwl", "iiq", "erf",
];

pub fn is_raw_file(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|ext| RAW_EXTS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

#[repr(C)]
struct LibRawData {
    _private: [u8; 0],
}

#[repr(C)]
struct LibRawProcessedImage {
    image_type: u32, // 1 = JPEG, 2 = BITMAP
    height: u16,
    width: u16,
    colors: u16,
    bits: u16,
    data_size: u32,
    data: [u8; 1],
}

extern "C" {
    fn libraw_init(flags: u32) -> *mut LibRawData;
    fn libraw_close(lr: *mut LibRawData);
    #[cfg(not(windows))]
    fn libraw_open_file(lr: *mut LibRawData, filename: *const std::os::raw::c_char) -> i32;
    #[cfg(windows)]
    fn libraw_open_wfile(lr: *mut LibRawData, ws: *const u16) -> i32;
    fn libraw_unpack(lr: *mut LibRawData) -> i32;
    fn libraw_unpack_thumb(lr: *mut LibRawData) -> i32;
    fn libraw_dcraw_make_mem_thumb(lr: *mut LibRawData, errc: *mut i32) -> *mut LibRawProcessedImage;
    fn libraw_dcraw_process(lr: *mut LibRawData) -> i32;
    fn libraw_dcraw_make_mem_image(lr: *mut LibRawData, errc: *mut i32) -> *mut LibRawProcessedImage;
    fn libraw_dcraw_clear_mem(img: *mut LibRawProcessedImage);
}

struct LibRawGuard(*mut LibRawData);
impl Drop for LibRawGuard {
    fn drop(&mut self) {
        if !self.0.is_null() {
            unsafe { libraw_close(self.0) };
        }
    }
}

struct MemImageGuard(*mut LibRawProcessedImage);
impl Drop for MemImageGuard {
    fn drop(&mut self) {
        if !self.0.is_null() {
            unsafe { libraw_dcraw_clear_mem(self.0) };
        }
    }
}

fn transcode_bitmap_to_jpeg(pi: &LibRawProcessedImage) -> Option<(String, (u32, u32))> {
    let w = pi.width as u32;
    let h = pi.height as u32;
    if w == 0 || h == 0 || pi.colors != 3 {
        return None;
    }

    let raw_bytes = unsafe {
        std::slice::from_raw_parts(pi.data.as_ptr(), pi.data_size as usize)
    };

    let rgb_vec: Vec<u8> = if pi.bits == 8 {
        raw_bytes.to_vec()
    } else if pi.bits == 16 {
        raw_bytes
            .chunks_exact(2)
            .map(|chunk| {
                let val = u16::from_ne_bytes([chunk[0], chunk[1]]);
                (val >> 8) as u8
            })
            .collect()
    } else {
        return None;
    };

    let img_buf = image::RgbImage::from_raw(w, h, rgb_vec)?;
    let mut buf = std::io::Cursor::new(Vec::new());
    let mut enc = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, 92);
    enc.encode_image(&img_buf).ok()?;

    let b64 = BASE64_STANDARD.encode(buf.into_inner());
    Some((format!("data:image/jpeg;base64,{}", b64), (w, h)))
}

fn extract_processed_image(pi: &LibRawProcessedImage) -> Option<(String, (u32, u32))> {
    if pi.image_type == 1 {
        // LIBRAW_IMAGE_JPEG
        let data_slice = unsafe {
            std::slice::from_raw_parts(pi.data.as_ptr(), pi.data_size as usize)
        };
        let (mut w, mut h) = (pi.width as u32, pi.height as u32);
        if w == 0 || h == 0 {
            if let Ok(reader) = image::ImageReader::new(std::io::Cursor::new(data_slice)).with_guessed_format() {
                if let Ok(dims) = reader.into_dimensions() {
                    w = dims.0;
                    h = dims.1;
                }
            }
        }
        let b64 = BASE64_STANDARD.encode(data_slice);
        Some((format!("data:image/jpeg;base64,{}", b64), (w, h)))
    } else if pi.image_type == 2 {
        // LIBRAW_IMAGE_BITMAP
        transcode_bitmap_to_jpeg(pi)
    } else {
        None
    }
}

fn find_embedded_jpeg_stream(path: &Path) -> Option<(String, (u32, u32))> {
    let bytes = std::fs::read(path).ok()?;
    if bytes.len() < 1024 {
        return None;
    }

    let mut best_start = 0;
    let mut best_len = 0;
    let mut i = 0;
    let len = bytes.len();

    while i + 3 < len {
        if bytes[i] == 0xFF && bytes[i + 1] == 0xD8 && bytes[i + 2] == 0xFF {
            let start = i;
            i += 3;
            while i + 1 < len {
                if bytes[i] == 0xFF && bytes[i + 1] == 0xD9 {
                    let end = i + 2;
                    let cur_len = end - start;
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

    if best_len >= 16 * 1024 {
        let slice = &bytes[best_start..best_start + best_len];
        let (mut w, mut h) = (0, 0);
        if let Ok(reader) = image::ImageReader::new(std::io::Cursor::new(slice)).with_guessed_format() {
            if let Ok(dims) = reader.into_dimensions() {
                w = dims.0;
                h = dims.1;
            }
        }
        let b64 = BASE64_STANDARD.encode(slice);
        Some((format!("data:image/jpeg;base64,{}", b64), (w, h)))
    } else {
        None
    }
}

fn try_image_crate_fallback(path: &Path) -> Option<(String, (u32, u32))> {
    let img = image::open(path).ok()?;
    let dims = (img.width(), img.height());
    let mut buf = std::io::Cursor::new(Vec::new());
    let mut enc = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, 92);
    enc.encode_image(&img.to_rgb8()).ok()?;
    let b64 = BASE64_STANDARD.encode(buf.into_inner());
    Some((format!("data:image/jpeg;base64,{}", b64), dims))
}

/// High-performance multi-tier camera RAW decoder.
/// Tier 1 (~15ms): LibRaw embedded JPEG/Bitmap preview if substantial.
/// Tier 2 (~150-300ms): LibRaw sensor unpack + Bayer demosaicing.
/// Tier 3 (~20ms): Embedded container JPEG stream scanner (GPR, X3F).
/// Tier 4 (~50ms): Rust image crate DNG/TIFF decode.
pub fn decode_raw_image(path: &Path) -> Result<(String, (u32, u32)), String> {
    let mut fallback_thumb: Option<(String, (u32, u32))> = None;

    let lr = unsafe { libraw_init(0) };
    if !lr.is_null() {
        let guard = LibRawGuard(lr);
        #[cfg(windows)]
        let ret = {
            let wide: Vec<u16> = path.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
            unsafe { libraw_open_wfile(guard.0, wide.as_ptr()) }
        };
        #[cfg(not(windows))]
        let ret = {
            let c_str = std::ffi::CString::new(path.to_string_lossy().as_bytes())
                .map_err(|e| e.to_string())?;
            unsafe { libraw_open_file(guard.0, c_str.as_ptr()) }
        };

        if ret == 0 {
            // Tier 1: LibRaw thumbnail extraction
            let thumb_ret = unsafe { libraw_unpack_thumb(guard.0) };
            if thumb_ret == 0 {
                let mut errc = 0;
                let proc_thumb = unsafe { libraw_dcraw_make_mem_thumb(guard.0, &mut errc) };
                if !proc_thumb.is_null() {
                    let thumb_guard = MemImageGuard(proc_thumb);
                    let pt = unsafe { &*thumb_guard.0 };
                    if let Some(res) = extract_processed_image(pt) {
                        let (w, h) = res.1;
                        let is_preview = (w >= 1024 || h >= 1024) || (pt.data_size >= 32_768);
                        if is_preview {
                            return Ok(res);
                        }
                        fallback_thumb = Some(res);
                    }
                }
            }

            // Tier 2: Sensor unpack + Bayer demosaicing
            if unsafe { libraw_unpack(guard.0) } == 0 {
                if unsafe { libraw_dcraw_process(guard.0) } == 0 {
                    let mut errc = 0;
                    let proc_img = unsafe { libraw_dcraw_make_mem_image(guard.0, &mut errc) };
                    if !proc_img.is_null() {
                        let img_guard = MemImageGuard(proc_img);
                        let pi = unsafe { &*img_guard.0 };
                        if let Some(res) = extract_processed_image(pi) {
                            return Ok(res);
                        }
                    }
                }
            }
        }
    }

    // Tier 3: Container JPEG stream scanner (recovers GPR, X3F, and custom containers)
    if let Some(res) = find_embedded_jpeg_stream(path) {
        return Ok(res);
    }

    // Tier 4: Rust image crate fallback for standard linear DNGs
    if let Some(res) = try_image_crate_fallback(path) {
        return Ok(res);
    }

    fallback_thumb.ok_or_else(|| "Failed to decode RAW image".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_raw_sample_decoding() {
        let samples_dir = Path::new("../test-samples/raw");
        if !samples_dir.exists() {
            println!("No test samples found at {}", samples_dir.display());
            return;
        }

        let mut success = 0;
        let mut failed = 0;
        let mut entries: Vec<_> = std::fs::read_dir(samples_dir)
            .unwrap()
            .flatten()
            .map(|e| e.path())
            .filter(|p| is_raw_file(p) || crate::pro_decoder::is_pro_file(p))
            .collect();
        entries.sort();

        for path in &entries {
            let name = path.file_name().unwrap().to_string_lossy();
            let start = std::time::Instant::now();
            let res = if is_raw_file(path) {
                decode_raw_image(path)
            } else {
                crate::pro_decoder::decode_pro_image(path)
            };

            match res {
                Ok((data_url, (w, h))) => {
                    let elapsed = start.elapsed();
                    let b64_len = data_url.len();
                    println!("[TEST PASS] {:<42} {:>5}x{:<5} {:>7?} ({} bytes)", name, w, h, elapsed, b64_len);
                    success += 1;
                }
                Err(e) => {
                    println!("[TEST FAIL] {} -> {}", name, e);
                    failed += 1;
                }
            }
        }

        println!("[TEST SUMMARY] {} passed, {} failed out of {} sample files", success, failed, entries.len());
        assert_eq!(failed, 0, "All sample files must decode successfully");
    }
}
