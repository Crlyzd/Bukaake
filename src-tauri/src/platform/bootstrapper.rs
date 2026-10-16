/**
 * Bukaake Native Pre-Flight Bootstrapper & Environment Validator
 * Detects Windows OS version compatibility and automates Microsoft Edge WebView2
 * Evergreen Runtime detection, download, and installation (< 240 lines).
 */

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use rfd::{MessageButtons, MessageDialog, MessageDialogResult, MessageLevel};

#[cfg(target_os = "windows")]
use winreg::enums::*;
#[cfg(target_os = "windows")]
use winreg::RegKey;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const WEBVIEW2_BOOTSTRAPPER_URL: &str = "https://go.microsoft.com/fwlink/p/?LinkId=2124703";
const WEBVIEW2_CLIENT_GUID: &str = "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";
const MIN_WINDOWS_BUILD: u32 = 17763; // Windows 10 Version 1809 (October 2018 Update)

/// Checks if the operating system meets Bukaake's minimum requirements (Windows 10 1809+)
#[cfg(target_os = "windows")]
fn verify_windows_version() -> Result<(), String> {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let key = hklm
        .open_subkey("SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion")
        .map_err(|e| format!("Cannot read OS version registry: {}", e))?;

    let build_str: String = key
        .get_value("CurrentBuildNumber")
        .or_else(|_| key.get_value("CurrentBuild"))
        .unwrap_or_else(|_| "0".to_string());

    let build_num: u32 = build_str.parse().unwrap_or(0);

    if build_num < MIN_WINDOWS_BUILD {
        let product_name: String = key
            .get_value("ProductName")
            .unwrap_or_else(|_| "an older version of Windows".to_string());

        return Err(format!(
            "Bukaake requires Windows 10 (Version 1809 or newer) or Windows 11 to support modern GPU hardware acceleration and transparent viewing.\n\nYour system is running {} (Build {}). Bukaake cannot start.",
            product_name, build_str
        ));
    }

    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn verify_windows_version() -> Result<(), String> {
    Ok(())
}

/// Checks whether Microsoft Edge WebView2 Evergreen Runtime is installed
#[cfg(target_os = "windows")]
pub fn is_webview2_installed() -> bool {
    let subkeys = [
        format!("SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\{}", WEBVIEW2_CLIENT_GUID),
        format!("SOFTWARE\\Microsoft\\EdgeUpdate\\Clients\\{}", WEBVIEW2_CLIENT_GUID),
    ];

    for path in &subkeys {
        // Check HKLM
        if let Ok(key) = RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey(path) {
            if let Ok(pv) = key.get_value::<String, _>("pv") {
                if !pv.is_empty() && pv != "0.0.0.0" {
                    return true;
                }
            }
        }
        // Check HKCU
        if let Ok(key) = RegKey::predef(HKEY_CURRENT_USER).open_subkey(path) {
            if let Ok(pv) = key.get_value::<String, _>("pv") {
                if !pv.is_empty() && pv != "0.0.0.0" {
                    return true;
                }
            }
        }
    }

    // Secondary binary-based check (avoid false positives from empty/telemetry folders)
    let candidate_dirs = [
        "C:\\Program Files (x86)\\Microsoft\\EdgeWebView\\Application",
        "C:\\Program Files\\Microsoft\\EdgeWebView\\Application",
    ];

    for dir in &candidate_dirs {
        if has_webview_binary(Path::new(dir)) {
            return true;
        }
    }

    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let user_path = PathBuf::from(local_app_data).join("Microsoft\\EdgeWebView\\Application");
        if has_webview_binary(&user_path) {
            return true;
        }
    }

    false
}

#[cfg(target_os = "windows")]
fn has_webview_binary(base_dir: &Path) -> bool {
    if let Ok(entries) = std::fs::read_dir(base_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() && path.join("msedgewebview2.exe").is_file() {
                return true;
            }
        }
    }
    false
}

#[cfg(not(target_os = "windows"))]
pub fn is_webview2_installed() -> bool {
    true
}

