/**
 * Bukaake Cathet Companion Tandem Service
 * Handles discovery of Cathet executable and dispatching extracted text (< 120 lines)
 */

use std::fs;
use std::path::PathBuf;
use std::process::Command;


#[tauri::command]
pub fn launch_cathet(text: String, custom_exe: Option<String>) -> Result<(), String> {
    let mut resolved_exe: Option<PathBuf> = None;

    if let Some(custom) = custom_exe {
        let p = PathBuf::from(&custom);
        if p.is_file() {
            resolved_exe = Some(p);
        }
    }

    if resolved_exe.is_none() {
        if let Ok(current_exe) = std::env::current_exe() {
            if let Some(dir) = current_exe.parent() {
                let candidates = [
                    dir.join("Cathet.exe"),
                    dir.join("cathet.exe"),
                    dir.join("Cathet").join("Cathet.exe"),
                    dir.join("..").join("Cathet").join("Cathet.exe"),
                    dir.join("..").join("Cathet.exe"),
                    dir.join("..").join("cathet.exe"),
                ];

                for cand in candidates {
                    if cand.is_file() {
                        resolved_exe = Some(cand);
                        break;
                    }
                }
            }
        }
    }

    let exe_path = resolved_exe.ok_or_else(|| {
        "Cathet executable (Cathet.exe) not found. Please locate it in Settings.".to_string()
    })?;

    // Write extracted text to a temporary markdown file to load into Cathet
    let temp_dir = std::env::temp_dir().join("Bukaake").join("tandem");
    let _ = fs::create_dir_all(&temp_dir);
    let ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let temp_file = temp_dir.join(format!("ocr_{}.md", ms));

    fs::write(&temp_file, text.as_bytes())
        .map_err(|e| format!("Failed to write OCR payload file: {}", e))?;

    let mut cmd = Command::new(exe_path);
    cmd.arg(&temp_file);


    cmd.spawn().map_err(|e| format!("Failed to launch Cathet: {}", e))?;

    Ok(())
}
