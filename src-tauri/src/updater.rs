/**
 * Bukaake Native Self-Updater Engine
 * Handles binary downloading via curl/PowerShell with progress streaming,
 * in-place executable replacement via self-replace, and seamless relaunch (< 180 lines)
 */

use std::path::Path;
use std::process::{Command, Stdio};
use tauri::{AppHandle, Emitter};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[tauri::command]
pub fn get_system_arch() -> String {
    match std::env::consts::ARCH {
        "aarch64" => "arm64".to_string(),
        _ => "x64".to_string(),
    }
}

/// Cleans up any lingering .old or temp update artifacts in the executable's directory
pub fn cleanup_old_update_artifacts() {
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(dir) = current_exe.parent() {
            if let Ok(entries) = std::fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
                        if ext.eq_ignore_ascii_case("old") || ext.starts_with("tmp") {
                            let _ = std::fs::remove_file(&path);
                        }
                    }
                }
            }
        }
    }
}

fn download_with_curl(app_handle: &AppHandle, asset_url: &str, dest_path: &Path) -> Result<(), String> {
    let mut cmd = Command::new("curl.exe");
    cmd.args(["-L", "--progress-bar", "--fail", "-o"])
        .arg(dest_path)
        .arg(asset_url);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn curl: {}", e))?;

    if let Some(stderr) = child.stderr.take() {
        use std::io::{BufRead, BufReader};
        let reader = BufReader::new(stderr);
        for line in reader.lines().flatten() {
            if let Some(pct_idx) = line.find('%') {
                let start = line[..pct_idx].rfind(|c: char| !c.is_ascii_digit() && c != '.').map(|i| i + 1).unwrap_or(0);
                if let Ok(pct) = line[start..pct_idx].trim().parse::<f32>() {
                    let _ = app_handle.emit("bukaake-update-progress", serde_json::json!({
                        "status": "downloading",
                        "percent": pct.clamp(0.0, 100.0)
                    }));
                }
            }
        }
    }

    let status = child.wait().map_err(|e| format!("Curl process error: {}", e))?;
    if !status.success() {
        return Err(format!("Curl exited with status: {}", status));
    }
    Ok(())
}

fn download_with_powershell(asset_url: &str, dest_path: &Path) -> Result<(), String> {
    let dest_str = dest_path.to_string_lossy().to_string();
    let script = format!(
        "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; \
         $client = New-Object System.Net.WebClient; \
         $client.DownloadFile('{}', '{}')",
        asset_url.replace('\'', "''"),
        dest_str.replace('\'', "''")
    );

    let mut cmd = Command::new("powershell.exe");
    cmd.args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", &script]);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let status = cmd.status().map_err(|e| format!("Failed to execute PowerShell fallback: {}", e))?;
    if !status.success() {
        return Err(format!("PowerShell download failed with status: {}", status));
    }
    Ok(())
}

#[tauri::command]
pub async fn download_and_install_update(app_handle: AppHandle, asset_url: String) -> Result<(), String> {
    if asset_url.is_empty() {
        return Err("Asset download URL is empty".to_string());
    }

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);

    let temp_dest = std::env::temp_dir().join(format!("bukaake-update-{}.exe", timestamp));

    // Emit initial progress
    let _ = app_handle.emit("bukaake-update-progress", serde_json::json!({
        "status": "downloading",
        "percent": 0.0
    }));

    // Download using curl first, with PowerShell fallback
    if let Err(curl_err) = download_with_curl(&app_handle, &asset_url, &temp_dest) {
        let _ = download_with_powershell(&asset_url, &temp_dest)
            .map_err(|ps_err| format!("Download failed. Curl error: {}; PowerShell error: {}", curl_err, ps_err))?;
    }

    // Verify downloaded file size (> 1MB)
    let meta = std::fs::metadata(&temp_dest).map_err(|e| format!("Downloaded file invalid: {}", e))?;
    if meta.len() < 1_000_000 {
        let _ = std::fs::remove_file(&temp_dest);
        return Err("Downloaded update file is too small or corrupted".to_string());
    }

    // Emit installing status
    let _ = app_handle.emit("bukaake-update-progress", serde_json::json!({
        "status": "installing",
        "percent": 100.0
    }));

    // In-place replace current running executable
    self_replace::self_replace(&temp_dest).map_err(|e| {
        let _ = std::fs::remove_file(&temp_dest);
        format!("Failed to replace executable: {}", e)
    })?;

    // Cleanup temp download file
    let _ = std::fs::remove_file(&temp_dest);

    // Relaunch the replaced executable
    let current_exe = std::env::current_exe().map_err(|e| format!("Failed to get current executable path: {}", e))?;

    #[cfg(target_os = "windows")]
    {
        let mut cmd = Command::new(&current_exe);
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd.spawn().map_err(|e| format!("Failed to restart updated application: {}", e))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        Command::new(&current_exe)
            .spawn()
            .map_err(|e| format!("Failed to restart updated application: {}", e))?;
    }

    // Exit old process cleanly
    app_handle.exit(0);
    std::process::exit(0);
}
