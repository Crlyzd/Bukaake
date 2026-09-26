/**
 * Bukaake Direct3D 11 & DXGI Context Engine
 * Manages GPU device initialization, WinRT interop, and hardware subresource cropping (< 200 lines)
 */

use windows::core::{Interface, Result};
use windows::Graphics::DirectX::Direct3D11::IDirect3DDevice;
use windows::Win32::Graphics::Direct3D::{
    D3D_DRIVER_TYPE_HARDWARE, D3D_DRIVER_TYPE_WARP,
    D3D_FEATURE_LEVEL_11_0, D3D_FEATURE_LEVEL_11_1,
};
use windows::Win32::Graphics::Direct3D11::{
    D3D11CreateDevice, ID3D11Device, ID3D11DeviceContext, ID3D11Multithread,
    ID3D11Texture2D, D3D11_BIND_FLAG,
    D3D11_BOX, D3D11_CREATE_DEVICE_BGRA_SUPPORT,
    D3D11_SDK_VERSION, D3D11_TEXTURE2D_DESC, D3D11_USAGE_DEFAULT,
};
use windows::Win32::Graphics::Dxgi::Common::{DXGI_FORMAT, DXGI_SAMPLE_DESC};
use windows::Win32::Graphics::Dxgi::IDXGIDevice;
use windows::Win32::Media::MediaFoundation::{MFCreateDXGIDeviceManager, IMFDXGIDeviceManager};
use windows::Win32::System::WinRT::Direct3D11::CreateDirect3D11DeviceFromDXGIDevice;

pub struct D3DContext {
    pub device: ID3D11Device,
    pub context: ID3D11DeviceContext,
    pub winrt_device: IDirect3DDevice,
    pub dxgi_manager: IMFDXGIDeviceManager,
    pub reset_token: u32,
}

// Safety: Direct3D 11 device is configured with multithread protection enabled
unsafe impl Send for D3DContext {}
unsafe impl Sync for D3DContext {}

impl D3DContext {
    pub fn new() -> Result<Self> {
        let feature_levels = [D3D_FEATURE_LEVEL_11_1, D3D_FEATURE_LEVEL_11_0];
        let mut chosen_level = D3D_FEATURE_LEVEL_11_0;
        let mut d3d_device: Option<ID3D11Device> = None;
        let mut d3d_context: Option<ID3D11DeviceContext> = None;

        let flags = D3D11_CREATE_DEVICE_BGRA_SUPPORT;

        // 1. Try Hardware Driver first
        let hr = unsafe {
            D3D11CreateDevice(
                None,
                D3D_DRIVER_TYPE_HARDWARE,
                None,
                flags,
                Some(&feature_levels),
                D3D11_SDK_VERSION,
                Some(&mut d3d_device),
                Some(&mut chosen_level),
                Some(&mut d3d_context),
            )
        };

        // Fallback to WARP software driver if hardware D3D11 is unavailable (e.g. VMs)
        if hr.is_err() || d3d_device.is_none() {
            unsafe {
                D3D11CreateDevice(
                    None,
                    D3D_DRIVER_TYPE_WARP,
                    None,
                    flags,
                    Some(&feature_levels),
                    D3D11_SDK_VERSION,
                    Some(&mut d3d_device),
                    Some(&mut chosen_level),
                    Some(&mut d3d_context),
                )?;
            }
        }

        let device = d3d_device.expect("Direct3D 11 device creation failed");
        let context = d3d_context.expect("Direct3D 11 context creation failed");

        // 2. Enable multithread protection for safe cross-thread capture & encoding
        if let Ok(multithread) = device.cast::<ID3D11Multithread>() {
            unsafe {
                let _ = multithread.SetMultithreadProtected(true);
            }
        }

        // 3. Create WinRT IDirect3DDevice interop for Windows.Graphics.Capture
        let dxgi_device: IDXGIDevice = device.cast()?;
        let inspectable = unsafe { CreateDirect3D11DeviceFromDXGIDevice(&dxgi_device)? };
        let winrt_device: IDirect3DDevice = inspectable.cast()?;

        // 4. Create IMFDXGIDeviceManager for Media Foundation hardware transforms
        let mut reset_token = 0u32;
        let mut dxgi_manager_opt: Option<IMFDXGIDeviceManager> = None;
        unsafe {
            MFCreateDXGIDeviceManager(&mut reset_token, &mut dxgi_manager_opt)?;
        }
        let dxgi_manager = dxgi_manager_opt.expect("DXGI Device Manager creation failed");
        unsafe {
            dxgi_manager.ResetDevice(&device, reset_token)?;
        }

        Ok(Self {
            device,
            context,
            winrt_device,
            dxgi_manager,
            reset_token,
        })
    }

    pub fn create_texture(
        &self,
        width: u32,
        height: u32,
        format: DXGI_FORMAT,
        bind_flags: D3D11_BIND_FLAG,
    ) -> Result<ID3D11Texture2D> {
        let desc = D3D11_TEXTURE2D_DESC {
            Width: width,
            Height: height,
            MipLevels: 1,
            ArraySize: 1,
            Format: format,
            SampleDesc: DXGI_SAMPLE_DESC {
                Count: 1,
                Quality: 0,
            },
            Usage: D3D11_USAGE_DEFAULT,
            BindFlags: bind_flags.0 as u32,
            CPUAccessFlags: 0,
            MiscFlags: 0,
        };

        let mut texture: Option<ID3D11Texture2D> = None;
        unsafe {
            self.device
                .CreateTexture2D(&desc, None, Some(&mut texture))?;
        }
        Ok(texture.expect("Failed to create texture 2D"))
    }

    pub fn crop_subresource(
        &self,
        src: &ID3D11Texture2D,
        dst: &ID3D11Texture2D,
        x: u32,
        y: u32,
        w: u32,
        h: u32,
    ) {
        let crop_box = D3D11_BOX {
            left: x & !1,
            top: y & !1,
            front: 0,
            right: (x + w) & !1,
            bottom: (y + h) & !1,
            back: 1,
        };
        unsafe {
            self.context
                .CopySubresourceRegion(dst, 0, 0, 0, 0, src, 0, Some(&crop_box));
        }
    }
}
