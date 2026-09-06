// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod clipboard;
mod file_ops;
pub mod exif_reader;
pub mod pro_decoder;
pub mod raw_reader;
mod image_loader;
mod updater;
use clipboard::{read_clipboard, write_clipboard_image};
use file_ops::delete_file;
use image_loader::{get_initial_image, read_image_context, read_image_file};
use tauri::{Emitter, Manager};
use updater::{cleanup_old_update_artifacts, download_and_install_update, get_system_arch};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[tauri::command]
fn get_cli_args() -> Vec<String> {
    std::env::args().collect()
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
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
fn show_in_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let mut cmd = std::process::Command::new("explorer");
        cmd.args(["/select,", &path]);
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd.spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = path;
    }
    Ok(())
}

#[tauri::command]
fn close_window(window: tauri::Window) {
    if window.label() == "main" {
        window.app_handle().exit(0);
    } else {
        let _ = window.close();
    }
}

#[tauri::command]
fn exit_app(app_handle: tauri::AppHandle) {
    app_handle.exit(0);
}

#[tauri::command]
fn prompt_save_file(default_name: String, filter_ext: String) -> Result<Option<String>, String> {
    let mut dialog = rfd::FileDialog::new().set_file_name(&default_name);
    if !filter_ext.is_empty() {
        let exts = [filter_ext.as_str()];
        dialog = dialog.add_filter("Image", &exts);
    }
    let res = dialog.save_file();
    Ok(res.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
fn prompt_open_file() -> Result<Option<String>, String> {
    let dialog = rfd::FileDialog::new()
        .add_filter(
            "All Supported Images",
            &[
                "png", "jpg", "jpeg", "webp", "gif", "bmp", "ico", "tiff", "tif", "svg", "avif",
                "arw", "srf", "sr2", "cr2", "cr3", "nef", "nrw", "dng", "raf", "rw2", "orf", "pef",
                "hdr", "exr", "tga", "dds", "qoi", "ppm", "pgm", "pbm", "pnm",
            ],
        )
        .add_filter(
            "Camera RAW",
            &["arw", "srf", "sr2", "cr2", "cr3", "nef", "nrw", "dng", "raf", "rw2", "orf", "pef"],
        )
        .add_filter("VFX & 3D Textures", &["hdr", "exr", "tga", "dds", "qoi", "ppm", "pgm", "pbm", "pnm"])
        .add_filter("Standard Images", &["png", "jpg", "jpeg", "webp", "gif", "bmp", "ico", "tiff", "svg", "avif"]);
    let res = dialog.pick_file();
    Ok(res.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
fn save_image_bytes(path: String, base64_data: String) -> Result<(), String> {
    use base64::prelude::*;
    let cleaned = if let Some(idx) = base64_data.find(',') {
        &base64_data[idx + 1..]
    } else {
        &base64_data
    };
    let data = BASE64_STANDARD.decode(cleaned).map_err(|e| e.to_string())?;
    std::fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn minimize_window(window: tauri::Window) {
    let _ = window.minimize();
}

#[tauri::command]
fn toggle_maximize_window(window: tauri::Window) {
    if let Ok(is_max) = window.is_maximized() {
        if is_max { let _ = window.unmaximize(); } else { let _ = window.maximize(); }
    }
}

#[tauri::command]
fn is_window_maximized(window: tauri::Window) -> bool {
    window.is_maximized().unwrap_or(false)
}

#[tauri::command]
fn unmaximize_window(window: tauri::Window) {
    let _ = window.unmaximize();
}

#[tauri::command]
fn resize_and_center_window(window: tauri::Window, width: u32, height: u32) -> Result<(), String> {
    let _ = window.unmaximize();
    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: width as f64,
            height: height as f64,
        }))
        .map_err(|e| e.to_string())?;
    window.center().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn start_window_resize(window: tauri::Window, direction: String) -> Result<(), String> {
    let _ = direction;
    let _ = window;
    Ok(())
}

#[tauri::command]
fn set_fullscreen_window(window: tauri::Window, fullscreen: bool) -> Result<(), String> {
    window.set_fullscreen(fullscreen).map_err(|e| e.to_string())
}

#[tauri::command]
fn is_window_fullscreen(window: tauri::Window) -> bool {
    window.is_fullscreen().unwrap_or(false)
}

#[tauri::command]
fn play_windows_ding() {
    #[cfg(target_os = "windows")]
    unsafe {
        #[link(name = "user32")]
        extern "system" {
            fn MessageBeep(uType: u32) -> i32;
        }
        MessageBeep(0);
    }
}

#[tauri::command]
fn open_settings_window(app_handle: tauri::AppHandle) -> Result<(), String> {
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
fn hide_settings_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(settings_win) = app_handle.get_webview_window("settings") {
        let _ = settings_win.hide();
        let _ = app_handle.emit("settings-modal-state", false);
    }
    Ok(())
}

#[tauri::command]
fn set_window_vibrancy(app_handle: tauri::AppHandle, is_dark: bool, is_viewer: Option<bool>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use window_vibrancy::{apply_acrylic, clear_acrylic};
        let dark_tint = Some((16, 19, 28, 248));
        let light_tint = Some((245, 247, 250, 140));
        let tint = if is_dark { dark_tint } else { light_tint };

        if let Some(main_win) = app_handle.get_webview_window("main") {
            if is_viewer.unwrap_or(false) {
                let _ = clear_acrylic(&main_win);
            } else {
                let _ = apply_acrylic(&main_win, tint);
            }
        }

        if let Some(settings_win) = app_handle.get_webview_window("settings") {
            let _ = apply_acrylic(&settings_win, tint);
        }
    }
    let _ = (app_handle, is_dark, is_viewer);
    Ok(())
}

fn main() {
    cleanup_old_update_artifacts();
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(target_os = "windows")]
            {
                let tint = Some((16, 19, 28, 248));
                if let Some(icon) = app.default_window_icon() {
                    for name in ["main", "settings"] {
                        if let Some(w) = app.get_webview_window(name) { let _ = w.set_icon(icon.clone()); }
                    }
                }
                for name in ["main", "settings"] {
                    if let Some(w) = app.get_webview_window(name) {
                        let _ = w.set_shadow(true);
                        let _ = window_vibrancy::apply_acrylic(&w, tint);
                    }
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed = event {
                    window.app_handle().exit(0);
                }
            } else if window.label() == "settings" {
                if let tauri::WindowEvent::CloseRequested { .. } = event {
                    let _ = window.app_handle().emit("settings-modal-state", false);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_cli_args, get_initial_image, read_image_file, read_image_context,
            play_windows_ding, open_url, show_in_folder, close_window, exit_app,
            prompt_save_file, prompt_open_file, save_image_bytes, read_clipboard,
            write_clipboard_image, minimize_window, toggle_maximize_window,
            is_window_maximized, unmaximize_window, resize_and_center_window,
            start_window_resize, set_fullscreen_window, is_window_fullscreen,
            set_window_vibrancy, open_settings_window, hide_settings_window,
            download_and_install_update, get_system_arch, delete_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
