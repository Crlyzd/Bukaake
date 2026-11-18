//! Native Windows Share (DataTransferManager) backend (< 200 lines)

use std::path::Path;

#[tauri::command]
pub async fn share_image(app: tauri::AppHandle, window: tauri::WebviewWindow, path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    { launch_share_for_path(app, window, path, None).await }
    #[cfg(not(target_os = "windows"))]
    { let _ = (app, window, path); Err("Windows Share is only supported on Windows".into()) }
}

#[tauri::command]
pub async fn share_image_bytes(
    app: tauri::AppHandle, window: tauri::WebviewWindow, bytes: Vec<u8>, filename: Option<String>,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        if bytes.is_empty() { return Err("Cannot share empty image bytes".into()); }
        let temp_path = tauri::async_runtime::spawn_blocking(move || write_temp_share_png(&bytes))
            .await.map_err(|e| format!("Share temp write task failed: {}", e))??;
        launch_share_for_path(app, window, temp_path, filename.filter(|s| !s.trim().is_empty())).await
    }
    #[cfg(not(target_os = "windows"))]
    { let _ = (app, window, bytes, filename); Err("Windows Share is only supported on Windows".into()) }
}

#[cfg(target_os = "windows")]
fn write_temp_share_png(bytes: &[u8]) -> Result<String, String> {
    use std::time::{Duration, SystemTime, UNIX_EPOCH};
    let dir = std::env::temp_dir().join("Bukaake");
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create temp dir: {}", e))?;
    if let Ok(entries) = std::fs::read_dir(&dir) {
        let now = SystemTime::now();
        for entry in entries.flatten() {
            let s = entry.file_name().to_string_lossy().into_owned();
            if s.starts_with("share_") && s.ends_with(".png") {
                if let Ok(m) = entry.metadata().and_then(|m| m.modified()) {
                    if now.duration_since(m).unwrap_or_default() > Duration::from_secs(300) {
                        let _ = std::fs::remove_file(entry.path());
                    }
                }
            }
        }
    }
    let ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis();
    let file_path = dir.join(format!("share_{}.png", ts));
    std::fs::write(&file_path, bytes).map_err(|e| format!("Failed to write temp share PNG: {}", e))?;
    Ok(file_path.to_string_lossy().into_owned())
}

#[cfg(target_os = "windows")]
fn is_image_extension(path: &Path) -> bool {
    path.extension().and_then(|e| e.to_str())
        .map(|ext| matches!(ext.to_ascii_lowercase().as_str(), "png" | "jpg" | "jpeg" | "bmp" | "gif" | "webp"))
        .unwrap_or(false)
}

