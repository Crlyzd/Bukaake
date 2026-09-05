// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod image_loader;
use image_loader::{get_initial_image, read_image_file};
use tauri::Manager;

#[tauri::command]
fn get_cli_args() -> Vec<String> {
    std::env::args().collect()
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        let cmd = if cfg!(target_os = "macos") { "open" } else { "xdg-open" };
        std::process::Command::new(cmd)
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn close_window(window: tauri::Window) {
    let _ = window.close();
}

#[tauri::command]
fn minimize_window(window: tauri::Window) {
    let _ = window.minimize();
}

#[tauri::command]
fn toggle_maximize_window(window: tauri::Window) {
    if let Ok(is_max) = window.is_maximized() {
        if is_max {
            let _ = window.unmaximize();
        } else {
            let _ = window.maximize();
        }
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
fn open_settings_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(settings_win) = app_handle.get_webview_window("settings") {
        let _ = settings_win.unminimize();
        let _ = settings_win.show();
        let _ = settings_win.set_focus();
    }
    Ok(())
}

#[tauri::command]
fn hide_settings_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(settings_win) = app_handle.get_webview_window("settings") {
        let _ = settings_win.hide();
    }
    Ok(())
}

#[tauri::command]
fn set_window_vibrancy(app_handle: tauri::AppHandle, is_dark: bool, is_viewer: Option<bool>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use window_vibrancy::{apply_acrylic, clear_acrylic};
        let dark_tint = Some((0, 0, 0, 248));
        let light_tint = Some((245, 247, 250, 130));
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
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(target_os = "windows")]
            {
                let tint = Some((0, 0, 0, 248));
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_shadow(true);
                    let _ = window_vibrancy::apply_acrylic(&window, tint);
                }
                if let Some(settings_win) = app.get_webview_window("settings") {
                    let _ = settings_win.set_shadow(true);
                    let _ = window_vibrancy::apply_acrylic(&settings_win, tint);
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_cli_args,
            get_initial_image,
            read_image_file,
            open_url,
            close_window,
            minimize_window,
            toggle_maximize_window,
            is_window_maximized,
            unmaximize_window,
            resize_and_center_window,
            start_window_resize,
            set_fullscreen_window,
            is_window_fullscreen,
            set_window_vibrancy,
            open_settings_window,
            hide_settings_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
