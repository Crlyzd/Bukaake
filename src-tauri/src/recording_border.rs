/**
 * Bukaake Native Recording Border Window
 * Zero-overhead Win32 layered transparent click-through glowing frame (< 175 lines)
 */

#[cfg(target_os = "windows")]
mod win_border {
    use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};
    use std::sync::Mutex;
    use windows::core::w;
    use windows::Win32::Foundation::{COLORREF, HWND, LPARAM, LRESULT, RECT, WPARAM};
    use windows::Win32::Graphics::Dwm::{
        DwmSetWindowAttribute, DWMNCRP_DISABLED, DWMWA_NCRENDERING_POLICY,
    };
    use windows::Win32::Graphics::Gdi::{
        BeginPaint, CreateSolidBrush, DeleteObject, EndPaint, FillRect, InvalidateRect,
        PAINTSTRUCT,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DispatchMessageW, GetClientRect, GetMessageW,
        PostMessageW, RegisterClassExW, SetLayeredWindowAttributes, SetWindowPos, ShowWindow,
        HWND_TOPMOST, LWA_COLORKEY, MSG, SWP_NOACTIVATE, SWP_SHOWWINDOW, SW_HIDE,
        WNDCLASSEXW, WS_EX_LAYERED, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TOPMOST,
        WS_EX_TRANSPARENT, WS_POPUP, WM_ERASEBKGND, WM_PAINT, WM_USER,
    };

    const WM_UPDATE_RECT: u32 = WM_USER + 1;
    const WM_UPDATE_PAUSED: u32 = WM_USER + 2;
    const WM_HIDE_BORDER: u32 = WM_USER + 3;

    struct BorderRect {
        x: i32,
        y: i32,
        w: i32,
        h: i32,
    }

    static BORDER_HWND: AtomicIsize = AtomicIsize::new(0);
    static IS_PAUSED: AtomicBool = AtomicBool::new(false);
    static TARGET_RECT: Mutex<BorderRect> = Mutex::new(BorderRect { x: 0, y: 0, w: 0, h: 0 });

    unsafe extern "system" fn wnd_proc(
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        match msg {
            WM_ERASEBKGND => LRESULT(1),
            WM_PAINT => {
                let mut ps = PAINTSTRUCT::default();
                let hdc = BeginPaint(hwnd, &mut ps);
                let mut rc = RECT::default();
                let _ = GetClientRect(hwnd, &mut rc);

                // Paint key transparent background (black RGB 0,0,0)
                let black_brush = CreateSolidBrush(COLORREF(0x00000000));
                FillRect(hdc, &rc, black_brush);
                let _ = DeleteObject(black_brush);

                // Border color: Soft Ruby Red (0x003333cc BGR) or Amber (0x000b9ef5 BGR)
                let border_bgr = if IS_PAUSED.load(Ordering::Relaxed) {
                    COLORREF(0x000b9ef5)
                } else {
                    COLORREF(0x003333cc)
                };
                let border_brush = CreateSolidBrush(border_bgr);

                let bw = 2;
                let w = rc.right - rc.left;
                let h = rc.bottom - rc.top;

                // 4 border strips
                let top_r = RECT { left: 0, top: 0, right: w, bottom: bw };
                let bot_r = RECT { left: 0, top: h - bw, right: w, bottom: h };
                let left_r = RECT { left: 0, top: bw, right: bw, bottom: h - bw };
                let right_r = RECT { left: w - bw, top: bw, right: w, bottom: h - bw };

                FillRect(hdc, &top_r, border_brush);
                FillRect(hdc, &bot_r, border_brush);
                FillRect(hdc, &left_r, border_brush);
                FillRect(hdc, &right_r, border_brush);

                let _ = DeleteObject(border_brush);
                let _ = EndPaint(hwnd, &ps);
                LRESULT(0)
            }
            WM_UPDATE_RECT => {
                if let Ok(guard) = TARGET_RECT.lock() {
                    let _ = SetWindowPos(
                        hwnd,
                        HWND_TOPMOST,
                        guard.x,
                        guard.y,
                        guard.w,
                        guard.h,
                        SWP_NOACTIVATE | SWP_SHOWWINDOW,
                    );
                }
                let _ = InvalidateRect(hwnd, None, false);
                LRESULT(0)
            }
            WM_UPDATE_PAUSED => {
                let _ = InvalidateRect(hwnd, None, false);
                LRESULT(0)
            }
            WM_HIDE_BORDER => {
                let _ = ShowWindow(hwnd, SW_HIDE);
                LRESULT(0)
            }
            _ => DefWindowProcW(hwnd, msg, wparam, lparam),
        }
    }

    fn ensure_window() {
        if BORDER_HWND.load(Ordering::SeqCst) != 0 {
            return;
        }

        std::thread::spawn(|| unsafe {
            let class_name = w!("BukaakeRecordingBorderClass");
            let wnd_class = WNDCLASSEXW {
                cbSize: std::mem::size_of::<WNDCLASSEXW>() as u32,
                lpfnWndProc: Some(wnd_proc),
                lpszClassName: class_name,
                ..Default::default()
            };
            let _ = RegisterClassExW(&wnd_class);

            let ex_style = WS_EX_LAYERED
                | WS_EX_TRANSPARENT
                | WS_EX_TOPMOST
                | WS_EX_TOOLWINDOW
                | WS_EX_NOACTIVATE;

            let hwnd = CreateWindowExW(
                ex_style,
                class_name,
                w!("BukaakeRecordingBorder"),
                WS_POPUP,
                0,
                0,
                100,
                100,
                None,
                None,
                None,
                None,
            );

            if let Ok(valid_hwnd) = hwnd {
                let _ = SetLayeredWindowAttributes(valid_hwnd, COLORREF(0x00000000), 0, LWA_COLORKEY);
                let policy = DWMNCRP_DISABLED.0 as u32;
                let _ = DwmSetWindowAttribute(
                    valid_hwnd,
                    DWMWA_NCRENDERING_POLICY,
                    &policy as *const _ as _,
                    std::mem::size_of::<u32>() as u32,
                );
                BORDER_HWND.store(valid_hwnd.0 as isize, Ordering::SeqCst);

                let mut msg = MSG::default();
                while GetMessageW(&mut msg, None, 0, 0).as_bool() {
                    let _ = DispatchMessageW(&msg);
                }
            }
        });

        // Small wait for window handle readiness
        for _ in 0..20 {
            if BORDER_HWND.load(Ordering::SeqCst) != 0 {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(5));
        }
    }

    pub fn show(x: i32, y: i32, w: u32, h: u32) {
        ensure_window();
        if let Ok(mut guard) = TARGET_RECT.lock() {
            guard.x = x;
            guard.y = y;
            guard.w = w as i32;
            guard.h = h as i32;
        }
        let raw = BORDER_HWND.load(Ordering::SeqCst);
        if raw != 0 {
            unsafe {
                let _ = PostMessageW(HWND(raw as *mut _), WM_UPDATE_RECT, WPARAM(0), LPARAM(0));
            }
        }
    }

    pub fn hide() {
        let raw = BORDER_HWND.load(Ordering::SeqCst);
        if raw != 0 {
            unsafe {
                let _ = PostMessageW(HWND(raw as *mut _), WM_HIDE_BORDER, WPARAM(0), LPARAM(0));
            }
        }
    }

    pub fn set_paused(paused: bool) {
        IS_PAUSED.store(paused, Ordering::Relaxed);
        let raw = BORDER_HWND.load(Ordering::SeqCst);
        if raw != 0 {
            unsafe {
                let _ = PostMessageW(HWND(raw as *mut _), WM_UPDATE_PAUSED, WPARAM(0), LPARAM(0));
            }
        }
    }
}

#[tauri::command]
pub fn show_recording_border(x: i32, y: i32, width: u32, height: u32) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    win_border::show(x, y, width, height);
    Ok(())
}

#[tauri::command]
pub fn hide_recording_border() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    win_border::hide();
    Ok(())
}

#[tauri::command]
pub fn set_recording_border_paused(paused: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    win_border::set_paused(paused);
    Ok(())
}
