/**
 * Bukaake Native Screen Recorder Coordinator
 * State machine orchestrating WGC, Direct3D 11, WMF H.264/AAC writer, and WASAPI audio (< 260 lines)
 */

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use serde::{Deserialize, Serialize};
use windows::Win32::Graphics::Direct3D11::{ID3D11Texture2D, D3D11_BIND_RENDER_TARGET, D3D11_BIND_SHADER_RESOURCE};
use windows::Win32::Graphics::Dxgi::Common::DXGI_FORMAT_B8G8R8A8_UNORM;

use crate::d3d_device::D3DContext;
use crate::wgc_capture::WgcCaptureSession;
use crate::wmf_writer::WmfWriter;

#[derive(Deserialize, Clone, Copy, Debug)]
pub struct CaptureRegion {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Serialize, Clone, Debug)]
pub struct NativeRecordingResult {
    pub temp_path: String,
    pub duration_secs: u64,
    pub duration_ms: u64,
}

struct RecorderState {
    _d3d: Arc<D3DContext>,
    writer: Arc<WmfWriter>,
    session: WgcCaptureSession,
    start_time: Instant,
    pause_start: Option<Instant>,
    total_paused: Duration,
    is_paused: Arc<AtomicBool>,
    is_running: Arc<AtomicBool>,
    _last_video_pts: Arc<AtomicI64>,
    _last_audio_pts: Arc<AtomicI64>,
    temp_path: PathBuf,
}

unsafe impl Send for RecorderState {}
unsafe impl Sync for RecorderState {}

static RECORDER_INSTANCE: Mutex<Option<RecorderState>> = Mutex::new(None);

pub fn is_recording_active() -> bool {
    if let Ok(lock) = RECORDER_INSTANCE.lock() {
        lock.is_some()
    } else {
        false
    }
}

pub fn start_native_recording(
    dest_file: PathBuf,
    region: Option<CaptureRegion>,
    fps: u32,
    bitrate: u32,
    record_sys: bool,
    record_mic: bool,
) -> Result<String, String> {
    stop_native_recording().ok();

    crate::process_memory::set_recording_memory_lockout(true);

    let d3d = Arc::new(D3DContext::new().map_err(|e| format!("D3D11 init failed: {}", e))?);

    // Initial dummy session probe or default dimensions
    let target_fps = fps.clamp(15, 120);
    let target_bitrate = bitrate.clamp(1_000_000, 50_000_000);
    let include_audio = record_sys || record_mic;

    let is_paused = Arc::new(AtomicBool::new(false));
    let is_running = Arc::new(AtomicBool::new(true));
    let last_video_pts = Arc::new(AtomicI64::new(0));
    let last_audio_pts = Arc::new(AtomicI64::new(0));

    // Determine target dimensions
    let (target_w, target_h) = if let Some(ref r) = region {
        // Enforce even dimensions required for H.264
        (r.width & !1, r.height & !1)
    } else {
        let (mon_w, mon_h) = WgcCaptureSession::get_target_monitor_size(None).unwrap_or((1920, 1080));
        (mon_w & !1, mon_h & !1)
    };

    let writer = Arc::new(
        WmfWriter::new(
            &d3d,
            &dest_file,
            target_w.max(64),
            target_h.max(64),
            target_fps,
            target_bitrate,
            include_audio,
        )
        .map_err(|e| format!("WMF SinkWriter init failed: {}", e))?,
    );

    // Allocate crop texture if cropped region specified
    let crop_texture: Option<ID3D11Texture2D> = if region.is_some() {
        Some(
            d3d.create_texture(
                target_w.max(64),
                target_h.max(64),
                DXGI_FORMAT_B8G8R8A8_UNORM,
                D3D11_BIND_RENDER_TARGET | D3D11_BIND_SHADER_RESOURCE,
            )
            .map_err(|e| format!("Crop texture allocation failed: {}", e))?,
        )
    } else {
        None
    };

    let writer_frame = Arc::clone(&writer);
    let d3d_frame = Arc::clone(&d3d);
    let paused_frame = Arc::clone(&is_paused);
    let running_frame = Arc::clone(&is_running);
    let last_pts_frame = Arc::clone(&last_video_pts);
    let start_instant = Instant::now();
    // Allow small 2ms leeway so we don't drop target-rate frames due to minor timer jitter
    let min_frame_interval_100ns = (10_000_000 / target_fps as i64) - 20_000;

    // Start WGC capture session
    let session = WgcCaptureSession::new(&d3d, None, true, move |frame| {
        if !running_frame.load(Ordering::Relaxed) || paused_frame.load(Ordering::Relaxed) {
            return;
        }

        let elapsed = start_instant.elapsed();
        let pts = (elapsed.as_nanos() / 100) as i64;
        let prev = last_pts_frame.load(Ordering::Relaxed);

        // Throttle incoming frames to requested target_fps (e.g. 30 FPS or 60 FPS on 144Hz monitors)
        if prev > 0 && (pts - prev) < min_frame_interval_100ns {
            return;
        }

        let safe_pts = if pts <= prev { prev + 10 } else { pts };
        last_pts_frame.store(safe_pts, Ordering::Relaxed);

        if let Some(ref crop_tex) = crop_texture {
            if let Some(ref r) = region {
                let crop_x = r.x.max(0) as u32;
                let crop_y = r.y.max(0) as u32;
                d3d_frame.crop_subresource(&frame.texture, crop_tex, crop_x, crop_y, target_w, target_h);
                if let Err(e) = writer_frame.write_video_frame(crop_tex, safe_pts) {
                    eprintln!("[NativeRecorder] crop write_video_frame failed: {e}");
                }
                return;
            }
        }

        if let Err(e) = writer_frame.write_video_frame(&frame.texture, safe_pts) {
            eprintln!("[NativeRecorder] fullscreen write_video_frame failed: {e}");
        }
    })
    .map_err(|e| format!("WGC session start failed: {}", e))?;

    // Audio capture hookup if enabled
    if include_audio {
        let writer_audio = Arc::clone(&writer);
        let paused_audio = Arc::clone(&is_paused);
        let running_audio = Arc::clone(&is_running);
        let last_audio_pts_clone = Arc::clone(&last_audio_pts);

        crate::audio_capture::start_audio_feed(record_sys, record_mic, move |pcm_chunk| {
            if !running_audio.load(Ordering::Relaxed) || paused_audio.load(Ordering::Relaxed) || pcm_chunk.is_empty() {
                return;
            }
            // 48,000 samples/sec * 4 bytes/sample = 192,000 bytes/sec
            let chunk_dur_100ns = (pcm_chunk.len() as i64 * 10_000_000) / 192_000;
            let pts = last_audio_pts_clone.fetch_add(chunk_dur_100ns, Ordering::Relaxed);

            let _ = writer_audio.write_audio_pcm(&pcm_chunk, pts);
        })
        .map_err(|e| format!("WASAPI audio start failed: {}", e))?;
    }

    let temp_str = dest_file.to_string_lossy().to_string();
    let state = RecorderState {
        _d3d: d3d,
        writer,
        session,
        start_time: start_instant,
        pause_start: None,
        total_paused: Duration::ZERO,
        is_paused,
        is_running,
        _last_video_pts: last_video_pts,
        _last_audio_pts: last_audio_pts,
        temp_path: dest_file,
    };

    if let Ok(mut lock) = RECORDER_INSTANCE.lock() {
        *lock = Some(state);
    }

    Ok(temp_str)
}

