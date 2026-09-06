#[cfg(target_os = "windows")]
use base64::prelude::*;
#[cfg(target_os = "windows")]
use image::ImageEncoder;
#[cfg(target_os = "windows")]
use std::io::Cursor;
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
use windows::Win32::System::Com::*;

/// Hardware-accelerated image decoding using the native Windows Imaging Component (WIC).
/// Utilizes dedicated GPU hardware video decoders (NVDEC, Intel QuickSync, AMD VCN)
/// when the system has the HEVC/HEIF codec installed.
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
                &GUID_WICPixelFormat32bppRGBA,
                WICBitmapDitherTypeNone,
                None,
                0.0,
                WICBitmapPaletteTypeCustom,
            )
            .map_err(|e| format!("WIC initialize converter failed: {}", e))?;

        let stride = width * 4;
        let buffer_size = (stride * height) as usize;
        let mut buffer = vec![0u8; buffer_size];

        converter
            .CopyPixels(std::ptr::null(), stride, &mut buffer)
            .map_err(|e| format!("WIC copy pixels failed: {}", e))?;

        let mut buf = Cursor::new(Vec::new());
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, 90)
            .write_image(&buffer, width, height, image::ExtendedColorType::Rgba8)
            .map_err(|e| format!("WIC transcode to JPEG failed: {}", e))?;

        let b64 = BASE64_STANDARD.encode(buf.into_inner());
        Ok((format!("data:image/jpeg;base64,{}", b64), (width, height)))
    }
}

#[cfg(not(target_os = "windows"))]
pub fn decode_wic_image(_path: &Path) -> Result<(String, (u32, u32)), String> {
    Err("WIC hardware acceleration is only available on Windows".to_string())
}
