use base64::prelude::*;
use serde::Serialize;
use std::borrow::Cow;
use std::io::Cursor;
use std::path::Path;

#[derive(Serialize)]
pub struct ClipboardPayload {
    pub payload_type: String, // "image" or "path"
    pub data: String,
}

fn is_image_path(path_str: &str) -> bool {
    let p = Path::new(path_str);
    if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
        let ext_lower = ext.to_lowercase();
        matches!(
            ext_lower.as_str(),
            "png" | "jpg" | "jpeg" | "webp" | "gif" | "bmp" | "ico" | "avif" | "tiff"
                | "heic" | "heif" | "hif" | "heifs" | "heics"
        )
    } else {
        false
    }
}

#[cfg(target_os = "windows")]
fn get_clipboard_file_path() -> Option<String> {
    #[link(name = "user32")]
    extern "system" {
        fn OpenClipboard(hwnd: *mut std::ffi::c_void) -> i32;
        fn CloseClipboard() -> i32;
        fn GetClipboardData(u_format: u32) -> *mut std::ffi::c_void;
        fn IsClipboardFormatAvailable(u_format: u32) -> i32;
    }
    #[link(name = "shell32")]
    extern "system" {
        fn DragQueryFileW(
            h_drop: *mut std::ffi::c_void,
            i_file: u32,
            lpsz_file: *mut u16,
            cch: u32,
        ) -> u32;
    }

    const CF_HDROP: u32 = 15;

    unsafe {
        if IsClipboardFormatAvailable(CF_HDROP) == 0 {
            return None;
        }
        if OpenClipboard(std::ptr::null_mut()) == 0 {
            return None;
        }

        let h_drop = GetClipboardData(CF_HDROP);
        if h_drop.is_null() {
            CloseClipboard();
            return None;
        }

        let file_count = DragQueryFileW(h_drop, 0xFFFFFFFF, std::ptr::null_mut(), 0);
        let mut selected_path: Option<String> = None;

        for i in 0..file_count {
            let mut buf = [0u16; 1024];
            let len = DragQueryFileW(h_drop, i, buf.as_mut_ptr(), buf.len() as u32);
            if len > 0 {
                let path_str = String::from_utf16_lossy(&buf[..len as usize]);
                if is_image_path(&path_str) {
                    selected_path = Some(path_str);
                    break;
                }
            }
        }

        CloseClipboard();
        selected_path
    }
}

#[cfg(not(target_os = "windows"))]
fn get_clipboard_file_path() -> Option<String> {
    None
}

#[tauri::command]
pub fn read_clipboard() -> Result<Option<ClipboardPayload>, String> {
    // 1. Check for file paths from native Windows clipboard
    if let Some(file_path) = get_clipboard_file_path() {
        if Path::new(&file_path).is_file() {
            return Ok(Some(ClipboardPayload {
                payload_type: "path".into(),
                data: file_path,
            }));
        }
    }

    let mut clipboard = match arboard::Clipboard::new() {
        Ok(c) => c,
        Err(e) => return Err(e.to_string()),
    };

    // 2. Check for direct image in clipboard
    if let Ok(img_data) = clipboard.get_image() {
        let width = img_data.width as u32;
        let height = img_data.height as u32;
        if let Some(buffer) = image::ImageBuffer::<image::Rgba<u8>, _>::from_raw(
            width,
            height,
            img_data.bytes.into_owned(),
        ) {
            let dyn_img = image::DynamicImage::ImageRgba8(buffer);
            let mut png_bytes = Vec::new();
            if dyn_img
                .write_to(&mut Cursor::new(&mut png_bytes), image::ImageFormat::Png)
                .is_ok()
            {
                let data_url = format!(
                    "data:image/png;base64,{}",
                    BASE64_STANDARD.encode(&png_bytes)
                );
                return Ok(Some(ClipboardPayload {
                    payload_type: "image".into(),
                    data: data_url,
                }));
            }
        }
    }

    // 3. Check for text that might be a file path
    if let Ok(text) = clipboard.get_text() {
        let clean = text.trim().trim_matches('"');
        if is_image_path(clean) && Path::new(clean).is_file() {
            return Ok(Some(ClipboardPayload {
                payload_type: "path".into(),
                data: clean.to_string(),
            }));
        }
    }

    Ok(None)
}

#[tauri::command]
pub fn write_clipboard_image(
    base64_data: Option<String>,
    base64: Option<String>,
) -> Result<(), String> {
    let raw = base64_data
        .or(base64)
        .ok_or_else(|| "Missing base64 image data".to_string())?;
    let cleaned = if let Some(idx) = raw.find(',') {
        &raw[idx + 1..]
    } else {
        &raw
    };
    let data = BASE64_STANDARD.decode(cleaned).map_err(|e| e.to_string())?;
    let img = image::load_from_memory(&data).map_err(|e| e.to_string())?;
    let mut rgba = img.to_rgba8();
    let (width, height) = rgba.dimensions();

    // Ensure all pixels are fully opaque for universal Win32 CF_DIB compatibility,
    // preventing Windows Clipboard History (Win + V) from displaying transparent pixels as black
    for pixel in rgba.chunks_exact_mut(4) {
        pixel[3] = 255;
    }

    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    let img_data = arboard::ImageData {
        width: width as usize,
        height: height as usize,
        bytes: Cow::Borrowed(&rgba),
    };
    clipboard.set_image(img_data).map_err(|e| e.to_string())?;
    Ok(())
}
