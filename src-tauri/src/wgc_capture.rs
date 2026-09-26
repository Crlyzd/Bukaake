/**
 * Bukaake Windows.Graphics.Capture Session Engine
 * VSync-locked desktop monitor & region capture straight to Direct3D 11 textures (< 230 lines)
 */

use windows::core::{Interface, Result};
use windows::Graphics::Capture::{Direct3D11CaptureFramePool, GraphicsCaptureItem, GraphicsCaptureSession};
use windows::Graphics::DirectX::DirectXPixelFormat;
use windows::Win32::Foundation::POINT;
use windows::Win32::Graphics::Direct3D11::ID3D11Texture2D;
use windows::Win32::Graphics::Gdi::{HMONITOR, MonitorFromPoint, MONITOR_DEFAULTTOPRIMARY};
use windows::Win32::System::WinRT::Direct3D11::IDirect3DDxgiInterfaceAccess;
use windows::Win32::System::WinRT::Graphics::Capture::IGraphicsCaptureItemInterop;
use std::sync::Arc;
use crate::d3d_device::D3DContext;

pub struct WgcFrame {
    pub texture: ID3D11Texture2D,
    pub width: u32,
    pub height: u32,
    pub time_qpc: i64,
}

pub struct WgcCaptureSession {
    session: GraphicsCaptureSession,
    frame_pool: Direct3D11CaptureFramePool,
    pub width: u32,
    pub height: u32,
}

unsafe impl Send for WgcCaptureSession {}
unsafe impl Sync for WgcCaptureSession {}

impl WgcCaptureSession {
    pub fn get_target_monitor_size(hmonitor_opt: Option<isize>) -> Result<(u32, u32)> {
        let hmon = if let Some(raw) = hmonitor_opt {
            HMONITOR(raw as *mut std::ffi::c_void)
        } else {
            let pt = POINT { x: 0, y: 0 };
            unsafe { MonitorFromPoint(pt, MONITOR_DEFAULTTOPRIMARY) }
        };
        let interop = windows::core::factory::<GraphicsCaptureItem, IGraphicsCaptureItemInterop>()?;
        let item: GraphicsCaptureItem = unsafe { interop.CreateForMonitor(hmon)? };
        let size = item.Size()?;
        Ok((size.Width as u32, size.Height as u32))
    }

    pub fn new<F>(
        d3d: &D3DContext,
        hmonitor_opt: Option<isize>,
        enable_cursor: bool,
        on_frame: F,
    ) -> Result<Self>
    where
        F: Fn(WgcFrame) + Send + Sync + 'static,
    {
        // 1. Resolve HMONITOR (primary display by default)
        let hmon = if let Some(raw) = hmonitor_opt {
            HMONITOR(raw as *mut std::ffi::c_void)
        } else {
            let pt = POINT { x: 0, y: 0 };
            unsafe { MonitorFromPoint(pt, MONITOR_DEFAULTTOPRIMARY) }
        };

        // 2. Create GraphicsCaptureItem for the target monitor
        let interop = windows::core::factory::<GraphicsCaptureItem, IGraphicsCaptureItemInterop>()?;
        let item: GraphicsCaptureItem = unsafe { interop.CreateForMonitor(hmon)? };
        let size = item.Size()?;
        let width = size.Width as u32;
        let height = size.Height as u32;

        // 3. Create FreeThreaded FramePool (B8G8R8A8 is the universally supported format for WGC)
        let frame_pool = Direct3D11CaptureFramePool::CreateFreeThreaded(
            &d3d.winrt_device,
            DirectXPixelFormat::B8G8R8A8UIntNormalized,
            2,
            size,
        )?;

        // 4. Hook FrameArrived event
        let frame_callback = Arc::new(on_frame);
        frame_pool.FrameArrived(&windows::Foundation::TypedEventHandler::new({
            let cb = frame_callback.clone();
            move |pool: &Option<Direct3D11CaptureFramePool>, _| {
                if let Some(pool) = pool {
                    match pool.TryGetNextFrame() {
                        Ok(frame) => {
                            match frame.Surface() {
                                Ok(surface) => {
                                    match surface.cast::<IDirect3DDxgiInterfaceAccess>() {
                                        Ok(access) => {
                                            match unsafe { access.GetInterface::<ID3D11Texture2D>() } {
                                                Ok(texture) => {
                                                    let content_size = frame.ContentSize().unwrap_or(size);
                                                    let time_qpc = frame.SystemRelativeTime().map(|d| d.Duration).unwrap_or(0);
                                                    cb(WgcFrame {
                                                        texture,
                                                        width: content_size.Width as u32,
                                                        height: content_size.Height as u32,
                                                        time_qpc,
                                                    });
                                                }
                                                Err(e) => eprintln!("[WGC] GetInterface<ID3D11Texture2D> failed: {e}"),
                                            }
                                        }
                                        Err(e) => eprintln!("[WGC] cast<IDirect3DDxgiInterfaceAccess> failed: {e}"),
                                    }
                                }
                                Err(e) => eprintln!("[WGC] frame.Surface() failed: {e}"),
                            }
                        }
                        Err(e) => eprintln!("[WGC] TryGetNextFrame failed: {e}"),
                    }
                }
                Ok(())
            }
        }))?;

        // 5. Initialize & Start Capture Session
        let session = frame_pool.CreateCaptureSession(&item)?;
        let _ = session.SetIsCursorCaptureEnabled(enable_cursor);
        let _ = session.SetIsBorderRequired(false);
        session.StartCapture()?;

        Ok(Self {
            session,
            frame_pool,
            width,
            height,
        })
    }

    pub fn stop(&self) {
        let _ = self.session.Close();
        let _ = self.frame_pool.Close();
    }
}

impl Drop for WgcCaptureSession {
    fn drop(&mut self) {
        self.stop();
    }
}
