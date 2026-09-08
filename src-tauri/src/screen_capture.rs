/**
 * Bukaake Native Windows Screen Capture Engine
 * High-performance virtual desktop screenshot capture using Win32 GDI (< 150 lines)
 */

use base64::Engine;
use image::{ImageFormat, RgbaImage};
use serde::Serialize;
use std::io::Cursor;

#[derive(Serialize)]
pub struct ScreenCapturePayload {
    pub data_url: String,
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
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

        Ok(ScreenCapturePayload {
            data_url,
            width: width as u32,
            height: height as u32,
            x,
            y,
        })
    }
}

#[cfg(not(target_os = "windows"))]
pub fn capture_desktop() -> Result<ScreenCapturePayload, String> {
    Err("Desktop screen capture is only supported on Windows".into())
}
