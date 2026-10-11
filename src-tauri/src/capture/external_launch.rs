/**
 * Bukaake External Integration & File Launch Dialogs
 * Handles external executable picking, folder selection, and Alitken companion launch (< 70 lines)
 */

use std::path::PathBuf;
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

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
