/**
 * Bukaake Native Click Ripple Overlay Window
 * Zero-overhead Win32 layered transparent window rendering stroke-free halos (< 240 lines)
 */

#[cfg(target_os = "windows")]
mod win_overlay {
    use std::sync::atomic::{AtomicIsize, Ordering};
    use std::sync::Mutex;
    use std::time::Instant;
    use windows::core::w;
    use windows::Win32::Foundation::{COLORREF, HWND, LPARAM, LRESULT, RECT, WPARAM};
    use windows::Win32::Graphics::Gdi::{
        BeginPaint, BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, CreatePen,
        CreateSolidBrush, DeleteDC, DeleteObject, Ellipse, EndPaint, FillRect,
        GetStockObject, InvalidateRect, SelectObject, SetBkMode,
        NULL_BRUSH, PAINTSTRUCT, PS_SOLID, SRCCOPY, TRANSPARENT,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DispatchMessageW, GetMessageW,
        KillTimer, PostMessageW, RegisterClassExW, SetLayeredWindowAttributes,
        SetTimer, SetWindowPos, ShowWindow, GetSystemMetrics,
        HWND_TOPMOST, LWA_COLORKEY, MSG, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN,
        SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN, SWP_NOACTIVATE, SWP_SHOWWINDOW,
        SW_HIDE, SW_SHOWNOACTIVATE, WNDCLASSEXW, WS_EX_LAYERED, WS_EX_NOACTIVATE,
        WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_EX_TRANSPARENT, WS_POPUP,
        WM_ERASEBKGND, WM_PAINT, WM_TIMER, WM_USER,
    };

    const WM_TRIGGER_RIPPLE: u32 = WM_USER + 10;
    const WM_HIDE_OVERLAY: u32 = WM_USER + 11;
    const TIMER_ID: usize = 1001;

    struct Ripple {
        x: i32,
        y: i32,
        is_right: bool,
        start: Instant,
    }

    static OVERLAY_HWND: AtomicIsize = AtomicIsize::new(0);
    static ACTIVE_RIPPLES: Mutex<Vec<Ripple>> = Mutex::new(Vec::new());

