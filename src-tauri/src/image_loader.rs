use base64::prelude::*;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

pub const SUPPORTED_EXTS: &[&str] = &[
    "png", "jpg", "jpeg", "webp", "gif", "bmp", "ico", "tiff", "svg", "avif",
];

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
}

#[derive(Debug, Serialize)]
pub struct ImagePayload {
    pub path: String,
    pub file_name: String,
    pub data_url: String,
    pub size_bytes: u64,
    pub dimensions: Option<(u32, u32)>,
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
        "tiff" => "image/tiff",
        "svg" => "image/svg+xml",
        "avif" => "image/avif",
        _ => "application/octet-stream",
    }
}

pub fn file_to_data_url(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|e| format!("Failed to read image file: {}", e))?;
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");
    let mime = get_mime_type(ext);
    let b64 = BASE64_STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
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

    // Natural sort by filename (case-insensitive)
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

pub fn find_cli_image_path() -> Option<PathBuf> {
    for arg in std::env::args().skip(1) {
        if arg.starts_with("--") || arg.starts_with('-') {
            continue;
        }
        let p = PathBuf::from(&arg);
        if is_image_file(&p) {
            return Some(p);
        }
    }
    None
}

#[tauri::command]
pub fn get_initial_image() -> Result<Option<InitialImagePayload>, String> {
    let image_path = match find_cli_image_path() {
        Some(p) => p,
        None => return Ok(None),
    };

    let abs_path = image_path
        .canonicalize()
        .unwrap_or_else(|_| image_path.clone());
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
    let data_url = file_to_data_url(&abs_path)?;
    let metadata = fs::metadata(&abs_path).ok();
    let size_bytes = metadata.map(|m| m.len()).unwrap_or(0);
    let dimensions = image::image_dimensions(&abs_path).ok();

    Ok(Some(InitialImagePayload {
        target_path: abs_path.to_string_lossy().to_string(),
        file_name,
        parent_dir,
        neighbors,
        current_index,
        data_url,
        size_bytes,
        dimensions,
    }))
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
    let data_url = file_to_data_url(&p)?;
    let metadata = fs::metadata(&p).ok();
    let size_bytes = metadata.map(|m| m.len()).unwrap_or(0);
    let dimensions = image::image_dimensions(&p).ok();

    Ok(ImagePayload {
        path,
        file_name,
        data_url,
        size_bytes,
        dimensions,
    })
}

#[tauri::command]
pub fn read_image_context(path: String) -> Result<InitialImagePayload, String> {
    let p = PathBuf::from(&path);
    if !is_image_file(&p) {
        return Err(format!("Not a recognized image file: {}", path));
    }
    let abs_path = p.canonicalize().unwrap_or_else(|_| p.clone());
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
    let data_url = file_to_data_url(&abs_path)?;
    let metadata = fs::metadata(&abs_path).ok();
    let size_bytes = metadata.map(|m| m.len()).unwrap_or(0);
    let dimensions = image::image_dimensions(&abs_path).ok();

    Ok(InitialImagePayload {
        target_path: abs_path.to_string_lossy().to_string(),
        file_name,
        parent_dir,
        neighbors,
        current_index,
        data_url,
        size_bytes,
        dimensions,
    })
}