pub fn pause_native_recording() -> Result<(), String> {
    if let Ok(mut lock) = RECORDER_INSTANCE.lock() {
        if let Some(ref mut state) = *lock {
            if !state.is_paused.load(Ordering::Relaxed) {
                state.is_paused.store(true, Ordering::SeqCst);
                state.pause_start = Some(Instant::now());
            }
            return Ok(());
        }
    }
    Err("No active recording session to pause".into())
}

pub fn resume_native_recording() -> Result<(), String> {
    if let Ok(mut lock) = RECORDER_INSTANCE.lock() {
        if let Some(ref mut state) = *lock {
            if state.is_paused.load(Ordering::Relaxed) {
                state.is_paused.store(false, Ordering::SeqCst);
                if let Some(pause_time) = state.pause_start.take() {
                    state.total_paused += pause_time.elapsed();
                }
            }
            return Ok(());
        }
    }
    Err("No active recording session to resume".into())
}

pub fn stop_native_recording() -> Result<NativeRecordingResult, String> {
    crate::process_memory::set_recording_memory_lockout(false);
    crate::audio_capture::stop_capture();

    let state = {
        let mut lock = RECORDER_INSTANCE.lock().map_err(|e| e.to_string())?;
        lock.take()
    };

    if let Some(state) = state {
        state.is_running.store(false, Ordering::SeqCst);
        state.session.stop();

        let total_duration = state.start_time.elapsed().saturating_sub(state.total_paused);
        let duration_ms = total_duration.as_millis() as u64;
        let duration_secs = total_duration.as_secs();

        // Finalize MP4 file headers
        state.writer.finalize().map_err(|e| format!("SinkWriter finalize failed: {}", e))?;

        crate::process_memory::trim_process_tree();

        Ok(NativeRecordingResult {
            temp_path: state.temp_path.to_string_lossy().to_string(),
            duration_secs,
            duration_ms,
        })
    } else {
        Err("No active recording session".into())
    }
}

pub fn discard_native_recording() -> Result<(), String> {
    let res = stop_native_recording();
    if let Ok(record) = res {
        let p = Path::new(&record.temp_path);
        if p.exists() {
            let _ = std::fs::remove_file(p);
        }
    }
    Ok(())
}
