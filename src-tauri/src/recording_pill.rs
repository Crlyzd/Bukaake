/**
 * Bukaake Native Recording Pill Mode Coordinator
 * Handles resizing to compact 320x56 dock, acrylic clearance, and geometry restoration (< 115 lines)
 */

use std::sync::Mutex;
use tauri::{PhysicalPosition, PhysicalSize, Position, Size};

struct SavedWindowGeometry {
    position: PhysicalPosition<i32>,
    size: PhysicalSize<u32>,
    is_maximized: bool,
}

static SAVED_GEOMETRY: Mutex<Option<SavedWindowGeometry>> = Mutex::new(None);

#[tauri::command]
pub fn enter_recording_pill_mode(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    let win = app.get_webview_window("main").ok_or("Main window not found")?;

    let is_maximized = win.is_maximized().unwrap_or(false);
    let position = win.outer_position().unwrap_or(PhysicalPosition { x: 100, y: 100 });
    let size = win.outer_size().unwrap_or(PhysicalSize { width: 800, height: 600 });

    if let Ok(mut lock) = SAVED_GEOMETRY.lock() {
        *lock = Some(SavedWindowGeometry {
            position,
            size,
            is_maximized,
        });
    }

    if is_maximized {
        let _ = win.unmaximize();
    }

    // Force release of tauri.conf.json minWidth/minHeight (680x480)
    let _ = win.set_min_size(Some(Size::Logical(tauri::LogicalSize { width: 0.0, height: 0.0 })));

    // Clear acrylic blur to allow 100% crystal-clear transparency around the floating pill
    #[cfg(target_os = "windows")]
    let _ = window_vibrancy::clear_acrylic(&win);

    if let Ok(Some(monitor)) = win.current_monitor() {
        let screen_size = monitor.size();
        let scale = monitor.scale_factor();
        let w = (320.0 * scale) as u32;
        let h = (56.0 * scale) as u32;
        let x = screen_size.width as i32 - w as i32 - (24.0 * scale) as i32;
        let y = (50.0 * scale) as i32;

        let _ = win.set_size(Size::Physical(PhysicalSize { width: w, height: h }));
        let _ = win.set_position(Position::Physical(PhysicalPosition { x, y }));
    } else {
        let _ = win.set_size(Size::Logical(tauri::LogicalSize { width: 320.0, height: 56.0 }));
    }

    let _ = win.set_always_on_top(true);
    let _ = win.show();
    let _ = win.set_focus();
    Ok(())
}

#[tauri::command]
pub fn exit_recording_pill_mode(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    let win = app.get_webview_window("main").ok_or("Main window not found")?;

    let _ = win.set_always_on_top(false);

    let mut saved_state = None;
    if let Ok(mut lock) = SAVED_GEOMETRY.lock() {
        saved_state = lock.take();
    }

    if let Some(saved) = saved_state {
        let _ = win.set_size(Size::Physical(saved.size));
        let _ = win.set_position(Position::Physical(saved.position));
        if saved.is_maximized {
            let _ = win.maximize();
        }
    } else {
        let _ = win.set_size(Size::Logical(tauri::LogicalSize { width: 800.0, height: 600.0 }));
        let _ = win.center();
    }

    // Restore standard minimum window dimensions
    let _ = win.set_min_size(Some(Size::Logical(tauri::LogicalSize { width: 680.0, height: 480.0 })));

    // Reapply native acrylic blur for Regular App Mode (Mode 1)
    #[cfg(target_os = "windows")]
    {
        let tint = Some((16, 19, 28, 248));
        let _ = window_vibrancy::apply_acrylic(&win, tint);
    }

    let _ = win.show();
    let _ = win.set_focus();
    Ok(())
}
