use serde::Serialize;
use std::env::current_exe;
use std::os::windows::process::CommandExt;
use winreg::enums::*;
use winreg::RegKey;

const CREATE_NO_WINDOW: u32 = 0x08000000;

pub const SUPPORTED_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "webp", "gif", "bmp", "ico", "tiff", "tif", "svg", "avif",
    "heic", "heif", "hif", "heifs", "heics",
    "arw", "srf", "sr2", "cr2", "cr3", "nef", "nrw", "dng", "raf", "rw2", "orf", "pef",
    "hdr", "exr", "tga", "dds", "qoi", "ppm", "pgm", "pbm", "pnm",
];

#[derive(Debug, Clone, Serialize)]
pub struct AssocStatus {
    pub is_registered: bool,
    pub is_path_matched: bool,
    pub registered_path: Option<String>,
    pub current_path: String,
    pub format_count: usize,
}

fn get_current_exe_path() -> Result<String, String> {
    let path = current_exe().map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

pub fn get_registered_exe_path() -> Option<String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let cmd_key = hkcu.open_subkey("Software\\Classes\\Bukaake.ImageViewer\\shell\\open\\command").ok()?;
    let raw_cmd: String = cmd_key.get_value("").ok()?;
    let path = raw_cmd.trim().trim_start_matches('"').split('"').next()?;
    Some(path.to_string())
}

pub fn auto_heal_or_sync_path() -> Result<bool, String> {
    let current_path = get_current_exe_path()?;
    if let Some(registered_path) = get_registered_exe_path() {
        if !registered_path.eq_ignore_ascii_case(&current_path) {
            update_paths_only(&current_path)?;
            return Ok(true);
        }
    }
    Ok(false)
}

fn update_paths_only(exe_path: &str) -> Result<(), String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let open_cmd = format!("\"{}\" \"%1\"", exe_path);
    let icon_str = format!("\"{}\",0", exe_path);

    if let Ok((cmd_key, _)) = hkcu.create_subkey("Software\\Classes\\Bukaake.ImageViewer\\shell\\open\\command") {
        let _ = cmd_key.set_value("", &open_cmd);
    }
    if let Ok((icon_key, _)) = hkcu.create_subkey("Software\\Classes\\Bukaake.ImageViewer\\DefaultIcon") {
        let _ = icon_key.set_value("", &icon_str);
    }
    if let Ok((ctx_cmd, _)) = hkcu.create_subkey("Software\\Classes\\SystemFileAssociations\\image\\shell\\Bukaake\\command") {
        let _ = ctx_cmd.set_value("", &open_cmd);
    }
    if let Ok((ctx_key, _)) = hkcu.create_subkey("Software\\Classes\\SystemFileAssociations\\image\\shell\\Bukaake") {
        let _ = ctx_key.set_value("Icon", &icon_str);
    }
    Ok(())
}

#[tauri::command]
pub fn check_association_status() -> Result<AssocStatus, String> {
    let current_path = get_current_exe_path()?;
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let reg_apps = hkcu.open_subkey("Software\\RegisteredApplications").ok();
    let is_registered = reg_apps
        .and_then(|key| key.get_value::<String, _>("Bukaake").ok())
        .is_some();

    let registered_path = get_registered_exe_path();
    let is_path_matched = registered_path.as_ref()
        .map(|p| p.eq_ignore_ascii_case(&current_path))
        .unwrap_or(false);

    Ok(AssocStatus {
        is_registered,
        is_path_matched,
        registered_path,
        current_path,
        format_count: SUPPORTED_EXTENSIONS.len(),
    })
}

