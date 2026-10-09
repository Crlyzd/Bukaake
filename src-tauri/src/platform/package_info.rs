/**
 * Bukaake Platform Package Information Engine
 * Detects whether the process is executing inside an MSIX Desktop Bridge container
 * via Win32 AppModel GetCurrentPackageFamilyName (< 80 lines).
 */

use serde::Serialize;

const APPMODEL_ERROR_NO_PACKAGE: i32 = 15700;

#[derive(Debug, Clone, Serialize)]
pub struct DistributionInfo {
    pub is_packaged: bool,
    pub channel: String,
    pub package_family_name: Option<String>,
}

#[cfg(target_os = "windows")]
extern "system" {
    fn GetCurrentPackageFamilyName(
        packagfamilynamelength: *mut u32,
        packagefamilyname: *mut u16,
    ) -> i32;
}

/// Checks if the process is running in an MSIX package container
pub fn is_packaged_app() -> bool {
    #[cfg(target_os = "windows")]
    unsafe {
        let mut len: u32 = 0;
        let res = GetCurrentPackageFamilyName(&mut len as *mut u32, std::ptr::null_mut());
        res != APPMODEL_ERROR_NO_PACKAGE && len > 0
    }
    #[cfg(not(target_os = "windows"))]
    false
}

/// Retrieves the Package Family Name if running in an MSIX package
pub fn get_package_family_name() -> Option<String> {
    #[cfg(target_os = "windows")]
    unsafe {
        let mut len: u32 = 0;
        let res = GetCurrentPackageFamilyName(&mut len as *mut u32, std::ptr::null_mut());
        if res == APPMODEL_ERROR_NO_PACKAGE || len == 0 {
            return None;
        }
        let mut buffer: Vec<u16> = vec![0u16; len as usize];
        let res2 = GetCurrentPackageFamilyName(&mut len as *mut u32, buffer.as_mut_ptr());
        if res2 == 0 && len > 0 {
            let actual_len = if buffer.last() == Some(&0) { buffer.len() - 1 } else { buffer.len() };
            return String::from_utf16(&buffer[..actual_len]).ok();
        }
        None
    }
    #[cfg(not(target_os = "windows"))]
    None
}

/// IPC command returning runtime distribution channel and package identity
#[tauri::command]
pub fn get_distribution_channel() -> DistributionInfo {
    let packaged = is_packaged_app();
    let family_name = get_package_family_name();
    DistributionInfo {
        is_packaged: packaged,
        channel: if packaged { "store".to_string() } else { "standalone".to_string() },
        package_family_name: family_name,
    }
}
