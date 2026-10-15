//! Bukaake Window Transition Engine
//! DWM cloaking + atomic geometry/acrylic commits for seamless Mode 1 <-> Mode 2 morphs.
//! The webview keeps painting while cloaked (`--disable-backgrounding-occluded-windows`),
//! so JS can stage the next frame before the window is revealed (< 200 lines).

use serde::Serialize;
use tauri::Manager;

#[derive(Serialize, Clone, Copy, Default)]
pub struct LogicalRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Serialize)]
pub struct MainWindowInfo {
    pub visible: bool,
    pub minimized: bool,
    pub rect: LogicalRect,
}

fn main_window(app: &tauri::AppHandle) -> Result<tauri::WebviewWindow, String> {
    app.get_webview_window("main").ok_or_else(|| "main window unavailable".to_string())
}

/// Hides/shows the window from DWM composition without changing visibility, focus or z-order.
pub fn set_cloak(win: &tauri::WebviewWindow, cloak: bool) {
    #[cfg(target_os = "windows")]
    {
        if let Ok(hwnd) = win.hwnd() {
            use windows::Win32::Foundation::{BOOL, HWND};
            use windows::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWA_CLOAK};
            let value: BOOL = cloak.into();
            unsafe {
                let _ = DwmSetWindowAttribute(
                    HWND(hwnd.0),
                    DWMWA_CLOAK,
                    &value as *const _ as *const _,
                    std::mem::size_of::<BOOL>() as u32,
                );
            }
        }
    }
    let _ = (win, cloak);
}

fn logical_rect(win: &tauri::WebviewWindow) -> LogicalRect {
    let sf = win.scale_factor().unwrap_or(1.0);
    match (win.outer_position(), win.outer_size()) {
        (Ok(p), Ok(s)) => LogicalRect {
            x: p.x as f64 / sf,
            y: p.y as f64 / sf,
            width: s.width as f64 / sf,
            height: s.height as f64 / sf,
        },
        _ => LogicalRect::default(),
    }
}

/// Physical rects (work_area, monitor) of the display monitor hosting the window.
#[cfg(target_os = "windows")]
pub fn monitor_rects(win: &tauri::WebviewWindow) -> Option<((i32, i32, i32, i32), (i32, i32, i32, i32))> {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::Graphics::Gdi::{GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST};
    let hwnd = win.hwnd().ok()?;
    unsafe {
        let hmon = MonitorFromWindow(HWND(hwnd.0), MONITOR_DEFAULTTONEAREST);
        let mut mi = MONITORINFO { cbSize: std::mem::size_of::<MONITORINFO>() as u32, ..Default::default() };
        if hmon.is_invalid() || !GetMonitorInfoW(hmon, &mut mi).as_bool() {
            return None;
        }
        let w = mi.rcWork;
        let m = mi.rcMonitor;
        Some(((w.left, w.top, w.right, w.bottom), (m.left, m.top, m.right, m.bottom)))
    }
}

/// Physical work-area rect (left, top, right, bottom) of the monitor hosting the window.
#[cfg(target_os = "windows")]
fn monitor_work_area(win: &tauri::WebviewWindow) -> Option<(i32, i32, i32, i32)> {
    monitor_rects(win).map(|(w, _)| w)
}

/// Mode 1 target rect: requested logical size centered on the current monitor's work area.
pub fn regular_target(win: &tauri::WebviewWindow, width: f64, height: f64) -> LogicalRect {
    let sf = win.scale_factor().unwrap_or(1.0);
    #[cfg(target_os = "windows")]
    {
        if let Some((l, t, r, b)) = monitor_work_area(win) {
            let (pw, ph) = (width * sf, height * sf);
            let x = l as f64 + ((r - l) as f64 - pw) / 2.0;
            let y = t as f64 + ((b - t) as f64 - ph) / 2.0;
            return LogicalRect { x: (x / sf).round(), y: (y / sf).round(), width, height };
        }
    }
    let cur = logical_rect(win);
    LogicalRect { x: cur.x, y: cur.y, width, height }
}

#[cfg(target_os = "windows")]
pub fn apply_physical_rect(win: &tauri::WebviewWindow, x: i32, y: i32, w: i32, h: i32) {
    if let Ok(hwnd) = win.hwnd() {
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::WindowsAndMessaging::{SetWindowPos, SWP_NOACTIVATE, SWP_NOZORDER};
        unsafe {
            let _ = SetWindowPos(HWND(hwnd.0), HWND::default(), x, y, w, h, SWP_NOZORDER | SWP_NOACTIVATE);
        }
    }
}

pub fn apply_rect(win: &tauri::WebviewWindow, rect: LogicalRect) {
    let sf = win.scale_factor().unwrap_or(1.0);
    let (x, y) = ((rect.x * sf).round() as i32, (rect.y * sf).round() as i32);
    let (w, h) = ((rect.width * sf).round() as i32, (rect.height * sf).round() as i32);
    #[cfg(target_os = "windows")]
    {
        apply_physical_rect(win, x, y, w, h);
        return;
    }
    #[allow(unreachable_code)]
    {
        let _ = win.set_size(tauri::Size::Physical(tauri::PhysicalSize { width: w as u32, height: h as u32 }));
        let _ = win.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
    }
}

