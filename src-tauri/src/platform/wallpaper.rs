//! Bukaake Desktop Wallpaper Subsystem
//! Sets active image or processed canvas as the Windows desktop wallpaper (< 100 lines)

use std::fs;
use std::path::{Path, PathBuf};

fn get_wallpaper_cache_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            return PathBuf::from(appdata).join("Bukaake");
        }
    }
    std::env::temp_dir().join("Bukaake")
}

#[cfg(target_os = "windows")]
pub fn set_desktop_wallpaper(path_str: &str) -> Result<(), String> {
    use windows::Win32::UI::WindowsAndMessaging::{
        SystemParametersInfoW, SPI_SETDESKWALLPAPER, SPIF_SENDCHANGE, SPIF_UPDATEINIFILE,
    };

    let p = Path::new(path_str);
    if !p.exists() {
        return Err(format!("File does not exist: {}", path_str));
    }

    let normalized = path_str.replace('/', "\\");
    let clean_path = normalized.strip_prefix(r"\\?\").unwrap_or(&normalized);
    let mut wide_path: Vec<u16> = clean_path.encode_utf16().collect();
    wide_path.push(0);

    let res = unsafe {
        SystemParametersInfoW(
            SPI_SETDESKWALLPAPER,
            0,
            Some(wide_path.as_ptr() as *mut std::ffi::c_void),
            SPIF_UPDATEINIFILE | SPIF_SENDCHANGE,
        )
    };

    res.map_err(|e| format!("Failed to set wallpaper: {}", e))
}

#[cfg(not(target_os = "windows"))]
pub fn set_desktop_wallpaper(_path_str: &str) -> Result<(), String> {
    Err("Setting wallpaper is only supported on Windows".to_string())
}

#[tauri::command]
pub fn set_wallpaper(path: Option<String>, base64_data: Option<String>) -> Result<(), String> {
    // 1. If base64 PNG data is provided (from canvas, edits, or RAW demosaic), persist to AppData
    if let Some(b64) = base64_data {
        use base64::Engine;
        let clean_b64 = if let Some(idx) = b64.find(',') {
            &b64[idx + 1..]
        } else {
            &b64
        };
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(clean_b64)
            .map_err(|e| format!("Base64 decode error: {}", e))?;

        let dir = get_wallpaper_cache_dir();
        fs::create_dir_all(&dir).map_err(|e| format!("Failed to create AppData directory: {}", e))?;
        let target = dir.join("bukaake_wallpaper.png");
        fs::write(&target, bytes).map_err(|e| format!("Failed to write wallpaper file: {}", e))?;

        return set_desktop_wallpaper(&target.to_string_lossy());
    }

    // 2. If direct path is provided
    if let Some(file_path) = path {
        let p = Path::new(&file_path);
        let ext = p
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        // Standard Windows wallpaper formats
        if matches!(ext.as_str(), "jpg" | "jpeg" | "png" | "bmp") {
            return set_desktop_wallpaper(&file_path);
        }

        // For non-standard formats (e.g. WebP, AVIF, TIFF), transcode to PNG in cache dir
        if let Ok(dynamic_img) = image::open(p) {
            let dir = get_wallpaper_cache_dir();
            fs::create_dir_all(&dir).map_err(|e| format!("Failed to create AppData directory: {}", e))?;
            let target = dir.join("bukaake_wallpaper.png");
            dynamic_img
                .save_with_format(&target, image::ImageFormat::Png)
                .map_err(|e| format!("Failed to transcode wallpaper image: {}", e))?;
            return set_desktop_wallpaper(&target.to_string_lossy());
        }

        return Err("Unsupported image format for desktop wallpaper".to_string());
    }

    Err("No image path or data provided to set as wallpaper".to_string())
}
