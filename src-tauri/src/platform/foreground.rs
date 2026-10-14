//! Bukaake Foreground Activation Helper
//! Defeats the Windows foreground lock so Explorer-launched opens reliably surface
//! the main window above other apps instead of flashing the taskbar (< 80 lines).

/// Grants any process permission to take the foreground.
/// Called first in `main()`: the short-lived secondary instance spawned by Explorer
/// owns foreground rights and hands them to the primary instance before forwarding argv.
#[cfg(target_os = "windows")]
pub fn allow_any_foreground() {
    use windows::Win32::UI::WindowsAndMessaging::{AllowSetForegroundWindow, ASFW_ANY};
    unsafe {
        let _ = AllowSetForegroundWindow(ASFW_ANY);
    }
}

#[cfg(not(target_os = "windows"))]
pub fn allow_any_foreground() {}

/// Restores, shows and raises a window to the foreground.
/// Falls back to AttachThreadInput when SetForegroundWindow is rejected by the lock.
pub fn force_foreground(win: &tauri::WebviewWindow) {
    if win.is_minimized().unwrap_or(false) {
        let _ = win.unminimize();
    }
    let _ = win.show();

    #[cfg(target_os = "windows")]
    {
        if let Ok(hwnd) = win.hwnd() {
            use windows::Win32::Foundation::{BOOL, HWND};
            use windows::Win32::System::Threading::{AttachThreadInput, GetCurrentThreadId};
            use windows::Win32::UI::WindowsAndMessaging::{
                BringWindowToTop, GetForegroundWindow, GetWindowThreadProcessId, SetForegroundWindow,
            };
            unsafe {
                let target = HWND(hwnd.0);
                if SetForegroundWindow(target).as_bool() {
                    let _ = BringWindowToTop(target);
                } else {
                    let fg_thread = GetWindowThreadProcessId(GetForegroundWindow(), None);
                    let cur_thread = GetCurrentThreadId();
                    if fg_thread != 0 && fg_thread != cur_thread {
                        let _ = AttachThreadInput(cur_thread, fg_thread, BOOL::from(true));
                        let _ = BringWindowToTop(target);
                        let _ = SetForegroundWindow(target);
                        let _ = AttachThreadInput(cur_thread, fg_thread, BOOL::from(false));
                    }
                }
            }
        }
    }

    let _ = win.set_focus();
}
