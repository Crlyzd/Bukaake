use crate::exif_reader::{self, ExifPayload};
use crate::heif_reader;
use crate::pro_decoder;
use crate::raw_reader;
use base64::prelude::*;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

pub use crate::file_assoc::SUPPORTED_EXTENSIONS as SUPPORTED_EXTS;

#[derive(Debug, Serialize, Clone)]
pub struct NeighborInfo {
    pub path: String,
    pub name: String,
    pub size_bytes: u64,
}

#[derive(Debug, Serialize)]
pub struct InitialImagePayload {
    pub target_path: String,
    pub file_name: String,
    pub parent_dir: String,
    pub neighbors: Vec<NeighborInfo>,
    pub current_index: usize,
    pub data_url: String,
    pub size_bytes: u64,
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
        "cr2" => "image/x-canon-cr2",
        "cr3" => "image/x-canon-cr3",
        "nef" | "nrw" => "image/x-nikon-nef",
        "dng" => "image/x-adobe-dng",
        "raf" => "image/x-fuji-raf",
        "rw2" => "image/x-panasonic-rw2",
        "orf" => "image/x-olympus-orf",
        "pef" => "image/x-pentax-pef",
        _ => "application/octet-stream",
    }
}

pub fn file_to_data_url(path: &Path) -> Result<(String, Option<(u32, u32)>), String> {
    if raw_reader::is_raw_file(path) {
        if let Some(jpeg_bytes) = raw_reader::extract_raw_preview(path) {
            let b64 = BASE64_STANDARD.encode(&jpeg_bytes);
            return Ok((format!("data:image/jpeg;base64,{}", b64), None));
        }
    }

    if heif_reader::is_heif_file(path) {
        if let Ok((data_url, dims)) = heif_reader::decode_heif_image(path) {
            return Ok((data_url, Some(dims)));
        }
    }

    if pro_decoder::is_pro_file(path) {
        if let Ok((data_url, dims)) = pro_decoder::decode_pro_image(path) {
            return Ok((data_url, Some(dims)));
        }
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
    last_modified: Option<u64>,
    mime_type: String,
    dimensions: Option<(u32, u32)>,
    exif: Option<ExifPayload>,
}

fn gather_file_info(path: &Path) -> Result<ImageFileInfo, String> {
    let (data_url, pro_dims) = file_to_data_url(path)?;
    let metadata = fs::metadata(path).ok();
    let size_bytes = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
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
        last_modified,
        mime_type,
        dimensions,
        exif,
    })
}

pub fn scan_directory_neighbors(target: &Path) -> (Vec<NeighborInfo>, usize) {
    let parent = match target.parent() {
        Some(p) => p,
        None => return (Vec::new(), 0),
    };

    let mut entries = Vec::new();
    if let Ok(read_dir) = fs::read_dir(parent) {
        for entry in read_dir.flatten() {
            let path = entry.path();
            if is_image_file(&path) {
                let name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();
                let size_bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);
                entries.push((path, name, size_bytes));
            }
        }
    }

    entries.sort_by(|a, b| a.1.to_lowercase().cmp(&b.1.to_lowercase()));
    let target_norm = target.canonicalize().unwrap_or_else(|_| target.to_path_buf());
    let mut current_index = 0;
    let mut neighbors = Vec::with_capacity(entries.len());

    for (idx, (p, name, size_bytes)) in entries.into_iter().enumerate() {
        let p_norm = p.canonicalize().unwrap_or_else(|_| p.clone());
        if p_norm == target_norm {
            current_index = idx;
        }
        neighbors.push(NeighborInfo {
            path: p.to_string_lossy().to_string(),
            name,
            size_bytes,
        });
    }

    (neighbors, current_index)
}

pub fn find_cli_file_arg() -> Option<PathBuf> {
    for arg in std::env::args().skip(1) {
        if arg.starts_with("--") || arg.starts_with('-') {
            continue;
        }
        return Some(PathBuf::from(&arg));
    }
    None
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
pub fn read_image_file(path: String) -> Result<ImagePayload, String> {
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
        dimensions: info.dimensions,
        mime_type: info.mime_type,
        last_modified: info.last_modified,
        exif: info.exif,
    })
}

#[tauri::command]
pub fn read_image_context(path: String) -> Result<InitialImagePayload, String> {
    let p = PathBuf::from(&path);
    if !is_image_file(&p) {
        return Err(format!("Not a recognized image file: {}", path));
    }
    build_initial_payload(&p)
}
