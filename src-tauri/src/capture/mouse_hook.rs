/**
 * Bukaake Global Mouse Hook Engine
 * Dedicated OS thread with Win32 WH_MOUSE_LL low-level mouse hook (< 160 lines)
 */

#[cfg(target_os = "windows")]
mod win_hook {
    use std::sync::atomic::{AtomicU32, Ordering};
    use std::sync::{Arc, Mutex};
    use std::thread;
    use windows::Win32::Foundation::{HINSTANCE, HWND, LPARAM, LRESULT, WPARAM};
    use windows::Win32::System::Threading::GetCurrentThreadId;
    use windows::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, GetMessageW, PostThreadMessageW, SetWindowsHookExW,
        UnhookWindowsHookEx, HHOOK, MSG, MSLLHOOKSTRUCT, WH_MOUSE_LL,
        WM_LBUTTONDOWN, WM_QUIT, WM_RBUTTONDOWN,
    };

    type MouseClickCallback = Arc<dyn Fn(i32, i32, bool) + Send + Sync + 'static>;

    static ACTIVE_CALLBACK: Mutex<Option<MouseClickCallback>> = Mutex::new(None);
    static HOOK_THREAD_ID: AtomicU32 = AtomicU32::new(0);

    unsafe extern "system" fn mouse_proc(
        n_code: i32,
        w_param: WPARAM,
        l_param: LPARAM,
    ) -> LRESULT {
        if n_code >= 0 {
            let msg = w_param.0 as u32;
            let is_left = msg == WM_LBUTTONDOWN;
            let is_right = msg == WM_RBUTTONDOWN;

            if is_left || is_right {
                let ms_struct = *(l_param.0 as *const MSLLHOOKSTRUCT);
                let x = ms_struct.pt.x;
                let y = ms_struct.pt.y;

                if let Ok(guard) = ACTIVE_CALLBACK.lock() {
                    if let Some(ref cb) = *guard {
                        cb(x, y, is_right);
                    }
                }
            }
        }

        CallNextHookEx(HHOOK::default(), n_code, w_param, l_param)
    }

    pub fn start_mouse_hook<F>(callback: F) -> Result<(), String>
    where
        F: Fn(i32, i32, bool) + Send + Sync + 'static,
    {
        stop_mouse_hook();

        if let Ok(mut guard) = ACTIVE_CALLBACK.lock() {
            *guard = Some(Arc::new(callback));
        }

        let (init_tx, init_rx) = std::sync::mpsc::channel::<Result<(), String>>();

        thread::spawn(move || unsafe {
            let tid = GetCurrentThreadId();
            HOOK_THREAD_ID.store(tid, Ordering::SeqCst);

            let hook = match SetWindowsHookExW(
                WH_MOUSE_LL,
                Some(mouse_proc),
                HINSTANCE(std::ptr::null_mut()),
                0,
            ) {
                Ok(h) => {
                    let _ = init_tx.send(Ok(()));
                    h
                }
                Err(e) => {
                    let _ = init_tx.send(Err(format!("SetWindowsHookExW failed: {e}")));
                    HOOK_THREAD_ID.store(0, Ordering::SeqCst);
                    return;
                }
            };

            let mut msg = MSG::default();
            while GetMessageW(&mut msg, HWND::default(), 0, 0).as_bool() {
                if msg.message == WM_QUIT {
                    break;
                }
            }

            let _ = UnhookWindowsHookEx(hook);
            HOOK_THREAD_ID.store(0, Ordering::SeqCst);
        });

        init_rx
            .recv()
            .map_err(|e| format!("Hook init sync error: {e}"))?
    }

    pub fn stop_mouse_hook() {
        if let Ok(mut guard) = ACTIVE_CALLBACK.lock() {
            *guard = None;
        }

        let tid = HOOK_THREAD_ID.swap(0, Ordering::SeqCst);
        if tid != 0 {
            unsafe {
                let _ = PostThreadMessageW(tid, WM_QUIT, WPARAM(0), LPARAM(0));
            }
        }
    }
}

#[cfg(target_os = "windows")]
pub use win_hook::*;

#[cfg(not(target_os = "windows"))]
pub fn start_mouse_hook<F>(_callback: F) -> Result<(), String>
where
    F: Fn(i32, i32, bool) + Send + Sync + 'static,
{
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn stop_mouse_hook() {}
