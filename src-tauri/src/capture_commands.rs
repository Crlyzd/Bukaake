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
        .add_filter("WebM Video", &["webm"])
        .add_filter("MP4 Video", &["mp4"]);

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
                    dir.join("AlitConverter.exe"),
                    dir.join("alitken.exe"),
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
