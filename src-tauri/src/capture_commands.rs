/**
 * Bukaake Capture & Recording IPC Commands
 * Handles GDI screen capture, low-RAM chunk streaming, folder picking, and Alitken launch (< 180 lines)
 */

use crate::screen_capture::{self, ScreenCapturePayload};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[tauri::command]
pub fn capture_screen() -> Result<ScreenCapturePayload, String> {
    screen_capture::capture_desktop()
}

#[tauri::command]
pub fn get_default_videos_dir() -> Result<String, String> {
    let base = if let Ok(profile) = std::env::var("USERPROFILE") {
        PathBuf::from(profile).join("Videos").join("Captures")
    } else {
        std::env::temp_dir().join("Bukaake").join("Captures")
    };
    let _ = fs::create_dir_all(&base);
    Ok(base.to_string_lossy().to_string())
}

#[tauri::command]
pub fn init_recording_stream(temp_filename: String) -> Result<String, String> {
    let temp_dir = std::env::temp_dir().join("Bukaake").join("captures");
    fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    let file_path = temp_dir.join(&temp_filename);
    let _ = fs::File::create(&file_path).map_err(|e| e.to_string())?;

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn append_recording_chunk(temp_path: String, chunk: Vec<u8>) -> Result<(), String> {
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&temp_path)
        .map_err(|e| e.to_string())?;

    file.write_all(&chunk).map_err(|e| e.to_string())?;
    file.flush().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn finalize_recording(temp_path: String, dest_path: String) -> Result<String, String> {
    let temp = Path::new(&temp_path);
    let dest = Path::new(&dest_path);

    if let Some(parent) = dest.parent() {
        let _ = fs::create_dir_all(parent);
    }

    if let Err(_) = fs::rename(temp, dest) {
        fs::copy(temp, dest).map_err(|e| format!("Failed to copy recording: {}", e))?;
        let _ = fs::remove_file(temp);
    }

    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
pub fn discard_recording(temp_path: String) -> Result<(), String> {
    let path = Path::new(&temp_path);
    if path.exists() {
        let _ = fs::remove_file(path);
    }
    Ok(())
}

#[tauri::command]
pub fn prompt_save_recording(default_name: String, default_dir: Option<String>) -> Result<Option<String>, String> {
    let mut dialog = rfd::FileDialog::new()
        .set_file_name(&default_name)
        .add_filter("WebM Video", &["webm"]);

    if let Some(dir) = default_dir {
        let p = PathBuf::from(dir);
        if p.is_dir() {
            dialog = dialog.set_directory(p);
        }
    }

    Ok(dialog.save_file().map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn prompt_select_folder() -> Result<Option<String>, String> {
    Ok(rfd::FileDialog::new().pick_folder().map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn prompt_select_executable() -> Result<Option<String>, String> {
    Ok(rfd::FileDialog::new()
        .add_filter("Executable", &["exe", "cmd", "bat"])
        .pick_file()
        .map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn launch_alitken(video_path: String, custom_exe: Option<String>) -> Result<(), String> {
    let mut resolved_exe: Option<PathBuf> = None;

    if let Some(custom) = custom_exe {
        let p = PathBuf::from(&custom);
        if p.is_file() {
            resolved_exe = Some(p);
        }
    }

    if resolved_exe.is_none() {
        if let Ok(current_exe) = std::env::current_exe() {
            if let Some(dir) = current_exe.parent() {
                let candidates = [
                    dir.join("AlitConverter.exe"), dir.join("alitken.exe"),
                    dir.join("Alitken").join("AlitConverter.exe"),
                    dir.join("..").join("Alitken").join("AlitConverter.exe"),
                    dir.join("..").join("AlitConverter.exe"),
                ];
                for cand in candidates {
                    if cand.is_file() {
                        resolved_exe = Some(cand);
                        break;
                    }
                }
            }
        }
    }

    let exe_path = resolved_exe.ok_or_else(|| {
        "Alitken executable (AlitConverter.exe) not found. Please locate it in Settings.".to_string()
    })?;

    let mut cmd = Command::new(exe_path);
    cmd.arg(&video_path);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    cmd.spawn().map_err(|e| format!("Failed to launch Alitken: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn prepare_screen_snip(app: tauri::AppHandle) -> Result<ScreenCapturePayload, String> {
    use tauri::Manager;
    #[cfg(target_os = "windows")]
    use window_vibrancy::clear_acrylic;

    let mut was_visible = false;
    let mut was_minimized = false;
    let mut was_fullscreen = false;

    if let Some(win) = app.get_webview_window("main") {
        was_visible = win.is_visible().unwrap_or(false);
        was_minimized = win.is_minimized().unwrap_or(false);
        was_fullscreen = win.is_fullscreen().unwrap_or(false);

        if was_visible {
            let _ = win.hide();
            std::thread::sleep(std::time::Duration::from_millis(280));
        }
        #[cfg(target_os = "windows")]
        let _ = clear_acrylic(&win);
    }

    let mut payload = screen_capture::capture_desktop()?;
    payload.was_visible = was_visible;
    payload.was_minimized = was_minimized;
    payload.was_fullscreen = was_fullscreen;

    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_maximizable(true);
        let _ = win.set_always_on_top(true);
        let _ = win.set_fullscreen(true);
    }
    Ok(payload)
}

#[tauri::command]
pub fn show_screen_snip(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
    }
    Ok(())
}

#[tauri::command]
pub fn finish_screen_snip(
    app: tauri::AppHandle,
    was_fullscreen: bool,
    was_minimized: bool,
    was_hidden: bool,
) -> Result<(), String> {
    use tauri::Manager;
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_always_on_top(false);
        if was_hidden {
            let _ = win.hide();
            let _ = win.set_fullscreen(false);
            let _ = win.set_maximizable(false);
        } else if was_minimized {
            let _ = win.set_fullscreen(false);
            let _ = win.minimize();
        } else if !was_fullscreen {
            let _ = win.set_fullscreen(false);
        }
        let _ = win.set_maximizable(was_fullscreen);
    }
    Ok(())
}

#[tauri::command]
pub fn save_screenshot_to_dir(
    base64_png: String,
    dest_dir: String,
    filename: String,
) -> Result<String, String> {
    use base64::Engine;
    let clean_b64 = if let Some(idx) = base64_png.find(',') {
        &base64_png[idx + 1..]
    } else {
        &base64_png
    };
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(clean_b64)
        .map_err(|e| format!("Base64 decode error: {}", e))?;

    let dest = Path::new(&dest_dir);
    fs::create_dir_all(dest).map_err(|e| format!("Failed to create folder: {}", e))?;
    let target = dest.join(&filename);
    fs::write(&target, bytes).map_err(|e| format!("Failed to write screenshot file: {}", e))?;

    Ok(target.to_string_lossy().to_string())
}