#[tauri::command]
pub fn register_file_associations() -> Result<AssocStatus, String> {
    let exe_path = get_current_exe_path()?;
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let open_cmd = format!("\"{}\" \"%1\"", exe_path);
    let icon_str = format!("\"{}\",0", exe_path);

    // 1. ProgID Bukaake.ImageViewer
    let (prog_id, _) = hkcu.create_subkey("Software\\Classes\\Bukaake.ImageViewer").map_err(|e| e.to_string())?;
    prog_id.set_value("", &"Bukaake Image Viewer").map_err(|e| e.to_string())?;
    prog_id.set_value("FriendlyTypeName", &"Bukaake Image Viewer").map_err(|e| e.to_string())?;

    let (icon_key, _) = hkcu.create_subkey("Software\\Classes\\Bukaake.ImageViewer\\DefaultIcon").map_err(|e| e.to_string())?;
    icon_key.set_value("", &icon_str).map_err(|e| e.to_string())?;

    let (cmd_key, _) = hkcu.create_subkey("Software\\Classes\\Bukaake.ImageViewer\\shell\\open\\command").map_err(|e| e.to_string())?;
    cmd_key.set_value("", &open_cmd).map_err(|e| e.to_string())?;

    let (supp_key, _) = hkcu.create_subkey("Software\\Classes\\Bukaake.ImageViewer\\SupportedTypes").map_err(|e| e.to_string())?;
    for ext in SUPPORTED_EXTENSIONS {
        let ext_with_dot = format!(".{}", ext);
        let _ = supp_key.set_value(&ext_with_dot, &"");
    }

    // 2. Capabilities
    let (cap_key, _) = hkcu.create_subkey("Software\\Bukaake\\Capabilities").map_err(|e| e.to_string())?;
    cap_key.set_value("ApplicationDescription", &"Bukaake — Fast glass image viewer").map_err(|e| e.to_string())?;
    cap_key.set_value("ApplicationName", &"Bukaake").map_err(|e| e.to_string())?;

    let (assoc_map, _) = hkcu.create_subkey("Software\\Bukaake\\Capabilities\\FileAssociations").map_err(|e| e.to_string())?;
    for ext in SUPPORTED_EXTENSIONS {
        let ext_with_dot = format!(".{}", ext);
        let _ = assoc_map.set_value(&ext_with_dot, &"Bukaake.ImageViewer");
        let open_with_path = format!("Software\\Classes\\{}\\OpenWithProgids", ext_with_dot);
        if let Ok((ow_key, _)) = hkcu.create_subkey(&open_with_path) {
            let _ = ow_key.set_value("Bukaake.ImageViewer", &"");
        }
    }

    // 3. RegisteredApplications
    let (reg_apps, _) = hkcu.create_subkey("Software\\RegisteredApplications").map_err(|e| e.to_string())?;
    reg_apps.set_value("Bukaake", &"Software\\Bukaake\\Capabilities").map_err(|e| e.to_string())?;

    // 4. Explorer Right-Click Context Menu ("Open with Bukaake")
    let (ctx_key, _) = hkcu.create_subkey("Software\\Classes\\SystemFileAssociations\\image\\shell\\Bukaake").map_err(|e| e.to_string())?;
    ctx_key.set_value("", &"Open with Bukaake").map_err(|e| e.to_string())?;
    ctx_key.set_value("Icon", &icon_str).map_err(|e| e.to_string())?;

    let (ctx_cmd, _) = hkcu.create_subkey("Software\\Classes\\SystemFileAssociations\\image\\shell\\Bukaake\\command").map_err(|e| e.to_string())?;
    ctx_cmd.set_value("", &open_cmd).map_err(|e| e.to_string())?;

    check_association_status()
}

#[tauri::command]
pub fn unregister_file_associations() -> Result<AssocStatus, String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let _ = hkcu.delete_subkey_all("Software\\Classes\\Bukaake.ImageViewer");
    let _ = hkcu.delete_subkey_all("Software\\Bukaake");
    let _ = hkcu.delete_subkey_all("Software\\Classes\\SystemFileAssociations\\image\\shell\\Bukaake");

    if let Ok(reg_apps) = hkcu.open_subkey_with_flags("Software\\RegisteredApplications", KEY_WRITE) {
        let _ = reg_apps.delete_value("Bukaake");
    }

    check_association_status()
}

#[tauri::command]
pub fn launch_default_apps_settings() -> Result<(), String> {
    let mut cmd = std::process::Command::new("rundll32");
    cmd.args(["url.dll,FileProtocolHandler", "ms-settings:defaultapps?registeredAppUser=Bukaake"]);
    cmd.creation_flags(CREATE_NO_WINDOW);
    if let Err(_) = cmd.spawn() {
        let mut fallback = std::process::Command::new("rundll32");
        fallback.args(["url.dll,FileProtocolHandler", "ms-settings:defaultapps"]);
        fallback.creation_flags(CREATE_NO_WINDOW);
        fallback.spawn().map_err(|e| e.to_string())?;
    }
    Ok(())
}
