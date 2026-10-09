use crate::imaging::exif_reader::{self, ExifPayload};
use crate::imaging::heif_reader;
use crate::imaging::pro_decoder;
use crate::imaging::raw_reader;
use base64::prelude::*;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

pub use crate::platform::file_assoc::SUPPORTED_EXTENSIONS as SUPPORTED_EXTS;

pub use crate::imaging::neighbor_scanner::NeighborInfo;

#[derive(Debug, Serialize)]
pub struct InitialImagePayload {
    pub target_path: String,
    pub file_name: String,
    pub parent_dir: String,
    pub neighbors: Vec<NeighborInfo>,
    pub current_index: usize,
    pub data_url: String,
    pub size_bytes: u64,
    pub decoded_size_bytes: u64,
    pub dimensions: Option<(u32, u32)>,
    pub mime_type: String,
    pub last_modified: Option<u64>,
    pub exif: Option<ExifPayload>,
}

#[derive(Debug, Serialize)]
pub struct ImagePayload {
    pub path: String,
    pub file_name: String,
    pub data_url: String,
    pub size_bytes: u64,
    pub decoded_size_bytes: u64,
    pub dimensions: Option<(u32, u32)>,
    pub mime_type: String,
    pub last_modified: Option<u64>,
    pub exif: Option<ExifPayload>,
}

pub fn is_image_file(path: &Path) -> bool {
    if !path.is_file() {
        return false;
    }
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| SUPPORTED_EXTS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

pub fn get_mime_type(ext: &str) -> &'static str {
    match ext.to_lowercase().as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "bmp" => "image/bmp",
        "ico" => "image/x-icon",
        "tiff" | "tif" => "image/tiff",
        "svg" => "image/svg+xml",
        "avif" => "image/avif",
        "heic" | "heif" | "hif" | "heifs" | "heics" => "image/heic",
        "hdr" => "image/vnd.radiance",
        "exr" => "image/x-exr",
        "tga" => "image/x-tga",
        "dds" => "image/vnd.ms-dds",
        "qoi" => "image/qoi",
        "arw" | "srf" | "sr2" => "image/x-sony-arw",
        "cr2" | "cr3" => "image/x-canon-raw",
        "nef" | "nrw" => "image/x-nikon-nef",
        "dng" => "image/x-adobe-dng",
        "raf" => "image/x-fuji-raf",
        "rw2" | "raw" => "image/x-panasonic-raw",
        "orf" => "image/x-olympus-orf",
        "pef" => "image/x-pentax-pef",
        "mrw" => "image/x-minolta-mrw",
        "srw" => "image/x-samsung-srw",
        "x3f" => "image/x-sigma-x3f",
        "mos" | "mef" => "image/x-raw",
        "kdc" | "dcr" => "image/x-kodak-raw",
        "rwl" => "image/x-leica-rwl",
        "iiq" => "image/x-phaseone-iiq",
        "erf" => "image/x-epson-erf",
        _ => "application/octet-stream",
    }
}

pub fn file_to_data_url(path: &Path) -> Result<(String, Option<(u32, u32)>), String> {
    if raw_reader::is_raw_file(path) {
        if let Ok((u, d)) = raw_reader::decode_raw_image(path) { return Ok((u, Some(d))); }
    }
    if heif_reader::is_heif_file(path) {
        if let Ok((u, d)) = heif_reader::decode_heif_image(path) { return Ok((u, Some(d))); }
    }
    if pro_decoder::is_pro_file(path) {
        if let Ok((u, d)) = pro_decoder::decode_pro_image(path) { return Ok((u, Some(d))); }
    }

    let bytes = fs::read(path).map_err(|e| format!("Failed to read image file: {}", e))?;
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("png");
    let mime = get_mime_type(ext);
    let b64 = BASE64_STANDARD.encode(&bytes);
    Ok((format!("data:{};base64,{}", mime, b64), None))
}

struct ImageFileInfo {
    data_url: String,
    size_bytes: u64,
    decoded_size_bytes: u64,
    last_modified: Option<u64>,
    mime_type: String,
    dimensions: Option<(u32, u32)>,
    exif: Option<ExifPayload>,
}