#[tauri::command]
pub fn cloak_main_window(app: tauri::AppHandle, cloak: bool) -> Result<(), String> {
    set_cloak(&main_window(&app)?, cloak);
    Ok(())
}

#[tauri::command]
pub fn get_main_window_info(app: tauri::AppHandle) -> Result<MainWindowInfo, String> {
    let win = main_window(&app)?;
    Ok(MainWindowInfo {
        visible: win.is_visible().unwrap_or(false),
        minimized: win.is_minimized().unwrap_or(false),
        rect: logical_rect(&win),
    })
}

#[tauri::command]
pub fn get_regular_target_rect(app: tauri::AppHandle, width: f64, height: f64) -> Result<LogicalRect, String> {
    Ok(regular_target(&main_window(&app)?, width, height))
}

/// Mode 2 commit: cloak -> maximize/fullscreen -> clear acrylic (-> show + foreground when revealing).
/// When style == "fullscreen", sets always_on_top so the transparent borderless window occludes the Windows taskbar.
/// When style == "maximized", snaps borderless to work area (rcWork) without WS_MAXIMIZE to preserve taskbar translucency.
#[tauri::command]
pub fn commit_viewer_geometry(app: tauri::AppHandle, style: String, reveal: bool) -> Result<LogicalRect, String> {
    let win = main_window(&app)?;
    crate::platform::reclaim::cancel_reclaim();
    set_cloak(&win, true);
    if win.is_minimized().unwrap_or(false) {
        let _ = win.unminimize();
    }
    let sf = win.scale_factor().unwrap_or(1.0);
    let target = {
        #[cfg(target_os = "windows")]
        {
            if let Some((work, mon)) = monitor_rects(&win) {
                let (l, t, r, b) = if style == "fullscreen" { mon } else { work };
                LogicalRect {
                    x: l as f64 / sf,
                    y: t as f64 / sf,
                    width: ((r - l) as f64 / sf).round(),
                    height: ((b - t) as f64 / sf).round(),
                }
            } else {
                logical_rect(&win)
            }
        }
        #[cfg(not(target_os = "windows"))]
        logical_rect(&win)
    };

    if style == "fullscreen" {
        let _ = win.set_always_on_top(true);
        let _ = win.set_fullscreen(true);
    } else {
        let _ = win.set_always_on_top(false);
        let _ = win.set_fullscreen(false);
        let _ = win.unmaximize();
        #[cfg(target_os = "windows")]
        {
            if let Some((work, _)) = monitor_rects(&win) {
                apply_physical_rect(&win, work.0, work.1, work.2 - work.0, work.3 - work.1);
            } else {
                apply_rect(&win, target);
            }
        }
        #[cfg(not(target_os = "windows"))]
        apply_rect(&win, target);
    }
    #[cfg(target_os = "windows")]
    let _ = window_vibrancy::clear_acrylic(&win);
    if reveal {
        crate::platform::foreground::force_foreground(&win);
    }
    Ok(target)
}

/// Mode 1 commit: cloak -> leave fullscreen/maximize -> restore normal z-order -> one SetWindowPos -> theme acrylic.
#[tauri::command]
pub fn commit_regular_geometry(app: tauri::AppHandle, width: f64, height: f64, is_dark: bool) -> Result<LogicalRect, String> {
    let win = main_window(&app)?;
    set_cloak(&win, true);
    let _ = win.set_always_on_top(false);
    let _ = win.set_fullscreen(false);
    let _ = win.unmaximize();
    let target = regular_target(&win, width, height);
    apply_rect(&win, target);
    #[cfg(target_os = "windows")]
    {
        let tint = if is_dark { Some((16, 19, 28, 175)) } else { Some((245, 247, 250, 105)) };
        let _ = window_vibrancy::apply_acrylic(&win, tint);
    }
    let _ = is_dark;
    Ok(logical_rect(&win))
}

/// Final reveal: show + foreground + uncloak. Also the safety net for any stuck cloak.
#[tauri::command]
pub fn reveal_main_window(app: tauri::AppHandle) -> Result<(), String> {
    let win = main_window(&app)?;
    crate::platform::reclaim::cancel_reclaim();
    crate::platform::foreground::force_foreground(&win);
    set_cloak(&win, false);
    Ok(())
}

/// Dynamic always_on_top sync for main window (e.g. when changing settings while in Mode 2)
#[tauri::command]
pub fn set_main_always_on_top(app: tauri::AppHandle, always_on_top: bool) -> Result<(), String> {
    let win = main_window(&app)?;
    win.set_always_on_top(always_on_top).map_err(|e| e.to_string())
}