#[cfg(target_os = "windows")]
async fn launch_share_for_path(
    app: tauri::AppHandle, window: tauri::WebviewWindow, path: String, title_override: Option<String>,
) -> Result<(), String> {
    let clean = path.strip_prefix(r"\\?\").unwrap_or(&path).replace('/', "\\");
    let path_obj = Path::new(&clean);
    if !path_obj.exists() { return Err(format!("Share file does not exist: {}", clean)); }
    let title = title_override.unwrap_or_else(|| {
        path_obj.file_name().and_then(|n| n.to_str()).unwrap_or("Bukaake Image").to_string()
    });
    let is_image = is_image_extension(path_obj);
    let (tx, rx) = std::sync::mpsc::sync_channel::<Result<(), String>>(1);
    let app_clone = app.clone();
    app.run_on_main_thread(move || { let _ = tx.send(show_winrt_share_ui(&app_clone, &window, &clean, &title, is_image)); })
        .map_err(|e| format!("Failed to marshal share to UI thread: {}", e))?;
    tauri::async_runtime::spawn_blocking(move || rx.recv().unwrap_or_else(|e| Err(format!("Share UI channel closed: {}", e))))
        .await.map_err(|e| format!("Share await failed: {}", e))?
}

#[cfg(target_os = "windows")]
fn cleanup_after_share(window: &tauri::WebviewWindow, is_snipper: bool, restore_topmost: bool) {
    if is_snipper {
        let _ = window.set_ignore_cursor_events(false);
        let _ = window.hide();
        crate::platform::reclaim::set_snip_active(false);
    } else if restore_topmost {
        let _ = window.set_always_on_top(true);
    }
}

#[cfg(target_os = "windows")]
fn show_winrt_share_ui(
    app: &tauri::AppHandle, window: &tauri::WebviewWindow, win_path: &str, title: &str, is_image: bool,
) -> Result<(), String> {
    use std::{collections::HashMap, sync::{atomic::{AtomicBool, Ordering}, Arc, Mutex, OnceLock}, time::Duration};
    use windows::ApplicationModel::DataTransfer::{DataRequestedEventArgs, DataTransferManager, TargetApplicationChosenEventArgs};
    use windows::core::{factory, Interface, HSTRING};
    use windows::Foundation::{EventRegistrationToken, TypedEventHandler};
    use windows::Storage::{IStorageItem, StorageFile, Streams::RandomAccessStreamReference};
    use windows::Win32::{Foundation::HWND, UI::{Shell::IDataTransferManagerInterop, WindowsAndMessaging::GetForegroundWindow}};

    static TOKENS: OnceLock<Mutex<HashMap<isize, (i64, i64)>>> = OnceLock::new();
    let hwnd_raw = window.hwnd().map_err(|e| format!("Invalid window HWND: {}", e))?;
    let (hwnd, hwnd_key, label) = (HWND(hwnd_raw.0), hwnd_raw.0 as isize, window.label().to_string());
    let is_snipper = label == "snipper";
    let restore_main_topmost = if is_snipper {
        let _ = window.set_always_on_top(false);
        let _ = window.set_ignore_cursor_events(true);
        false
    } else if label == "main" && window.is_always_on_top().unwrap_or(false) {
        let _ = window.set_always_on_top(false);
        true
    } else { false };

    let interop: IDataTransferManagerInterop = factory::<DataTransferManager, IDataTransferManagerInterop>()
        .map_err(|e| format!("IDataTransferManagerInterop unavailable: {}", e))?;
    let dtm: DataTransferManager = unsafe { interop.GetForWindow(hwnd).map_err(|e| format!("GetForWindow failed: {}", e))? };

    let token_map = TOKENS.get_or_init(|| Mutex::new(HashMap::new()));
    if let Ok(mut map) = token_map.lock() {
        if let Some((old_req, old_chosen)) = map.remove(&hwnd_key) {
            let _ = dtm.RemoveDataRequested(EventRegistrationToken { Value: old_req });
            let _ = dtm.RemoveTargetApplicationChosen(EventRegistrationToken { Value: old_chosen });
        }
    }

    let (path_owned, title_owned) = (win_path.to_string(), title.to_string());
    let req_token = dtm.DataRequested(&TypedEventHandler::<DataTransferManager, DataRequestedEventArgs>::new(move |_, args| {
        let Some(args) = args.as_ref() else { return Ok(()); };
        let request = args.Request()?;
        let deferral = request.GetDeferral()?;
        let res = (|| -> windows::core::Result<()> {
            let data = request.Data()?;
            let props = data.Properties()?;
            props.SetTitle(&HSTRING::from(&title_owned))?;
            props.SetDescription(&HSTRING::from("Shared from Bukaake"))?;
            let storage_file = StorageFile::GetFileFromPathAsync(&HSTRING::from(&path_owned))?.get()?;
            data.SetStorageItemsReadOnly(&single_storage_item_iterable(storage_file.cast::<IStorageItem>()?))?;
            if is_image { data.SetBitmap(&RandomAccessStreamReference::CreateFromFile(&storage_file)?)?; }
            Ok(())
        })();
        let _ = deferral.Complete();
        res
    })).map_err(|e| format!("DataRequested registration failed: {}", e))?;

    let done = Arc::new(AtomicBool::new(false));
    let (win_chosen, done_chosen) = (window.clone(), Arc::clone(&done));
    let chosen_token = dtm.TargetApplicationChosen(&TypedEventHandler::<DataTransferManager, TargetApplicationChosenEventArgs>::new(move |_, _| {
        if !done_chosen.swap(true, Ordering::AcqRel) { cleanup_after_share(&win_chosen, is_snipper, restore_main_topmost); }
        Ok(())
    })).map_err(|e| format!("TargetApplicationChosen registration failed: {}", e))?;

    if let Ok(mut map) = token_map.lock() { map.insert(hwnd_key, (req_token.Value, chosen_token.Value)); }
    if let Err(e) = unsafe { interop.ShowShareUIForWindow(hwnd) } {
        if !done.swap(true, Ordering::AcqRel) { cleanup_after_share(window, is_snipper, restore_main_topmost); }
        return Err(format!("ShowShareUIForWindow failed: {}", e));
    }
    if is_snipper || restore_main_topmost {
        let (app_w, win_w, done_w) = (app.clone(), window.clone(), Arc::clone(&done));
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(600));
            let share_fg = unsafe { GetForegroundWindow().0 as isize };
            if share_fg != 0 && share_fg != hwnd_key {
                for _ in 0..400 {
                    if done_w.load(Ordering::Acquire) || unsafe { GetForegroundWindow().0 as isize } != share_fg { break; }
                    std::thread::sleep(Duration::from_millis(150));
                }
            }
            if !done_w.swap(true, Ordering::AcqRel) {
                let _ = app_w.run_on_main_thread(move || cleanup_after_share(&win_w, is_snipper, restore_main_topmost));
            }
        });
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn single_storage_item_iterable(item: windows::Storage::IStorageItem) -> windows::Foundation::Collections::IIterable<windows::Storage::IStorageItem> {
    use core::ffi::c_void;
    use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
    use windows::core::{IInspectable, IInspectable_Vtbl, IUnknown, IUnknown_Vtbl, Interface, GUID, HRESULT};
    use windows::Foundation::Collections::{IIterable, IIterable_Vtbl, IIterator, IIterator_Vtbl};
    use windows::Storage::IStorageItem;
    use windows::Win32::Foundation::{E_BOUNDS, E_NOTIMPL, E_NOINTERFACE, S_FALSE, S_OK};

    #[repr(C)] struct IterObj { vtbl: *const IIterator_Vtbl<IStorageItem>, refs: AtomicU32, item: IStorageItem, has: AtomicBool }
    #[repr(C)] struct EnumObj { vtbl: *const IIterable_Vtbl<IStorageItem>, refs: AtomicU32, item: IStorageItem }
    struct SyncVtbl<T>(T);
    unsafe impl<T> Sync for SyncVtbl<T> {}

    unsafe extern "system" fn qi(this: *mut c_void, iid: *const GUID, out: *mut *mut c_void, target: GUID) -> HRESULT {
        if *iid == target || *iid == IUnknown::IID || *iid == IInspectable::IID {
            *out = this; ((*(*(this as *const *const IUnknown_Vtbl))).AddRef)(this); S_OK
        } else { *out = core::ptr::null_mut(); E_NOINTERFACE }
    }
    unsafe extern "system" fn enum_qi(t: *mut c_void, i: *const GUID, o: *mut *mut c_void) -> HRESULT { qi(t, i, o, IIterable::<IStorageItem>::IID) }
    unsafe extern "system" fn iter_qi(t: *mut c_void, i: *const GUID, o: *mut *mut c_void) -> HRESULT { qi(t, i, o, IIterator::<IStorageItem>::IID) }
    unsafe extern "system" fn add_ref(this: *mut c_void) -> u32 { (*(this as *const EnumObj)).refs.fetch_add(1, Ordering::Relaxed) + 1 }
    unsafe extern "system" fn enum_rel(this: *mut c_void) -> u32 {
        let r = (*(this as *const EnumObj)).refs.fetch_sub(1, Ordering::Release) - 1;
        if r == 0 { core::sync::atomic::fence(Ordering::Acquire); drop(Box::from_raw(this as *mut EnumObj)); } r
    }
    unsafe extern "system" fn iter_rel(this: *mut c_void) -> u32 {
        let r = (*(this as *const IterObj)).refs.fetch_sub(1, Ordering::Release) - 1;
        if r == 0 { core::sync::atomic::fence(Ordering::Acquire); drop(Box::from_raw(this as *mut IterObj)); } r
    }
    unsafe extern "system" fn stub_iids(_: *mut c_void, _: *mut u32, _: *mut *mut GUID) -> HRESULT { E_NOTIMPL }
    unsafe extern "system" fn stub_name(_: *mut c_void, _: *mut *mut c_void) -> HRESULT { E_NOTIMPL }
    unsafe extern "system" fn stub_trust(_: *mut c_void, _: *mut i32) -> HRESULT { E_NOTIMPL }
    unsafe extern "system" fn first(this: *mut c_void, out: *mut *mut c_void) -> HRESULT {
        *out = Box::into_raw(Box::new(IterObj { vtbl: &ITER_VTBL.0, refs: AtomicU32::new(1), item: (*(this as *const EnumObj)).item.clone(), has: AtomicBool::new(true) })) as *mut c_void; S_OK
    }
    unsafe extern "system" fn current(this: *mut c_void, out: *mut *mut c_void) -> HRESULT {
        let o = &*(this as *const IterObj);
        if o.has.load(Ordering::Relaxed) { *out = o.item.clone().into_raw(); S_OK } else { *out = core::ptr::null_mut(); E_BOUNDS }
    }
    unsafe extern "system" fn has_cur(this: *mut c_void, out: *mut bool) -> HRESULT { *out = (*(this as *const IterObj)).has.load(Ordering::Relaxed); S_OK }
    unsafe extern "system" fn move_next(this: *mut c_void, out: *mut bool) -> HRESULT { (*(this as *const IterObj)).has.store(false, Ordering::Relaxed); *out = false; S_OK }
    unsafe extern "system" fn get_many(this: *mut c_void, cap: u32, items: *mut *mut c_void, out: *mut u32) -> HRESULT {
        let o = &*(this as *const IterObj);
        if cap > 0 && o.has.swap(false, Ordering::Relaxed) { *items = o.item.clone().into_raw(); *out = 1; S_OK } else { *out = 0; S_FALSE }
    }

    static ENUM_VTBL: SyncVtbl<IIterable_Vtbl<IStorageItem>> = SyncVtbl(IIterable_Vtbl {
        base__: IInspectable_Vtbl { base: IUnknown_Vtbl { QueryInterface: enum_qi, AddRef: add_ref, Release: enum_rel }, GetIids: stub_iids, GetRuntimeClassName: stub_name, GetTrustLevel: stub_trust }, First: first, T: core::marker::PhantomData,
    });
    static ITER_VTBL: SyncVtbl<IIterator_Vtbl<IStorageItem>> = SyncVtbl(IIterator_Vtbl {
        base__: IInspectable_Vtbl { base: IUnknown_Vtbl { QueryInterface: iter_qi, AddRef: add_ref, Release: iter_rel }, GetIids: stub_iids, GetRuntimeClassName: stub_name, GetTrustLevel: stub_trust }, Current: current, HasCurrent: has_cur, MoveNext: move_next, GetMany: get_many, T: core::marker::PhantomData,
    });
    unsafe { IIterable::from_raw(Box::into_raw(Box::new(EnumObj { vtbl: &ENUM_VTBL.0, refs: AtomicU32::new(1), item })) as *mut c_void) }
}
