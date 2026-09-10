// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod autostart;
mod clipboard;
mod file_assoc;
mod file_ops;
pub mod exif_reader;
pub mod heif_reader;
pub mod pro_decoder;
pub mod raw_reader;
pub mod capture_commands;
pub mod hotkeys;
pub mod recording_pill;
pub mod recording_border;
pub mod screen_capture;
pub mod standby;
pub mod window_commands;
#[cfg(target_os = "windows")]
pub mod wic_decoder;
mod image_loader;
mod updater;
use capture_commands::{
    append_recording_chunk, capture_screen, discard_recording, finalize_recording,
    get_default_videos_dir, init_recording_stream, launch_alitken,
    prompt_select_executable, prompt_select_folder, prompt_save_recording,
    prepare_screen_snip, show_screen_snip, finish_screen_snip,
    save_screenshot_to_dir,
};
use hotkeys::{handle_global_shortcut, setup_hotkeys, update_global_shortcuts};
use recording_pill::{enter_recording_pill_mode, exit_recording_pill_mode};
use recording_border::{show_recording_border, hide_recording_border, set_recording_border_paused};
use autostart::{auto_heal_autostart_path, get_autostart_status, set_autostart_enabled};
use clipboard::{read_clipboard, write_clipboard_image};
use file_assoc::{
    auto_heal_or_sync_path, check_association_status, launch_default_apps_settings,
    register_file_associations, unregister_file_associations,
};
use file_ops::delete_file;
use image_loader::{get_initial_image, read_image_context, read_image_file, read_raw_full_sensor};
use standby::{enter_standby, is_standby_enabled, set_standby_enabled, show_main_window, StandbyManager};
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::ShortcutState;
use updater::{cleanup_old_update_artifacts, download_and_install_update, get_system_arch};
use window_commands::{
    get_cli_args, open_url, show_in_folder, close_window, exit_app,
    prompt_save_file, prompt_open_file, save_image_bytes,
    minimize_window, toggle_maximize_window, is_window_maximized, unmaximize_window,
    set_window_maximizable, set_window_resizable, resize_and_center_window, start_window_resize, set_fullscreen_window,
    is_window_fullscreen, play_windows_ding, open_settings_window, hide_settings_window,
    set_window_vibrancy,
};

fn main() {
    #[cfg(target_os = "windows")]
    {
        let current_args = std::env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS").unwrap_or_default();
        let capture_flags = "--auto-select-desktop-capture-source=\"Entire screen\" --enable-usermedia-screen-capturing --use-fake-ui-for-media-stream --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows";
        if !current_args.contains("--auto-select-desktop-capture-source") {
            let combined = if current_args.is_empty() {
                capture_flags.to_string()
            } else {
                format!("{} {}", current_args, capture_flags)
            };
            std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", combined);
        }
    }
    cleanup_old_update_artifacts();
    tauri::Builder::default()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        handle_global_shortcut(app, shortcut);
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let standby = app.state::<StandbyManager>();
                standby.cancel_countdown();
                let mut target_file: Option<String> = None;
                for arg in argv.into_iter().skip(1) {
                    let p = std::path::Path::new(&arg);
                    if p.is_file() && image_loader::is_image_file(p) { target_file = Some(arg); break; }
                }
                if let Some(path) = target_file {
                    // File association path: switch to fullscreen viewer and load image
                    let _ = win.set_fullscreen(true);
                    #[cfg(target_os = "windows")]
                    let _ = window_vibrancy::clear_acrylic(&win);
                    let _ = win.emit("bukaake://open-path", path);
                } else {
                    // Bare exe/shortcut re-launch: restore to Mode 1 and signal JS to reset UI
                    let _ = win.set_fullscreen(false);
                    let _ = win.unminimize();
                    let _ = win.set_maximizable(false);
                    let _ = win.set_resizable(false);
                    let _ = win.emit("bukaake://wake-from-standby", ());
                }
                let _ = win.show();
                let _ = win.set_focus();
            }
        }))
        .setup(|app| {
            app.manage(StandbyManager::new());
            let _ = standby::create_tray(app);
            #[cfg(target_os = "windows")]
            {
                let _ = auto_heal_or_sync_path();
                let _ = auto_heal_autostart_path();
                let tint = Some((16, 19, 28, 248));
                if let Some(icon) = app.default_window_icon() {
                    for name in ["main", "settings"] {
                        if let Some(w) = app.get_webview_window(name) { let _ = w.set_icon(icon.clone()); }
                    }
                }
                let has_img = std::env::args().skip(1).any(|a| {
                    let p = std::path::Path::new(&a);
                    p.is_file() && image_loader::is_image_file(p)
                });
                if let Some(main_win) = app.get_webview_window("main") {
                    let _ = main_win.set_shadow(true);
                    if has_img {
                        let _ = main_win.set_fullscreen(true);
                        let _ = window_vibrancy::clear_acrylic(&main_win);
                    } else {
                        let _ = window_vibrancy::apply_acrylic(&main_win, tint);
                        let _ = main_win.set_maximizable(false);
                        let _ = main_win.set_resizable(false);
                    }
                }
                if let Some(w) = app.get_webview_window("settings") {
                    let _ = w.set_shadow(true);
                    let _ = window_vibrancy::apply_acrylic(&w, tint);
                }
            }
            setup_hotkeys(app);
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    if standby::is_standby_enabled() {
                        api.prevent_close();
                        let state = window.state::<StandbyManager>();
                        let _ = standby::enter_standby(window.app_handle().clone(), state);
                    } else {
                        window.app_handle().exit(0);
                    }
                }
            } else if window.label() == "settings" {
                if let tauri::WindowEvent::CloseRequested { .. } = event {
                    let _ = window.app_handle().emit("settings-modal-state", false);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_cli_args, get_initial_image, read_image_file, read_image_context, read_raw_full_sensor,
            play_windows_ding, open_url, show_in_folder, close_window, exit_app,
            prompt_save_file, prompt_open_file, save_image_bytes, read_clipboard,
            write_clipboard_image, minimize_window, toggle_maximize_window,
            is_window_maximized, unmaximize_window, set_window_maximizable, set_window_resizable, resize_and_center_window,
            start_window_resize, set_fullscreen_window, is_window_fullscreen,
            set_window_vibrancy, open_settings_window, hide_settings_window,
            download_and_install_update, get_system_arch, delete_file,
            check_association_status, register_file_associations,
            unregister_file_associations, launch_default_apps_settings,
            get_autostart_status, set_autostart_enabled,
            enter_standby, show_main_window,
            set_standby_enabled, is_standby_enabled,
            capture_screen, get_default_videos_dir, init_recording_stream,
            append_recording_chunk, finalize_recording, discard_recording,
            prompt_save_recording, prompt_select_folder, prompt_select_executable,
            launch_alitken, prepare_screen_snip, show_screen_snip, finish_screen_snip, update_global_shortcuts,
            enter_recording_pill_mode, exit_recording_pill_mode,
            show_recording_border, hide_recording_border, set_recording_border_paused,
            save_screenshot_to_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
