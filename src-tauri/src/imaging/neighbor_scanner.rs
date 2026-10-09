use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Clone)]
pub struct NeighborInfo {
    pub path: String,
    pub name: String,
    pub size_bytes: u64,
}

pub fn scan_directory_neighbors<F>(target: &Path, is_image_predicate: F) -> (Vec<NeighborInfo>, usize)
where
    F: Fn(&Path) -> bool,
{
    let parent = match target.parent() {
        Some(p) => p,
        None => return (Vec::new(), 0),
    };

    let mut entries = Vec::new();
    if let Ok(read_dir) = fs::read_dir(parent) {
        for entry in read_dir.flatten() {
            let path = entry.path();
            if is_image_predicate(&path) {
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