fn gather_file_info(path: &Path) -> Result<ImageFileInfo, String> {
    let (data_url, pro_dims) = file_to_data_url(path)?;
    let metadata = fs::metadata(path).ok();
    let size_bytes = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
    let decoded_size_bytes = (data_url.len() * 3 / 4) as u64;
    let last_modified = metadata
        .as_ref()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64);
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("png");
    let mime_type = get_mime_type(ext).to_string();
    let dimensions = pro_dims.or_else(|| image::image_dimensions(path).ok());
    let exif = exif_reader::read_exif(path);

    Ok(ImageFileInfo {
        data_url,
        size_bytes,
        decoded_size_bytes,
        last_modified,
        mime_type,
        dimensions,
        exif,
    })
}

pub fn scan_directory_neighbors(target: &Path) -> (Vec<NeighborInfo>, usize) {
    crate::imaging::neighbor_scanner::scan_directory_neighbors(target, is_image_file)
}

pub fn find_cli_file_arg() -> Option<PathBuf> {
    crate::imaging::neighbor_scanner::find_cli_file_arg()
}

fn build_initial_payload(path: &Path) -> Result<InitialImagePayload, String> {
    let abs_path = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    let file_name = abs_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("image")
        .to_string();
    let parent_dir = abs_path
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    let (neighbors, current_index) = scan_directory_neighbors(&abs_path);
    let info = gather_file_info(&abs_path)?;

    Ok(InitialImagePayload {
        target_path: abs_path.to_string_lossy().to_string(),
        file_name,
        parent_dir,
        neighbors,
        current_index,
        data_url: info.data_url,
        size_bytes: info.size_bytes,
        decoded_size_bytes: info.decoded_size_bytes,
        dimensions: info.dimensions,
        mime_type: info.mime_type,
        last_modified: info.last_modified,
        exif: info.exif,
    })
}

#[tauri::command]
pub fn get_initial_image() -> Result<Option<InitialImagePayload>, String> {
    let image_path = match find_cli_file_arg() {
        Some(p) => p,
        None => return Ok(None),
    };

    if !is_image_file(&image_path) {
        let name = image_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("file");
        return Err(format!("Unsupported file format: {}", name));
    }

    build_initial_payload(&image_path).map(Some)
}

#[tauri::command]
pub async fn read_image_file(path: String) -> Result<ImagePayload, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let p = PathBuf::from(&path);
        if !is_image_file(&p) {
            return Err(format!("Not a recognized image file: {}", path));
        }

        let file_name = p
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("image")
            .to_string();
        let info = gather_file_info(&p)?;

        Ok(ImagePayload {
            path,
            file_name,
            data_url: info.data_url,
            size_bytes: info.size_bytes,
            decoded_size_bytes: info.decoded_size_bytes,
            dimensions: info.dimensions,
            mime_type: info.mime_type,
            last_modified: info.last_modified,
            exif: info.exif,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn read_image_context(path: String) -> Result<InitialImagePayload, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let p = PathBuf::from(&path);
        if !is_image_file(&p) {
            return Err(format!("Not a recognized image file: {}", path));
        }
        build_initial_payload(&p)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Forces LibRaw full-sensor Bayer decode (Tier 2), skipping the embedded
/// thumbnail fast path. Returns the same ImagePayload as read_image_file.
#[tauri::command]
pub async fn read_raw_full_sensor(path: String) -> Result<ImagePayload, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let p = PathBuf::from(&path);
        if !raw_reader::is_raw_file(&p) {
            return Err(format!("Not a RAW file: {}", path));
        }
        let file_name = p.file_name().and_then(|n| n.to_str()).unwrap_or("image").to_string();
        let (data_url, dims) = raw_reader::decode_raw_full_sensor(&p)?;
        let metadata = fs::metadata(&p).ok();
        let size_bytes = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
        let decoded_size_bytes = (data_url.len() * 3 / 4) as u64;
        let last_modified = metadata
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64);
        let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("raw");
        let exif = exif_reader::read_exif(&p);
        Ok(ImagePayload {
            path,
            file_name,
            data_url,
            size_bytes,
            decoded_size_bytes,
            dimensions: Some(dims),
            mime_type: get_mime_type(ext).to_string(),
            last_modified,
            exif,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Fast binary JPEG decode for full sensor RAW, bypassing Base64 encoding.
#[tauri::command]
pub async fn read_raw_full_sensor_binary(path: String) -> Result<tauri::ipc::Response, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let p = PathBuf::from(&path);
        if !raw_reader::is_raw_file(&p) {
            return Err(format!("Not a RAW file: {}", path));
        }
        let (bytes, _) = raw_reader::decode_raw_full_sensor_bytes(&p)?;
        Ok(tauri::ipc::Response::new(bytes))
    })
    .await
    .map_err(|e| e.to_string())?
}

