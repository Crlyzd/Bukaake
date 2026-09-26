/**
 * Bukaake Window Subclassing Engine
 * Suppresses native resize hit-testing on frameless windows while preserving WS_THICKFRAME (< 70 lines)
 */

#[cfg(target_os = "windows")]
pub fn suppress_edge_resize(window: &tauri::WebviewWindow) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::Shell::SetWindowSubclass;

    if let Ok(hwnd) = window.hwnd() {
        unsafe {
            let win32_hwnd = HWND(hwnd.0);
            let _ = SetWindowSubclass(
                win32_hwnd,
                Some(suppress_edge_resize_subclass_proc),
                1001,
                0,
            );
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub fn suppress_edge_resize(_window: &tauri::WebviewWindow) {}

#[cfg(target_os = "windows")]
unsafe extern "system" fn suppress_edge_resize_subclass_proc(
    hwnd: windows::Win32::Foundation::HWND,
    msg: u32,
    wparam: windows::Win32::Foundation::WPARAM,
    lparam: windows::Win32::Foundation::LPARAM,
    _uid_subclass: usize,
    _ref_data: usize,
) -> windows::Win32::Foundation::LRESULT {
    use windows::Win32::Foundation::LRESULT;
    use windows::Win32::UI::Shell::DefSubclassProc;
    use windows::Win32::UI::WindowsAndMessaging::{
        HTBOTTOM, HTBOTTOMLEFT, HTBOTTOMRIGHT, HTCLIENT, HTLEFT, HTRIGHT, HTTOP, HTTOPLEFT,
        HTTOPRIGHT, SC_SIZE, WM_NCHITTEST, WM_SYSCOMMAND,
    };

    match msg {
        WM_NCHITTEST => {
            let hit = DefSubclassProc(hwnd, msg, wparam, lparam);
            match hit.0 as u32 {
                HTLEFT | HTRIGHT | HTTOP | HTBOTTOM | HTTOPLEFT | HTTOPRIGHT | HTBOTTOMLEFT
                | HTBOTTOMRIGHT => LRESULT(HTCLIENT as isize),
                _ => hit,
            }
        }
        WM_SYSCOMMAND => {
            // Suppress entering native modal sizing loop (SC_SIZE = 0xF000)
            if (wparam.0 as u32 & 0xFFF0) == SC_SIZE {
                return LRESULT(0);
            }
            DefSubclassProc(hwnd, msg, wparam, lparam)
        }
        _ => DefSubclassProc(hwnd, msg, wparam, lparam),
    }
}
