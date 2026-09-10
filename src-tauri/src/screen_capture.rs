/**
 * Bukaake Native Windows Screen Capture Engine
 * High-performance virtual desktop screenshot capture using Win32 GDI (< 150 lines)
 */

use base64::Engine;
use image::{ImageFormat, RgbaImage};
use serde::Serialize;
use std::io::Cursor;

#[derive(Serialize, Clone)]
pub struct DetectedWindow {
    pub title: String,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[derive(Serialize)]
pub struct ScreenCapturePayload {
    pub data_url: String,
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
    pub windows: Vec<DetectedWindow>,
    pub was_visible: bool,
    pub was_fullscreen: bool,
    pub was_minimized: bool,
}

#[cfg(target_os = "windows")]
pub fn capture_desktop() -> Result<ScreenCapturePayload, String> {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::Graphics::Gdi::{
        BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject,
        GetDIBits, GetDC, ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER,
        BI_RGB, DIB_RGB_COLORS, SRCCOPY,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        GetSystemMetrics, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN,
        SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN,
    };

    unsafe {
        let x = GetSystemMetrics(SM_XVIRTUALSCREEN);
        let y = GetSystemMetrics(SM_YVIRTUALSCREEN);
        let width = GetSystemMetrics(SM_CXVIRTUALSCREEN);
        let height = GetSystemMetrics(SM_CYVIRTUALSCREEN);

        if width <= 0 || height <= 0 {
            return Err("Invalid virtual screen dimensions detected".into());
        }

        let desktop_hwnd = HWND::default();
        let hdc_screen = GetDC(desktop_hwnd);
        if hdc_screen.is_invalid() {
            return Err("Failed to acquire desktop display context".into());
        }

        let hdc_mem = CreateCompatibleDC(hdc_screen);
        if hdc_mem.is_invalid() {
            let _ = ReleaseDC(desktop_hwnd, hdc_screen);
            return Err("Failed to create memory device context".into());
        }

        let hbitmap = CreateCompatibleBitmap(hdc_screen, width, height);
        if hbitmap.is_invalid() {
            let _ = DeleteDC(hdc_mem);
            let _ = ReleaseDC(desktop_hwnd, hdc_screen);
            return Err("Failed to allocate compatible desktop bitmap".into());
        }

        let old_obj = SelectObject(hdc_mem, hbitmap);
        let blit_ok = BitBlt(hdc_mem, 0, 0, width, height, hdc_screen, x, y, SRCCOPY);

        if blit_ok.is_err() {
            let _ = SelectObject(hdc_mem, old_obj);
            let _ = DeleteObject(hbitmap);
            let _ = DeleteDC(hdc_mem);
            let _ = ReleaseDC(desktop_hwnd, hdc_screen);
            return Err("BitBlt screen copy operation failed".into());
        }

        let w = width as usize;
        let h = height as usize;
        let mut bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                biHeight: -height, // Top-down DIB
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            },
            ..Default::default()
        };

        let mut bgra_buffer: Vec<u8> = vec![0u8; w * h * 4];
        let lines = GetDIBits(
            hdc_mem,
            hbitmap,
            0,
            height as u32,
            Some(bgra_buffer.as_mut_ptr() as *mut _),
            &mut bmi,
            DIB_RGB_COLORS,
        );

        let _ = SelectObject(hdc_mem, old_obj);
        let _ = DeleteObject(hbitmap);
        let _ = DeleteDC(hdc_mem);
        let _ = ReleaseDC(desktop_hwnd, hdc_screen);

        if lines == 0 {
            return Err("Failed to extract bitmap bits from desktop DC".into());
        }

        // Convert BGRA to RGBA in-place with SIMD auto-vectorization
        for pixel in bgra_buffer.chunks_exact_mut(4) {
            let b = pixel[0];
            let r = pixel[2];
            pixel[0] = r;
            pixel[2] = b;
            pixel[3] = 255;
        }

        let rgba_img = RgbaImage::from_raw(width as u32, height as u32, bgra_buffer)
            .ok_or_else(|| "Failed to construct RGBA image buffer".to_string())?;

        let mut png_bytes = Cursor::new(Vec::new());
        rgba_img
            .write_to(&mut png_bytes, ImageFormat::Png)
            .map_err(|e| format!("PNG encoding failed: {}", e))?;

        let encoded = base64::engine::general_purpose::STANDARD.encode(png_bytes.into_inner());
        let data_url = format!("data:image/png;base64,{}", encoded);
        let windows = enumerate_visible_windows();

        Ok(ScreenCapturePayload {
            data_url,
            width: width as u32,
            height: height as u32,
            x,
            y,
            windows,
            was_visible: true,
            was_fullscreen: false,
            was_minimized: false,
        })
    }
}

#[cfg(target_os = "windows")]
pub fn enumerate_visible_windows() -> Vec<DetectedWindow> {
    use windows::Win32::Foundation::{BOOL, HWND, LPARAM, RECT};
    use windows::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_EXTENDED_FRAME_BOUNDS};
    use windows::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowLongW, GetWindowRect, GetWindowTextW,
        IsIconic, IsWindowVisible, IsZoomed, GWL_EXSTYLE, WS_EX_TOOLWINDOW,
    };

    struct EnumData {
        windows: Vec<DetectedWindow>,
    }

    unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let data = &mut *(lparam.0 as *mut EnumData);
        if IsWindowVisible(hwnd).as_bool() && !IsIconic(hwnd).as_bool() {
            let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE) as u32;
            if (ex_style & WS_EX_TOOLWINDOW.0) == 0 {
                let mut rect = RECT::default();
                let mut acquired = false;

                if IsZoomed(hwnd).as_bool() {
                    let mut mi = MONITORINFO {
                        cbSize: std::mem::size_of::<MONITORINFO>() as u32,
                        ..Default::default()
                    };
                    let hmon = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
                    if !hmon.is_invalid() && GetMonitorInfoW(hmon, &mut mi).as_bool() {
                        rect = mi.rcWork;
                        acquired = true;
                    }
                }

                if !acquired {
                    let dwm_res = DwmGetWindowAttribute(
                        hwnd,
                        DWMWA_EXTENDED_FRAME_BOUNDS,
                        &mut rect as *mut _ as _,
                        std::mem::size_of::<RECT>() as u32,
                    );
                    if dwm_res.is_err() {
                        let _ = GetWindowRect(hwnd, &mut rect);
                    }
                }

                let w = rect.right - rect.left;
                let h = rect.bottom - rect.top;
                if w > 120 && h > 80 {
                    let mut text_buf = [0u16; 256];
                    let len = GetWindowTextW(hwnd, &mut text_buf);
                    let title = if len > 0 {
                        String::from_utf16_lossy(&text_buf[..len as usize])
                    } else {
                        String::new()
                    };
                    if title != "Program Manager" && !title.is_empty() {
                        data.windows.push(DetectedWindow {
                            title,
                            x: rect.left,
                            y: rect.top,
                            width: w,
                            height: h,
                        });
                    }
                }
            }
        }
        BOOL(1)
    }

    let mut data = EnumData { windows: Vec::new() };
    unsafe {
        let _ = EnumWindows(Some(enum_proc), LPARAM(&mut data as *mut _ as isize));
    }
    data.windows
}

#[cfg(not(target_os = "windows"))]
pub fn capture_desktop() -> Result<ScreenCapturePayload, String> {
    Err("Desktop screen capture is only supported on Windows".into())
}
