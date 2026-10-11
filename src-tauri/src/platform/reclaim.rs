/**
 * Bukaake Idle Memory Reclaim Coordinator
 * Manages background idle memory reclamation across WebView2 and Rust processes (< 120 lines)
 */

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::Duration;
use tauri::{Emitter, Manager};
use crate::platform::process_memory::{tree_working_set, trim_process_tree};

static RECLAIM_GEN: AtomicU64 = AtomicU64::new(0);
static SNIP_ACTIVE: AtomicBool = AtomicBool::new(false);

/// Sets whether screen snipping is active to prevent reclamation during overlay interaction
pub fn set_snip_active(active: bool) {
    SNIP_ACTIVE.store(active, Ordering::Relaxed);
    if active {
        cancel_reclaim();
    }
}

/// Returns true if snipping is currently in progress
pub fn is_snip_active() -> bool {
    SNIP_ACTIVE.load(Ordering::Relaxed)
}

/// Cancels any scheduled background reclamation immediately (e.g. on hotkey, open, or wake)
pub fn cancel_reclaim() {
    RECLAIM_GEN.fetch_add(1, Ordering::Relaxed);
}

/// Validates that all windows are hidden and no high-priority capture actions are running
pub fn are_all_windows_hidden_and_idle(app: &tauri::AppHandle) -> bool {
    if SNIP_ACTIVE.load(Ordering::Relaxed) {
        return false;
    }
    for label in ["main", "settings", "snipper"] {
        if let Some(w) = app.get_webview_window(label) {
            if w.is_visible().unwrap_or(false) {
                return false;
            }
        }
    }
    true
}

/// Requests an idle memory reclamation sequence.
/// For startup, waits for WebView2 process boot to settle.
/// Emits 'bukaake://reclaim' for JS GC, then executes two delayed working-set trims.
pub fn request_idle_reclaim(app: &tauri::AppHandle, reason: &str) {
    if !are_all_windows_hidden_and_idle(app) {
        return;
    }

    let gen = RECLAIM_GEN.fetch_add(1, Ordering::Relaxed) + 1;
    let app_handle = app.clone();
    let reason_str = reason.to_string();

    std::thread::spawn(move || {
        if reason_str == "startup" {
            // Settle loop: sample working set every 3s until two samples delta < 3MB
            let mut prev_ws = 0u64;
            for _ in 0..20 {
                std::thread::sleep(Duration::from_secs(3));
                if RECLAIM_GEN.load(Ordering::Relaxed) != gen {
                    return;
                }
                if !are_all_windows_hidden_and_idle(&app_handle) {
                    return;
                }
                let curr_ws = tree_working_set();
                if prev_ws > 0 {
                    let diff = if curr_ws >= prev_ws { curr_ws - prev_ws } else { prev_ws - curr_ws };
                    // 3 MB = 3,145,728 bytes
                    if diff < 3_145_728 {
                        break;
                    }
                }
                prev_ws = curr_ws;
            }
        }

        if RECLAIM_GEN.load(Ordering::Relaxed) != gen || !are_all_windows_hidden_and_idle(&app_handle) {
            return;
        }

        // 1. Emit reclaim event to notify all webviews to release caches and trigger JS gc()
        let _ = app_handle.emit("bukaake://reclaim", ());

        // 2. Wait 1.5s for JS garbage collection and DOM releases to finish, then execute primary trim
        std::thread::sleep(Duration::from_millis(1500));
        if RECLAIM_GEN.load(Ordering::Relaxed) != gen || !are_all_windows_hidden_and_idle(&app_handle) {
            return;
        }
        trim_process_tree();

        // 3. Wait another 4s to catch asynchronous DWM/GPU surface cleanup and execute follow-up trim
        std::thread::sleep(Duration::from_millis(4000));
        if RECLAIM_GEN.load(Ordering::Relaxed) != gen || !are_all_windows_hidden_and_idle(&app_handle) {
            return;
        }
        trim_process_tree();
    });
}
