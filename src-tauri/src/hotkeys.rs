/// Bukaake Global Hotkey Persistence & Dispatch Engine
/// Manages customizable unified capture shortcut, HKCU registry persistence, and event dispatch (< 100 lines).

use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

#[cfg(target_os = "windows")]
use winreg::enums::*;
#[cfg(target_os = "windows")]
use winreg::RegKey;

const SETTINGS_KEY_PATH: &str = "Software\\Bukaake";
const DEFAULT_HOTKEY: &str = "Alt+Shift+S";

#[derive(Default)]
pub struct RegisteredShortcuts {
    pub capture: Mutex<Option<Shortcut>>,
}

#[cfg(target_os = "windows")]
pub fn load_saved_hotkey() -> String {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok(key) = hkcu.open_subkey(SETTINGS_KEY_PATH) {
        key.get_value("CaptureHotkey")
            .or_else(|_| key.get_value("SnipHotkey"))
            .unwrap_or_else(|_| DEFAULT_HOTKEY.into())
    } else {
        DEFAULT_HOTKEY.into()
    }
}

#[cfg(not(target_os = "windows"))]
pub fn load_saved_hotkey() -> String {
    DEFAULT_HOTKEY.into()
}

#[cfg(target_os = "windows")]
pub fn save_hotkey_to_reg(combo: &str) {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok((key, _)) = hkcu.create_subkey(SETTINGS_KEY_PATH) {
        let _ = key.set_value("CaptureHotkey", &combo);
    }
}

#[cfg(not(target_os = "windows"))]
pub fn save_hotkey_to_reg(_combo: &str) {}

pub fn normalize_combo(combo: &str) -> String {
    let s = combo.trim();
    if s.contains("PrtScn") {
        s.replace("PrtScn", "PrintScreen")
    } else {
        s.to_string()
    }
}

pub fn parse_shortcut(combo: &str) -> Option<Shortcut> {
    if combo.trim().is_empty() {
        return None;
    }
    let norm = normalize_combo(combo);
    norm.parse::<Shortcut>().ok()
}

pub fn setup_hotkeys(app: &mut tauri::App) {
    app.manage(RegisteredShortcuts::default());
    let combo = load_saved_hotkey();
    let _ = apply_shortcuts_internal(app.handle(), &combo, false);
}

pub fn handle_global_shortcut(app: &AppHandle, _shortcut: &Shortcut) {
    let _ = app.emit("bukaake://trigger-snip", ());
}

fn apply_shortcuts_internal(
    app: &AppHandle,
    combo: &str,
    save_reg: bool,
) -> Result<(), String> {
    let _ = app.global_shortcut().unregister_all();

    let sc = parse_shortcut(combo);
    if let Some(ref s) = sc {
        let _ = app.global_shortcut().register(s.clone());
    }

    if let Some(state) = app.try_state::<RegisteredShortcuts>() {
        *state.capture.lock().unwrap() = sc;
    }

    if save_reg {
        save_hotkey_to_reg(combo);
    }

    Ok(())
}

#[tauri::command]
pub fn update_global_shortcuts(
    app: AppHandle,
    combo: Option<String>,
    snip_combo: Option<String>,
) -> Result<(), String> {
    let chosen = combo.or(snip_combo).unwrap_or_else(|| DEFAULT_HOTKEY.into());
    apply_shortcuts_internal(&app, &chosen, true)
}