fn download_bootstrapper(dest_path: &Path) -> Result<(), String> {
    // Attempt 1: curl.exe
    let mut curl_cmd = Command::new("curl.exe");
    curl_cmd.args(["-L", "--fail", "-s", "-o"])
        .arg(dest_path)
        .arg(WEBVIEW2_BOOTSTRAPPER_URL);

    #[cfg(target_os = "windows")]
    curl_cmd.creation_flags(CREATE_NO_WINDOW);

    curl_cmd.stdout(Stdio::null());
    curl_cmd.stderr(Stdio::null());

    if let Ok(mut child) = curl_cmd.spawn() {
        if let Ok(status) = child.wait() {
            if status.success() && dest_path.is_file() {
                return Ok(());
            }
        }
    }

    // Attempt 2: PowerShell WebClient fallback
    let dest_str = dest_path.to_string_lossy().to_string();
    let script = format!(
        "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; \
         $wc = New-Object System.Net.WebClient; \
         $wc.DownloadFile('{}', '{}')",
        WEBVIEW2_BOOTSTRAPPER_URL,
        dest_str.replace('\'', "''")
    );

    let mut ps_cmd = Command::new("powershell.exe");
    ps_cmd.args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", &script]);

    #[cfg(target_os = "windows")]
    ps_cmd.creation_flags(CREATE_NO_WINDOW);

    let ps_status = ps_cmd.status().map_err(|e| format!("PowerShell download failed: {}", e))?;
    if !ps_status.success() || !dest_path.is_file() {
        return Err("Failed to download WebView2 installer via curl or PowerShell".to_string());
    }

    Ok(())
}

fn install_webview2_bootstrapper() -> Result<bool, String> {
    let temp_dir = std::env::temp_dir();
    let setup_path = temp_dir.join("Bukaake_MicrosoftEdgeWebview2Setup.exe");

    download_bootstrapper(&setup_path)?;

    // Launch Microsoft's official installer with native progress UI
    let mut installer_cmd = Command::new(&setup_path);
    installer_cmd.arg("/install");

    let status = installer_cmd
        .status()
        .map_err(|e| format!("Failed to spawn WebView2 installer: {}", e))?;

    let _ = std::fs::remove_file(&setup_path);

    if !status.success() {
        return Err(format!("Installer exited with status: {}", status));
    }

    Ok(is_webview2_installed())
}

/// Runs synchronous pre-flight validation on application startup before Tauri builder initialization
pub fn run_preflight_checks() -> Result<(), ()> {
    // 1. Verify OS compatibility
    if let Err(msg) = verify_windows_version() {
        MessageDialog::new()
            .set_title("Unsupported Windows Version")
            .set_description(&msg)
            .set_level(MessageLevel::Error)
            .set_buttons(MessageButtons::Ok)
            .show();
        return Err(());
    }

    // 2. Verify WebView2 Evergreen Runtime
    if !is_webview2_installed() {
        let prompt_desc = "Microsoft Edge WebView2 Runtime is required to run Bukaake, but was not found on your system.\n\nWould you like Bukaake to download and install it now?\n\n• Download size: ~2 MB\n• Estimated time: ~20–30 seconds\n• No restart required";

        let response = MessageDialog::new()
            .set_title("Bukaake — Runtime Setup")
            .set_description(prompt_desc)
            .set_level(MessageLevel::Info)
            .set_buttons(MessageButtons::YesNo)
            .show();

        if response == MessageDialogResult::Yes {
            match install_webview2_bootstrapper() {
                Ok(true) => Ok(()),
                _ => {
                    MessageDialog::new()
                        .set_title("WebView2 Setup Incomplete")
                        .set_description(
                            "WebView2 Runtime installation was not completed.\n\nYou can manually download and install it at any time from:\nhttps://developer.microsoft.com/en-us/microsoft-edge/webview2/",
                        )
                        .set_level(MessageLevel::Warning)
                        .set_buttons(MessageButtons::Ok)
                        .show();
                    Err(())
                }
            }
        } else {
            MessageDialog::new()
                .set_title("Runtime Required")
                .set_description(
                    "Bukaake cannot start without the Microsoft Edge WebView2 Runtime.\n\nYou can install it manually from:\nhttps://developer.microsoft.com/en-us/microsoft-edge/webview2/",
                )
                .set_level(MessageLevel::Info)
                .set_buttons(MessageButtons::Ok)
                .show();
            Err(())
        }
    } else {
        Ok(())
    }
}

/// Displays a native error dialog when Tauri encounters an unrecoverable startup or window initialization error
pub fn show_fatal_error(title: &str, message: &str) {
    MessageDialog::new()
        .set_title(title)
        .set_description(message)
        .set_level(MessageLevel::Error)
        .set_buttons(MessageButtons::Ok)
        .show();
}
