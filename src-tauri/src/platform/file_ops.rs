use std::fs;
use std::path::Path;

#[cfg(target_os = "windows")]
mod win32_trash {
    use std::path::Path;
    use windows::core::PCWSTR;
    use windows::Win32::UI::Shell::{
        SHFileOperationW, FO_DELETE, FOF_ALLOWUNDO, FOF_NOCONFIRMATION, FOF_SILENT, SHFILEOPSTRUCTW,
    };

    pub fn move_to_recycle_bin(path: &Path) -> Result<(), String> {
        let path_str = path.to_str().ok_or("Invalid path string encoding")?;
        // Normalize slashes to standard Windows backslash and strip any extended-length \\?\ prefix
        let normalized = path_str.replace('/', "\\");
        let clean_path = normalized.strip_prefix(r"\\?\").unwrap_or(&normalized);

        let mut wide_path: Vec<u16> = clean_path.encode_utf16().collect();
        // Win32 SHFileOperation requires double null-termination
        wide_path.push(0);
        wide_path.push(0);

        let mut file_op = SHFILEOPSTRUCTW {
            hwnd: Default::default(),
            wFunc: FO_DELETE,
            pFrom: PCWSTR::from_raw(wide_path.as_ptr()),
            pTo: PCWSTR::null(),
            fFlags: (FOF_ALLOWUNDO | FOF_NOCONFIRMATION | FOF_SILENT).0 as u16,
            fAnyOperationsAborted: Default::default(),
            hNameMappings: std::ptr::null_mut(),
            lpszProgressTitle: PCWSTR::null(),
        };

        let result = unsafe { SHFileOperationW(&mut file_op) };
        if result == 0 && !file_op.fAnyOperationsAborted.as_bool() {
            Ok(())
        } else {
            Err(format!("SHFileOperationW failed with code {}", result))
        }
    }
}

#[tauri::command]
pub fn delete_file(path: String, to_trash: Option<bool>) -> Result<(), String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("File does not exist: {}", path));
    }

    let use_trash = to_trash.unwrap_or(true);

    #[cfg(target_os = "windows")]
    if use_trash {
        match win32_trash::move_to_recycle_bin(p) {
            Ok(_) => return Ok(()),
            Err(e) => {
                // Fallback to direct permanent deletion if Recycle Bin operation failed
                eprintln!("[file_ops] Recycle bin failed: {}, falling back to direct removal", e);
            }
        }
    }

    // Direct permanent deletion (or non-Windows fallback)
    fs::remove_file(p).map_err(|e| format!("Failed to delete file: {}", e))?;
    Ok(())
}
