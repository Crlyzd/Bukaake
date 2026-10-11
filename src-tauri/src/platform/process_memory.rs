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
            "--renderer-process-limit=1",
            "--disable-gpu-shader-disk-cache",
            "--disk-cache-size=1",
            "--media-cache-size=1",
            "--js-flags=\"--max-old-space-size=256 --expose-gc\"",
            "--disable-background-timer-throttling",
            "--disable-renderer-backgrounding",
            "--disable-backgrounding-occluded-windows",
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

/// Collects the PIDs of the host process and all descendant WebView2 processes
#[cfg(target_os = "windows")]
pub fn collect_tree_pids() -> Vec<u32> {
    use windows::Win32::{
        Foundation::CloseHandle,
        System::{
            Diagnostics::ToolHelp::{
                CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
                TH32CS_SNAPPROCESS,
            },
            Threading::GetCurrentProcessId,
        },
    };

    let mut pids = Vec::new();
    let my_pid = unsafe { GetCurrentProcessId() };
    pids.push(my_pid);

    unsafe {
        if let Ok(snapshot) = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) {
            let mut direct_children = Vec::new();
            let mut entry = PROCESSENTRY32W::default();
            entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;

            if Process32FirstW(snapshot, &mut entry).is_ok() {
                loop {
                    if entry.th32ParentProcessID == my_pid {
                        direct_children.push(entry.th32ProcessID);
                        pids.push(entry.th32ProcessID);
                    }
                    if Process32NextW(snapshot, &mut entry).is_err() {
                        break;
                    }
                }
            }

            if !direct_children.is_empty() && Process32FirstW(snapshot, &mut entry).is_ok() {
                loop {
                    if direct_children.contains(&entry.th32ParentProcessID) {
                        pids.push(entry.th32ProcessID);
                    }
                    if Process32NextW(snapshot, &mut entry).is_err() {
                        break;
                    }
                }
            }

            let _ = CloseHandle(snapshot);
        }
    }
    pids
}

#[cfg(not(target_os = "windows"))]
pub fn collect_tree_pids() -> Vec<u32> {
    Vec::new()
}

/// Computes the total working set size in bytes across the host and all WebView2 child processes
#[cfg(target_os = "windows")]
pub fn tree_working_set() -> u64 {
    use windows::Win32::{
        Foundation::CloseHandle,
        System::{
            ProcessStatus::{K32GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS},
            Threading::{OpenProcess, PROCESS_QUERY_INFORMATION},
        },
    };

    let pids = collect_tree_pids();
    let mut total_bytes: u64 = 0;

    unsafe {
        for pid in pids {
            if let Ok(h_proc) = OpenProcess(PROCESS_QUERY_INFORMATION, false, pid) {
                let mut pmc = PROCESS_MEMORY_COUNTERS::default();
                pmc.cb = std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as u32;
                if K32GetProcessMemoryInfo(h_proc, &mut pmc, pmc.cb).as_bool() {
                    total_bytes += pmc.WorkingSetSize as u64;
                }
                let _ = CloseHandle(h_proc);
            }
        }
    }

    total_bytes
}

#[cfg(not(target_os = "windows"))]
pub fn tree_working_set() -> u64 {
    0
}

/// Recursively flushes the working set of the host process and all child msedgewebview2 processes
#[cfg(target_os = "windows")]
pub fn trim_process_tree() {
    if RECORDING_ACTIVE.load(Ordering::Relaxed) {
        return;
    }

    use windows::Win32::{
        Foundation::CloseHandle,
        System::{
            ProcessStatus::K32EmptyWorkingSet,
            Threading::{GetCurrentProcess, OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_SET_QUOTA},
        },
    };

    let pids = collect_tree_pids();
    unsafe {
        let _ = K32EmptyWorkingSet(GetCurrentProcess());
        for pid in pids {
            if let Ok(h_child) = OpenProcess(PROCESS_SET_QUOTA | PROCESS_QUERY_INFORMATION, false, pid) {
                let _ = K32EmptyWorkingSet(h_child);
                let _ = CloseHandle(h_child);
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
