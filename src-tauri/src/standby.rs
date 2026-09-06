use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::time::{Duration, Instant};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};

static STANDBY_ENABLED: AtomicBool = AtomicBool::new(true);
static STANDBY_TIMEOUT_SECS: u64 = 300; // 5 minutes
#[derive(Clone, Default)]
pub struct StandbyManager {
    timer_active: Arc<AtomicBool>,
    last_hide: Arc<Mutex<Option<Instant>>>,
}

impl StandbyManager {
    pub fn new() -> Self {
        Self {
            timer_active: Arc::new(AtomicBool::new(false)),
            last_hide: Arc::new(Mutex::new(None)),
        }
    }

    pub fn start_countdown(&self, app_handle: tauri::AppHandle) {
        if !STANDBY_ENABLED.load(Ordering::Relaxed) {
            app_handle.exit(0);
            return;
        }

        self.timer_active.store(true, Ordering::Relaxed);
        *self.last_hide.lock().unwrap() = Some(Instant::now());

        let timer_active = Arc::clone(&self.timer_active);
        let last_hide = Arc::clone(&self.last_hide);

        std::thread::spawn(move || {
            loop {
                std::thread::sleep(Duration::from_secs(2));
                if !timer_active.load(Ordering::Relaxed) {
                    break;
                }

                let should_exit = {
                    let lock = last_hide.lock().unwrap();
                    if let Some(time) = *lock {
                        time.elapsed() >= Duration::from_secs(STANDBY_TIMEOUT_SECS)
                    } else {
                        false
                    }
                };

                if should_exit && timer_active.load(Ordering::Relaxed) {
                    app_handle.exit(0);
                    break;
                }
            }
        });
    }

    pub fn cancel_countdown(&self) {
        self.timer_active.store(false, Ordering::Relaxed);
        *self.last_hide.lock().unwrap() = None;
    }
}

#[cfg(target_os = "windows")]
pub fn trim_memory() {
    unsafe {
        use windows::Win32::System::ProcessStatus::K32EmptyWorkingSet;
        use windows::Win32::System::Threading::GetCurrentProcess;
        let _ = K32EmptyWorkingSet(GetCurrentProcess());
    }
}

#[cfg(not(target_os = "windows"))]
pub fn trim_memory() {}

pub fn create_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let settings_item = MenuItem::with_id(app, "tray_settings", "Settings", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let exit_item = MenuItem::with_id(app, "tray_exit", "Exit Bukaake", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&settings_item, &sep, &exit_item])?;
    let icon = app.default_window_icon().cloned().ok_or("No default window icon")?;

    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .tooltip("Bukaake — Photo Viewer")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "tray_settings" => {
                let _ = app.emit("bukaake://open-settings", ());
            }
            "tray_exit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

#[tauri::command]
pub fn set_standby_enabled(enabled: bool) {
    STANDBY_ENABLED.store(enabled, Ordering::Relaxed);
}

#[tauri::command]
pub fn is_standby_enabled() -> bool {
    STANDBY_ENABLED.load(Ordering::Relaxed)
}

#[tauri::command]
pub fn enter_standby(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, StandbyManager>,
) -> Result<(), String> {
    if !STANDBY_ENABLED.load(Ordering::Relaxed) {
        app_handle.exit(0);
        return Ok(());
    }

    if let Some(win) = app_handle.get_webview_window("main") {
        let _ = win.hide();
    }
    trim_memory();
    state.start_countdown(app_handle);
    Ok(())
}


#[tauri::command]
pub fn show_main_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app_handle.get_webview_window("main") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
    }
    Ok(())
}
