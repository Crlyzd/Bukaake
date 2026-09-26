/**
 * Bukaake Native Recording Pill Mode Coordinator
 * Handles resizing overlay/dock to compact floating widget and acrylic-free transparency (< 110 lines)
 */

use tauri::{PhysicalPosition, PhysicalSize, Position, Size};

#[tauri::command]
pub fn enter_recording_pill_mode(app: tauri::AppHandle, width: Option<f64>) -> Result<(), String> {
    use tauri::Manager;
    let win = app.get_webview_window("snipper")
        .or_else(|| app.get_webview_window("main"))
        .ok_or("Recording overlay window not found")?;

    let _ = win.hide();
    let _ = win.set_fullscreen(false);
    let _ = win.set_min_size(Some(Size::Logical(tauri::LogicalSize { width: 0.0, height: 0.0 })));
    let _ = win.set_shadow(false);

    #[cfg(target_os = "windows")]
    {
        let _ = window_vibrancy::clear_acrylic(&win);
        if let Ok(hwnd) = win.hwnd() {
            use windows::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_ROUND};
            use windows::Win32::UI::WindowsAndMessaging::{SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE};
            let preference = DWMWCP_ROUND.0;
            let _ = unsafe {
                let _ = SetWindowDisplayAffinity(windows::Win32::Foundation::HWND(hwnd.0), WDA_EXCLUDEFROMCAPTURE);
                DwmSetWindowAttribute(
                    windows::Win32::Foundation::HWND(hwnd.0),
                    DWMWA_WINDOW_CORNER_PREFERENCE,
                    &preference as *const _ as *const _,
                    std::mem::size_of::<u32>() as u32,
                )
            };
        }
    }

    let target_w = width.unwrap_or(200.0).max(120.0);

    if let Ok(Some(monitor)) = win.current_monitor() {
        let monitor_pos = monitor.position();
        let screen_size = monitor.size();
        let scale = monitor.scale_factor();
        let w = (target_w * scale) as u32;
        let h = (36.0 * scale) as u32;
        let x = monitor_pos.x + screen_size.width as i32 - w as i32 - (24.0 * scale) as i32;
        let y = monitor_pos.y + (50.0 * scale) as i32;

        let _ = win.set_size(Size::Physical(PhysicalSize { width: w, height: h }));
        let _ = win.set_position(Position::Physical(PhysicalPosition { x, y }));
    } else {
        let _ = win.set_size(Size::Logical(tauri::LogicalSize { width: target_w, height: 36.0 }));
    }

    let _ = win.set_always_on_top(true);
    let _ = win.show();
    let _ = win.set_focus();
    Ok(())
}

#[tauri::command]
pub fn exit_recording_pill_mode(app: tauri::AppHandle, open_main: Option<bool>) -> Result<(), String> {
    use tauri::Manager;
    if let Some(snipper) = app.get_webview_window("snipper") {
        let _ = snipper.set_always_on_top(false);
        let _ = snipper.hide();
        let _ = snipper.set_fullscreen(true);

        #[cfg(target_os = "windows")]
        if let Ok(hwnd) = snipper.hwnd() {
            use windows::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_DEFAULT};
            use windows::Win32::UI::WindowsAndMessaging::{SetWindowDisplayAffinity, WDA_NONE};
            let preference = DWMWCP_DEFAULT.0;
            let _ = unsafe {
                let _ = SetWindowDisplayAffinity(windows::Win32::Foundation::HWND(hwnd.0), WDA_NONE);
                DwmSetWindowAttribute(
                    windows::Win32::Foundation::HWND(hwnd.0),
                    DWMWA_WINDOW_CORNER_PREFERENCE,
                    &preference as *const _ as *const _,
                    std::mem::size_of::<u32>() as u32,
                )
            };
        }
    }

    if open_main.unwrap_or(true) {
        if let Some(win) = app.get_webview_window("main") {
            let is_visible = win.is_visible().unwrap_or(false);
            if !is_visible {
                let _ = win.set_fullscreen(false);
                let _ = win.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 680.0, height: 480.0 }));
                #[cfg(target_os = "windows")]
                {
                    let tint = Some((16, 19, 28, 248));
                    let _ = window_vibrancy::apply_acrylic(&win, tint);
                }
            }
            let _ = win.unminimize();
            let _ = win.show();
            let _ = win.set_focus();
            #[cfg(target_os = "windows")]
            if let Ok(hwnd) = win.hwnd() {
                use windows::Win32::UI::WindowsAndMessaging::{BringWindowToTop, SetForegroundWindow};
                unsafe {
                    let _ = BringWindowToTop(windows::Win32::Foundation::HWND(hwnd.0));
                    let _ = SetForegroundWindow(windows::Win32::Foundation::HWND(hwnd.0));
                }
            }
        }
    }
    Ok(())
}
