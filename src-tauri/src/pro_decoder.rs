use base64::prelude::*;
use image::ImageFormat;
use std::io::Cursor;
use std::path::Path;

pub const PRO_EXTS: &[&str] = &[
    "hdr", "exr", "tga", "dds", "qoi", "ppm", "pgm", "pbm", "pnm",
];

pub fn is_pro_file(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|ext| PRO_EXTS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

/// Decodes non-browser formats (TGA, HDR, EXR, DDS, QOI, PNM) using the Rust `image` crate
/// and encodes them to a high-speed PNG data URL.
pub fn decode_pro_image(path: &Path) -> Result<(String, (u32, u32)), String> {
    let img = image::open(path).map_err(|e| format!("Failed to decode image: {}", e))?;
    let dimensions = (img.width(), img.height());

    let mut buf = Cursor::new(Vec::new());
    img.write_to(&mut buf, ImageFormat::Png)
        .map_err(|e| format!("Failed to transcode to PNG: {}", e))?;

    let b64 = BASE64_STANDARD.encode(buf.into_inner());
    Ok((format!("data:image/png;base64,{}", b64), dimensions))
}
