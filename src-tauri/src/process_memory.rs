use std::sync::atomic::{AtomicBool, Ordering};

static RECORDING_ACTIVE: AtomicBool = AtomicBool::new(false);

/// Sets whether screen recording is active to pause memory trimming
pub fn set_recording_memory_lockout(active: bool) {
    RECORDING_ACTIVE.store(active, Ordering::Relaxed);
}

/// Configures Chromium / WebView2 environment flags for minimum RAM consumption
pub fn configure_low_memory_webview_env() {
    #[cfg(target_os = "windows")]
    {
        let current = std::env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS").unwrap_or_default();
        let flags = [
            "--in-process-gpu",
            "--renderer-process-limit=1",
            "--disable-gpu-shader-disk-cache",
            "--disk-cache-size=1",
            "--media-cache-size=1",
            "--enable-low-end-device-mode",
            "--js-flags=\"--max-old-space-size=64 --expose-gc\"",
            "--auto-select-desktop-capture-source=\"Entire screen\"",
            "--enable-usermedia-screen-capturing",
            "--use-fake-ui-for-media-stream",
        ];

        let mut combined = current;
        for flag in flags {
            let key = flag.split('=').next().unwrap_or(flag);
            if !combined.contains(key) {
                if !combined.is_empty() {
                    combined.push(' ');
                }
                combined.push_str(flag);
            }
        }
        std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", combined);
    }
}

/// Recursively flushes the working set of the host process and all child msedgewebview2 processes
#[cfg(target_os = "windows")]
pub fn trim_process_tree() {
    if RECORDING_ACTIVE.load(Ordering::Relaxed) {
        return;
    }

    unsafe {
        use windows::Win32::{
            Foundation::CloseHandle,
            System::{
                Diagnostics::ToolHelp::{
                    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
                    TH32CS_SNAPPROCESS,
                },
                ProcessStatus::K32EmptyWorkingSet,
                Threading::{
                    GetCurrentProcess, GetCurrentProcessId, OpenProcess,
                    PROCESS_QUERY_INFORMATION, PROCESS_SET_QUOTA,
                },
            },
        };

        // 1. Trim host Rust process
        let _ = K32EmptyWorkingSet(GetCurrentProcess());

        // 2. Discover and trim all descendant WebView2 processes
        let my_pid = GetCurrentProcessId();
        if let Ok(snapshot) = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) {
            let mut pids_to_trim = Vec::new();
            let mut direct_children = Vec::new();

            let mut entry = PROCESSENTRY32W::default();
            entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;

            if Process32FirstW(snapshot, &mut entry).is_ok() {
                loop {
                    if entry.th32ParentProcessID == my_pid {
                        direct_children.push(entry.th32ProcessID);
                        pids_to_trim.push(entry.th32ProcessID);
                    }
                    if Process32NextW(snapshot, &mut entry).is_err() {
                        break;
                    }
                }
            }

            // Check grandchildren (renderer / utility processes spawned by browser process)
            if !direct_children.is_empty() && Process32FirstW(snapshot, &mut entry).is_ok() {
                loop {
                    if direct_children.contains(&entry.th32ParentProcessID) {
                        pids_to_trim.push(entry.th32ProcessID);
                    }
                    if Process32NextW(snapshot, &mut entry).is_err() {
                        break;
                    }
                }
            }

            let _ = CloseHandle(snapshot);

            // Trim each discovered process
            for pid in pids_to_trim {
                if let Ok(h_child) = OpenProcess(PROCESS_SET_QUOTA | PROCESS_QUERY_INFORMATION, false, pid) {
                    let _ = K32EmptyWorkingSet(h_child);
                    let _ = CloseHandle(h_child);
                }
            }
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub fn trim_process_tree() {}

#[tauri::command]
pub fn trim_memory_working_set() {
    trim_process_tree();
}