    unsafe extern "system" fn wnd_proc(
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        match msg {
            WM_ERASEBKGND => LRESULT(1),
            WM_TIMER => {
                if wparam.0 == TIMER_ID {
                    let mut should_kill = false;
                    if let Ok(mut ripples) = ACTIVE_RIPPLES.lock() {
                        ripples.retain(|r| r.start.elapsed().as_millis() < 260);
                        if ripples.is_empty() {
                            should_kill = true;
                        }
                    }
                    if should_kill {
                        let _ = KillTimer(hwnd, TIMER_ID);
                    }
                    let _ = InvalidateRect(hwnd, None, false);
                }
                LRESULT(0)
            }
            WM_PAINT => {
                let mut ps = PAINTSTRUCT::default();
                let hdc = BeginPaint(hwnd, &mut ps);

                let vx = GetSystemMetrics(SM_XVIRTUALSCREEN);
                let vy = GetSystemMetrics(SM_YVIRTUALSCREEN);
                let vw = GetSystemMetrics(SM_CXVIRTUALSCREEN);
                let vh = GetSystemMetrics(SM_CYVIRTUALSCREEN);

                // Double buffered rendering to eliminate flicker
                let mem_dc = CreateCompatibleDC(hdc);
                let mem_bmp = CreateCompatibleBitmap(hdc, vw, vh);
                let old_bmp = SelectObject(mem_dc, mem_bmp);

                // Black (0x00000000) key color is completely transparent
                let black_brush = CreateSolidBrush(COLORREF(0));
                let full_rc = RECT { left: 0, top: 0, right: vw, bottom: vh };
                FillRect(mem_dc, &full_rc, black_brush);
                let _ = DeleteObject(black_brush);

                SetBkMode(mem_dc, TRANSPARENT);
                let null_brush = GetStockObject(NULL_BRUSH);
                let old_brush = SelectObject(mem_dc, null_brush);

                if let Ok(ripples) = ACTIVE_RIPPLES.lock() {
                    for r in ripples.iter() {
                        let elapsed_ms = r.start.elapsed().as_millis() as f32;
                        let progress = (elapsed_ms / 250.0).clamp(0.0, 1.0);
                        let local_x = r.x - vx;
                        let local_y = r.y - vy;

                        // Multi-tier ambient halo: outer soft ring + inner radiant core
                        let outer_radius = (10.0 + 32.0 * progress) as i32;
                        let inner_radius = (6.0 + 18.0 * progress) as i32;

                        // Amber: 0x000b9ef5 (BGR for #f59e0b) | Sky: 0x00f8bd38 (BGR for #38bdf8)
                        let color_bgr = if r.is_right {
                            COLORREF(0x00f8bd38)
                        } else {
                            COLORREF(0x000b9ef5)
                        };

                        // Outer halo ring (2px)
                        let pen_outer = CreatePen(PS_SOLID, 2, color_bgr);
                        let old_pen = SelectObject(mem_dc, pen_outer);
                        let _ = Ellipse(
                            mem_dc,
                            local_x - outer_radius,
                            local_y - outer_radius,
                            local_x + outer_radius,
                            local_y + outer_radius,
                        );

                        // Inner halo ring (3px) if early in animation
                        if progress < 0.75 {
                            let pen_inner = CreatePen(PS_SOLID, 3, color_bgr);
                            let _ = SelectObject(mem_dc, pen_inner);
                            let _ = Ellipse(
                                mem_dc,
                                local_x - inner_radius,
                                local_y - inner_radius,
                                local_x + inner_radius,
                                local_y + inner_radius,
                            );
                            let _ = SelectObject(mem_dc, old_pen);
                            let _ = DeleteObject(pen_inner);
                        } else {
                            let _ = SelectObject(mem_dc, old_pen);
                        }
                        let _ = DeleteObject(pen_outer);
                    }
                }

                let _ = BitBlt(hdc, 0, 0, vw, vh, mem_dc, 0, 0, SRCCOPY);

                let _ = SelectObject(mem_dc, old_brush);
                let _ = SelectObject(mem_dc, old_bmp);
                let _ = DeleteObject(mem_bmp);
                let _ = DeleteDC(mem_dc);

                let _ = EndPaint(hwnd, &ps);
                LRESULT(0)
            }
            WM_TRIGGER_RIPPLE => {
                let x = (lparam.0 & 0xFFFF) as i16 as i32;
                let y = ((lparam.0 >> 16) & 0xFFFF) as i16 as i32;
                let is_right = wparam.0 != 0;

                if let Ok(mut ripples) = ACTIVE_RIPPLES.lock() {
                    ripples.push(Ripple {
                        x,
                        y,
                        is_right,
                        start: Instant::now(),
                    });
                }

                let _ = SetTimer(hwnd, TIMER_ID, 16, None);
                let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE);
                let _ = InvalidateRect(hwnd, None, false);
                LRESULT(0)
            }
            WM_HIDE_OVERLAY => {
                let _ = KillTimer(hwnd, TIMER_ID);
                if let Ok(mut ripples) = ACTIVE_RIPPLES.lock() {
                    ripples.clear();
                }
                let _ = ShowWindow(hwnd, SW_HIDE);
                LRESULT(0)
            }
            _ => DefWindowProcW(hwnd, msg, wparam, lparam),
        }
    }

    fn ensure_overlay_window() {
        if OVERLAY_HWND.load(Ordering::SeqCst) != 0 {
            return;
        }

        std::thread::spawn(|| unsafe {
            let class_name = w!("BukaakeClickOverlayClass");
            let wnd_class = WNDCLASSEXW {
                cbSize: std::mem::size_of::<WNDCLASSEXW>() as u32,
                lpfnWndProc: Some(wnd_proc),
                lpszClassName: class_name,
                ..Default::default()
            };
            let _ = RegisterClassExW(&wnd_class);

            let vx = GetSystemMetrics(SM_XVIRTUALSCREEN);
            let vy = GetSystemMetrics(SM_YVIRTUALSCREEN);
            let vw = GetSystemMetrics(SM_CXVIRTUALSCREEN);
            let vh = GetSystemMetrics(SM_CYVIRTUALSCREEN);

            let ex_style = WS_EX_LAYERED
                | WS_EX_TRANSPARENT
                | WS_EX_TOPMOST
                | WS_EX_TOOLWINDOW
                | WS_EX_NOACTIVATE;

            let hwnd = CreateWindowExW(
                ex_style,
                class_name,
                w!("BukaakeClickOverlay"),
                WS_POPUP,
                vx,
                vy,
                vw,
                vh,
                None,
                None,
                None,
                None,
            )
            .unwrap_or(HWND::default());

            if !hwnd.0.is_null() {
                // Key black 0x00000000 as completely transparent
                let _ = SetLayeredWindowAttributes(hwnd, COLORREF(0), 0, LWA_COLORKEY);
                let _ = SetWindowPos(
                    hwnd,
                    HWND_TOPMOST,
                    vx,
                    vy,
                    vw,
                    vh,
                    SWP_NOACTIVATE | SWP_SHOWWINDOW,
                );
                OVERLAY_HWND.store(hwnd.0 as isize, Ordering::SeqCst);

                let mut msg = MSG::default();
                while GetMessageW(&mut msg, HWND::default(), 0, 0).as_bool() {
                    let _ = DispatchMessageW(&msg);
                }
            }
        });

        // Wait brief spin for window creation
        for _ in 0..20 {
            if OVERLAY_HWND.load(Ordering::SeqCst) != 0 {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(5));
        }
    }

    pub fn trigger_click_ripple(x: i32, y: i32, is_right: bool) {
        ensure_overlay_window();
        let raw = OVERLAY_HWND.load(Ordering::SeqCst);
        if raw != 0 {
            let hwnd = HWND(raw as *mut std::ffi::c_void);
            let packed_coords = ((y as u32 & 0xFFFF) << 16) | (x as u32 & 0xFFFF);
            unsafe {
                let _ = PostMessageW(
                    hwnd,
                    WM_TRIGGER_RIPPLE,
                    WPARAM(if is_right { 1 } else { 0 }),
                    LPARAM(packed_coords as isize),
                );
            }
        }
    }

    pub fn hide_click_overlay() {
        let raw = OVERLAY_HWND.load(Ordering::SeqCst);
        if raw != 0 {
            let hwnd = HWND(raw as *mut std::ffi::c_void);
            unsafe {
                let _ = PostMessageW(hwnd, WM_HIDE_OVERLAY, WPARAM(0), LPARAM(0));
            }
        }
    }
}

#[cfg(target_os = "windows")]
pub use win_overlay::*;

#[cfg(not(target_os = "windows"))]
pub fn trigger_click_ripple(_x: i32, _y: i32, _is_right: bool) {}

#[cfg(not(target_os = "windows"))]
pub fn hide_click_overlay() {}
