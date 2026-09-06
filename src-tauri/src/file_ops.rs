use std::fs;
use std::path::Path;

#[cfg(target_os = "windows")]
mod win32_trash {
    use std::ffi::c_void;
    use std::path::Path;

    #[repr(C, packed(2))]
    struct SHFILEOPSTRUCTW {
        hwnd: *mut c_void,
        w_func: u32,
        p_from: *const u16,
        p_to: *const u16,
        f_flags: u16,
        f_any_operations_aborted: i32,
        h_name_mappings: *mut c_void,
        lpsz_progress_title: *const u16,
    }

    const FO_DELETE: u32 = 0x0003;
    const FOF_ALLOWUNDO: u16 = 0x0040;
    const FOF_NOCONFIRMATION: u16 = 0x0010;
    const FOF_SILENT: u16 = 0x0004;

    #[link(name = "shell32")]
    extern "system" {
        fn SHFileOperationW(lpFileOp: *mut SHFILEOPSTRUCTW) -> i32;
    }

    pub fn move_to_recycle_bin(path: &Path) -> Result<(), String> {
        let path_str = path.to_str().ok_or("Invalid path string encoding")?;
        let mut wide_path: Vec<u16> = path_str.encode_utf16().collect();
        // Win32 SHFileOperation requires double null-termination
        wide_path.push(0);
        wide_path.push(0);

        let mut file_op = SHFILEOPSTRUCTW {
            hwnd: std::ptr::null_mut(),
            w_func: FO_DELETE,
            p_from: wide_path.as_ptr(),
            p_to: std::ptr::null(),
            f_flags: FOF_ALLOWUNDO | FOF_NOCONFIRMATION | FOF_SILENT,
            f_any_operations_aborted: 0,
            h_name_mappings: std::ptr::null_mut(),
            lpsz_progress_title: std::ptr::null(),
        };

        let result = unsafe { SHFileOperationW(&mut file_op) };
        if result == 0 && file_op.f_any_operations_aborted == 0 {
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
