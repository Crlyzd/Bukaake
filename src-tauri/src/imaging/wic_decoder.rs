#[cfg(target_os = "windows")]
use base64::prelude::*;
#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStrExt;
use std::path::Path;

#[cfg(target_os = "windows")]
use windows::core::PCWSTR;
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::GENERIC_READ;
#[cfg(target_os = "windows")]
use windows::Win32::Graphics::Imaging::*;
#[cfg(target_os = "windows")]
use windows::Win32::System::Com::StructuredStorage::CreateStreamOnHGlobal;
#[cfg(target_os = "windows")]
use windows::Win32::System::Com::*;

/// Hardware-accelerated image decoding and in-memory transcoding using WIC.
/// Decodes HEIC via GPU (Intel QuickSync, NVDEC, AMD VCN) and pipes scanlines directly
/// into WIC's native JPEG encoder in-memory without CPU RAM flooding.
#[cfg(target_os = "windows")]
pub fn decode_wic_image(path: &Path) -> std::result::Result<(String, (u32, u32)), String> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

        let factory: IWICImagingFactory = CoCreateInstance(&CLSID_WICImagingFactory, None, CLSCTX_INPROC_SERVER)
            .map_err(|e| format!("WIC factory init failed: {}", e))?;

        let wide_path: Vec<u16> = path
            .as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let decoder = factory
            .CreateDecoderFromFilename(
                PCWSTR(wide_path.as_ptr()),
                None,
                GENERIC_READ,
                WICDecodeMetadataCacheOnDemand,
            )
            .map_err(|e| format!("WIC decoder creation failed: {}", e))?;

        let frame = decoder
            .GetFrame(0)
            .map_err(|e| format!("WIC get frame failed: {}", e))?;

        let mut width = 0;
        let mut height = 0;
        frame
            .GetSize(&mut width, &mut height)
            .map_err(|e| format!("WIC get size failed: {}", e))?;

        if width == 0 || height == 0 {
            return Err("Invalid WIC frame dimensions".to_string());
        }

        let converter = factory
            .CreateFormatConverter()
            .map_err(|e| format!("WIC create converter failed: {}", e))?;

        converter
            .Initialize(
                &frame,
                &GUID_WICPixelFormat24bppBGR,
                WICBitmapDitherTypeNone,
                None,
                0.0,
                WICBitmapPaletteTypeCustom,
            )
            .map_err(|e| format!("WIC initialize converter failed: {}", e))?;

        let stream = CreateStreamOnHGlobal(None, true)
            .map_err(|e| format!("WIC create memory stream failed: {}", e))?;

        let wic_stream = factory
            .CreateStream()
            .map_err(|e| format!("WIC create stream wrapper failed: {}", e))?;

        wic_stream
            .InitializeFromIStream(&stream)
            .map_err(|e| format!("WIC init stream failed: {}", e))?;

        let encoder = factory
            .CreateEncoder(&GUID_ContainerFormatJpeg, std::ptr::null())
            .map_err(|e| format!("WIC create JPEG encoder failed: {}", e))?;

        encoder
            .Initialize(&wic_stream, WICBitmapEncoderNoCache)
            .map_err(|e| format!("WIC init encoder failed: {}", e))?;

        let mut frame_encode = None;
        let mut prop_bag = None;
        encoder
            .CreateNewFrame(&mut frame_encode, &mut prop_bag)
            .map_err(|e| format!("WIC create new frame failed: {}", e))?;

        let frame_encode = frame_encode.ok_or_else(|| "WIC missing frame encode".to_string())?;
        frame_encode
            .Initialize(prop_bag.as_ref())
            .map_err(|e| format!("WIC init frame encode failed: {}", e))?;

        frame_encode
            .WriteSource(&converter, std::ptr::null())
            .map_err(|e| format!("WIC write source failed: {}", e))?;

        frame_encode
            .Commit()
            .map_err(|e| format!("WIC commit frame failed: {}", e))?;

        encoder
            .Commit()
            .map_err(|e| format!("WIC commit encoder failed: {}", e))?;

        let mut stat = std::mem::zeroed();
        stream
            .Stat(&mut stat, STATFLAG_NONAME)
            .map_err(|e| format!("WIC stream stat failed: {}", e))?;

        let len = stat.cbSize as usize;
        if len == 0 {
            return Err("WIC encoded empty stream".to_string());
        }

        stream
            .Seek(0, STREAM_SEEK_SET, None)
            .map_err(|e| format!("WIC stream seek failed: {}", e))?;

        let mut bytes = vec![0u8; len];
        let mut bytes_read = 0u32;
        stream
            .Read(bytes.as_mut_ptr() as *mut _, len as u32, Some(&mut bytes_read))
            .ok()
            .map_err(|e| format!("WIC stream read failed: {}", e))?;

        bytes.truncate(bytes_read as usize);
        let b64 = BASE64_STANDARD.encode(&bytes);
        Ok((format!("data:image/jpeg;base64,{}", b64), (width, height)))
    }
}

#[cfg(not(target_os = "windows"))]
pub fn decode_wic_image(_path: &Path) -> Result<(String, (u32, u32)), String> {
    Err("WIC hardware acceleration is only available on Windows".to_string())
}
