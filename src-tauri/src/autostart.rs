/// Bukaake Windows Startup & Autostart Manager
/// Manages HKCU\Software\Microsoft\Windows\CurrentVersion\Run for zero-UAC startup with path auto-healing (< 120 lines).

use serde::Serialize;
use std::env::current_exe;

#[cfg(target_os = "windows")]
use winreg::enums::*;
#[cfg(target_os = "windows")]
use winreg::RegKey;

const RUN_KEY_PATH: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const RUN_VALUE_NAME: &str = "Bukaake";

#[derive(Debug, Clone, Serialize)]
pub struct AutostartStatus {
    pub is_enabled: bool,
    pub is_path_matched: bool,
    pub registered_path: Option<String>,
    pub current_path: String,
}

fn get_current_exe_path() -> Result<String, String> {
    let path = current_exe().map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[cfg(target_os = "windows")]
pub fn get_registered_exe_path() -> Option<String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let run_key = hkcu.open_subkey(RUN_KEY_PATH).ok()?;
    let raw_cmd: String = run_key.get_value(RUN_VALUE_NAME).ok()?;
    let path = raw_cmd.trim().trim_start_matches('"').split('"').next()?;
    Some(path.to_string())
}

#[cfg(not(target_os = "windows"))]
pub fn get_registered_exe_path() -> Option<String> {
    None
}

/// Auto-heals the autostart registry command if the executable was moved or renamed.
pub fn auto_heal_autostart_path() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        let current_path = get_current_exe_path()?;
        if let Some(registered_path) = get_registered_exe_path() {
            if !registered_path.eq_ignore_ascii_case(&current_path) {
                let hkcu = RegKey::predef(HKEY_CURRENT_USER);
                if let Ok(run_key) = hkcu.open_subkey_with_flags(RUN_KEY_PATH, KEY_WRITE) {
                    let cmd_str = format!("\"{}\" --startup", current_path);
                    let _ = run_key.set_value(RUN_VALUE_NAME, &cmd_str);
                    return Ok(true);
                }
            }
        }
    }
    Ok(false)
}

#[tauri::command]
pub fn get_autostart_status() -> Result<AutostartStatus, String> {
    let current_path = get_current_exe_path()?;
    let registered_path = get_registered_exe_path();
    let is_enabled = registered_path.is_some();
    let is_path_matched = registered_path
        .as_ref()
        .map(|p| p.eq_ignore_ascii_case(&current_path))
        .unwrap_or(false);

    Ok(AutostartStatus {
        is_enabled,
        is_path_matched,
        registered_path,
        current_path,
    })
}

#[tauri::command]
pub fn set_autostart_enabled(enabled: bool) -> Result<AutostartStatus, String> {
    let current_path = get_current_exe_path()?;

    #[cfg(target_os = "windows")]
    {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let (run_key, _) = hkcu
            .create_subkey(RUN_KEY_PATH)
            .map_err(|e| format!("Failed to access Run registry key: {}", e))?;

        if enabled {
            let cmd_str = format!("\"{}\" --startup", current_path);
            run_key
                .set_value(RUN_VALUE_NAME, &cmd_str)
                .map_err(|e| format!("Failed to register startup command: {}", e))?;
        } else {
            let _ = run_key.delete_value(RUN_VALUE_NAME);
        }
    }

    get_autostart_status()
}
