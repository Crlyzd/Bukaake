/// Bukaake Window & Dialog IPC Commands
/// All #[tauri::command] handlers for window control, native dialogs, and vibrancy.
/// Extracted from main.rs to keep the app entry-point a pure lifecycle coordinator.

use crate::standby::{self, StandbyManager};
use tauri::{Emitter, Manager};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

pub const CREATE_NO_WINDOW: u32 = 0x08000000;

#[tauri::command]
pub fn get_cli_args() -> Vec<String> { std::env::args().collect() }

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let mut cmd = std::process::Command::new("rundll32");
        cmd.args(["url.dll,FileProtocolHandler", &url]);
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd.spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        let cmd = if cfg!(target_os = "macos") { "open" } else { "xdg-open" };
        std::process::Command::new(cmd).arg(&url).spawn().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn show_in_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let normalized = path.replace('/', "\\");
        let p = std::path::Path::new(&normalized);
        let mut cmd = std::process::Command::new("explorer.exe");
        if p.is_dir() {
            cmd.arg(&normalized);
        } else {
            let arg = format!("/select,{}", normalized);
            cmd.arg(&arg);
        }
        cmd.spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    { let _ = path; }
    Ok(())
}

#[tauri::command]
pub fn close_window(window: tauri::Window, state: tauri::State<'_, StandbyManager>) {
    if window.label() == "main" {
        let _ = standby::enter_standby(window.app_handle().clone(), state);
    } else {
        let _ = window.close();
    }
}

#[tauri::command]
pub fn exit_app(app_handle: tauri::AppHandle) { app_handle.exit(0); }

#[tauri::command]
pub fn prompt_save_file(default_name: String, filter_ext: String) -> Result<Option<String>, String> {
    let mut dialog = rfd::FileDialog::new().set_file_name(&default_name);
    if !filter_ext.is_empty() { dialog = dialog.add_filter("Image", &[filter_ext.as_str()]); }
    Ok(dialog.save_file().map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn prompt_open_file() -> Result<Option<String>, String> {
    let dialog = rfd::FileDialog::new()
        .add_filter("All Supported Images", &[
            "png", "jpg", "jpeg", "webp", "gif", "bmp", "ico", "tiff", "tif", "svg", "avif",
            "heic", "heif", "hif", "heifs", "heics", "arw", "srf", "sr2", "cr2", "cr3",
            "nef", "nrw", "dng", "raf", "rw2", "orf", "pef", "hdr", "exr", "tga", "dds", "qoi",
            "ppm", "pgm", "pbm", "pnm",
        ])
        .add_filter("High Efficiency", &["heic", "heif", "hif", "heifs", "heics"])
        .add_filter("Camera RAW", &["arw", "srf", "sr2", "cr2", "cr3", "nef", "nrw", "dng", "raf", "rw2", "orf", "pef"])
        .add_filter("VFX & 3D Textures", &["hdr", "exr", "tga", "dds", "qoi", "ppm", "pgm", "pbm", "pnm"])
        .add_filter("Standard Images", &["png", "jpg", "jpeg", "webp", "gif", "bmp", "ico", "tiff", "svg", "avif"]);
    Ok(dialog.pick_file().map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn save_image_bytes(path: String, base64_data: String) -> Result<(), String> {
    use base64::prelude::*;
    let cleaned = if let Some(idx) = base64_data.find(',') { &base64_data[idx + 1..] } else { &base64_data };
    let data = BASE64_STANDARD.decode(cleaned).map_err(|e| e.to_string())?;
    std::fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn minimize_window(window: tauri::Window) { let _ = window.minimize(); }

#[tauri::command]
pub fn toggle_maximize_window(window: tauri::Window) {
    if let Ok(is_max) = window.is_maximized() {
        if is_max { let _ = window.unmaximize(); } else { let _ = window.maximize(); }
    }
}

#[tauri::command]
pub fn is_window_maximized(window: tauri::Window) -> bool { window.is_maximized().unwrap_or(false) }

#[tauri::command]
pub fn unmaximize_window(window: tauri::Window) { let _ = window.unmaximize(); }

#[tauri::command]
pub fn set_window_maximizable(window: tauri::Window, maximizable: bool) -> Result<(), String> {
    window.set_maximizable(maximizable).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn resize_and_center_window(window: tauri::Window, width: u32, height: u32) -> Result<(), String> {
    let _ = window.unmaximize();
    window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: width as f64, height: height as f64 })).map_err(|e| e.to_string())?;
    window.center().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn start_window_resize(window: tauri::Window, direction: String) -> Result<(), String> { let _ = (window, direction); Ok(()) }

#[tauri::command]
pub fn set_fullscreen_window(window: tauri::Window, fullscreen: bool) -> Result<(), String> { window.set_fullscreen(fullscreen).map_err(|e| e.to_string()) }

#[tauri::command]
pub fn is_window_fullscreen(window: tauri::Window) -> bool { window.is_fullscreen().unwrap_or(false) }

#[tauri::command]
pub fn play_windows_ding() {
    #[cfg(target_os = "windows")]
    unsafe {
        #[link(name = "user32")]
        extern "system" { fn MessageBeep(uType: u32) -> i32; }
        MessageBeep(0);
    }
}

#[tauri::command]
pub fn open_settings_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(settings_win) = app_handle.get_webview_window("settings") {
        let is_visible = settings_win.is_visible().unwrap_or(false);
        if !is_visible {
            if let Some(main_win) = app_handle.get_webview_window("main") {
                if let (Ok(main_pos), Ok(main_size), Ok(settings_size)) = (
                    main_win.outer_position(),
                    main_win.outer_size(),
                    settings_win.outer_size(),
                ) {
                    let center_x = main_pos.x + (main_size.width as i32 - settings_size.width as i32) / 2;
                    let center_y = main_pos.y + (main_size.height as i32 - settings_size.height as i32) / 2;
                    let _ = settings_win.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                        x: center_x,
                        y: center_y,
                    }));
                } else {
                    let _ = settings_win.center();
                }
            } else {
                let _ = settings_win.center();
            }
        }
        let _ = settings_win.unminimize();
        let _ = settings_win.show();
        let _ = settings_win.set_focus();
        let _ = app_handle.emit("settings-modal-state", true);
    }
    Ok(())
}

#[tauri::command]
pub fn hide_settings_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app_handle.get_webview_window("settings") {
        let _ = w.hide();
        let _ = app_handle.emit("settings-modal-state", false);
    }
    Ok(())
}

#[tauri::command]
pub fn set_window_vibrancy(app_handle: tauri::AppHandle, is_dark: bool, is_viewer: Option<bool>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use window_vibrancy::{apply_acrylic, clear_acrylic};
        let tint = if is_dark { Some((16, 19, 28, 248)) } else { Some((245, 247, 250, 140)) };
        if let Some(w) = app_handle.get_webview_window("main") {
            if is_viewer.unwrap_or(false) { let _ = clear_acrylic(&w); } else { let _ = apply_acrylic(&w, tint); }
        }
        if let Some(w) = app_handle.get_webview_window("settings") {
            let _ = apply_acrylic(&w, tint);
        }
    }
    let _ = (app_handle, is_dark, is_viewer);
    Ok(())
}
