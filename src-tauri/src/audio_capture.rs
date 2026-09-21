/**
 * Bukaake Native WASAPI Audio Capture Engine
 * Un-sandboxed system loopback + mic capture, master volume compensation,
 * adaptive dual-queue clock sync, and low-latency PCM streaming (< 250 lines)
 */

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::ipc::Channel;

use crate::audio_mixer::{mix_and_quantize_stereo, ResamplingQueue};

static IS_MIC_MUTED: AtomicBool = AtomicBool::new(false);
static SYS_VOLUME: AtomicU32 = AtomicU32::new(100); // 100% 1:1 bit-exact
static MIC_VOLUME: AtomicU32 = AtomicU32::new(100); // 100%
static IS_CAPTURING: AtomicBool = AtomicBool::new(false);

#[allow(dead_code)]
struct SendStream(cpal::Stream);
unsafe impl Send for SendStream {}
unsafe impl Sync for SendStream {}

struct ActiveStreams {
    _sys_stream: Option<SendStream>,
    _mic_stream: Option<SendStream>,
}

static ACTIVE_SESSION: Mutex<Option<ActiveStreams>> = Mutex::new(None);

pub fn set_mic_muted(muted: bool) {
    IS_MIC_MUTED.store(muted, Ordering::Relaxed);
}

pub fn set_audio_volumes(sys_vol: f32, mic_vol: f32) {
    let s = (sys_vol.clamp(0.0, 2.0) * 100.0) as u32;
    let m = (mic_vol.clamp(0.0, 3.0) * 100.0) as u32;
    SYS_VOLUME.store(s, Ordering::Relaxed);
    MIC_VOLUME.store(m, Ordering::Relaxed);
}

pub fn stop_capture() {
    IS_CAPTURING.store(false, Ordering::SeqCst);
    if let Ok(mut session) = ACTIVE_SESSION.lock() {
        *session = None;
    }
}

pub fn start_capture(
    channel: Channel<Vec<u8>>,
    record_sys: bool,
    record_mic: bool,
) -> Result<(), String> {
    stop_capture();

    let host = cpal::default_host();
    let sys_queue = Arc::new(Mutex::new(ResamplingQueue::new(48000)));
    let mic_queue = Arc::new(Mutex::new(ResamplingQueue::new(48000)));

    let mut sys_stream = None;
    if record_sys {
        if let Some(device) = host.default_output_device() {
            if let Ok(config) = device.default_output_config() {
                let sample_format = config.sample_format();
                let channels = config.channels() as usize;
                let sample_rate = config.sample_rate().0;

                {
                    let mut q = sys_queue.lock().unwrap();
                    q.set_sample_rate(sample_rate);
                }

                let q = Arc::clone(&sys_queue);
                let err_fn = |err| eprintln!("[AudioCapture] System loopback error: {}", err);

                let stream_res = match sample_format {
                    cpal::SampleFormat::F32 => device.build_input_stream(
                        &config.into(),
                        move |data: &[f32], _| {
                            if let Ok(mut lock) = q.lock() {
                                lock.push_f32_interleaved(data, channels);
                            }
                        },
                        err_fn,
                        None,
                    ),
                    cpal::SampleFormat::I16 => device.build_input_stream(
                        &config.into(),
                        move |data: &[i16], _| {
                            if let Ok(mut lock) = q.lock() {
                                lock.push_i16_interleaved(data, channels);
                            }
                        },
                        err_fn,
                        None,
                    ),
                    _ => Err(cpal::BuildStreamError::DeviceNotAvailable),
                };

                if let Ok(stream) = stream_res {
                    let _ = stream.play();
                    sys_stream = Some(SendStream(stream));
                }
            }
        }
    }

    let mut mic_stream = None;
    if record_mic {
        if let Some(device) = host.default_input_device() {
            if let Ok(config) = device.default_input_config() {
                let sample_format = config.sample_format();
                let channels = config.channels() as usize;
                let sample_rate = config.sample_rate().0;

                {
                    let mut q = mic_queue.lock().unwrap();
                    q.set_sample_rate(sample_rate);
                }

                let q = Arc::clone(&mic_queue);
                let err_fn = |err| eprintln!("[AudioCapture] Mic capture error: {}", err);

                let stream_res = match sample_format {
                    cpal::SampleFormat::F32 => device.build_input_stream(
                        &config.into(),
                        move |data: &[f32], _| {
                            if IS_MIC_MUTED.load(Ordering::Relaxed) {
                                return;
                            }
                            if let Ok(mut lock) = q.lock() {
                                lock.push_f32_interleaved(data, channels);
                            }
                        },
                        err_fn,
                        None,
                    ),
                    cpal::SampleFormat::I16 => device.build_input_stream(
                        &config.into(),
                        move |data: &[i16], _| {
                            if IS_MIC_MUTED.load(Ordering::Relaxed) {
                                return;
                            }
                            if let Ok(mut lock) = q.lock() {
                                lock.push_i16_interleaved(data, channels);
                            }
                        },
                        err_fn,
                        None,
                    ),
                    _ => Err(cpal::BuildStreamError::DeviceNotAvailable),
                };

                if let Ok(stream) = stream_res {
                    let _ = stream.play();
                    mic_stream = Some(SendStream(stream));
                }
            }
        }
    }

    IS_CAPTURING.store(true, Ordering::SeqCst);
    if let Ok(mut session) = ACTIVE_SESSION.lock() {
        *session = Some(ActiveStreams {
            _sys_stream: sys_stream,
            _mic_stream: mic_stream,
        });
    }

    // Dynamic adaptive drain: empties available hardware frames on every tick for zero backlog lag
    let q_sys_flush = Arc::clone(&sys_queue);
    let q_mic_flush = Arc::clone(&mic_queue);

    thread::spawn(move || {
        const TARGET_RATE: u32 = 48000;
        const TICK_MS: u64 = 25; // Responsive 25ms tick

        while IS_CAPTURING.load(Ordering::Relaxed) {
            thread::sleep(Duration::from_millis(TICK_MS));

            let sys_frames = if record_sys {
                if let Ok(mut q_sys) = q_sys_flush.lock() {
                    let rate = q_sys.sample_rate();
                    if rate == TARGET_RATE {
                        q_sys.drain_all_stereo()
                    } else {
                        let avail = q_sys.available_frames();
                        let count = (avail as f64 * TARGET_RATE as f64 / rate as f64) as usize;
                        q_sys.read_resampled_stereo(count, TARGET_RATE)
                    }
                } else {
                    Vec::new()
                }
            } else {
                Vec::new()
            };

            let target_len = sys_frames.len();

            let mic_frames = if record_mic {
                if let Ok(mut q_mic) = q_mic_flush.lock() {
                    if target_len > 0 {
                        // Synchronize to desktop master clock
                        q_mic.read_resampled_stereo(target_len, TARGET_RATE)
                    } else {
                        // Mic standalone master clock
                        let avail = q_mic.available_frames();
                        let rate = q_mic.sample_rate();
                        let count = (avail as f64 * TARGET_RATE as f64 / rate as f64) as usize;
                        q_mic.read_resampled_stereo(count, TARGET_RATE)
                    }
                } else {
                    Vec::new()
                }
            } else {
                Vec::new()
            };

            let sys_frames = if sys_frames.is_empty() && !mic_frames.is_empty() {
                vec![(0.0, 0.0); mic_frames.len()]
            } else {
                sys_frames
            };

            if sys_frames.is_empty() && mic_frames.is_empty() {
                continue;
            }

            let sys_gain = SYS_VOLUME.load(Ordering::Relaxed) as f32 / 100.0;
            let mic_gain = MIC_VOLUME.load(Ordering::Relaxed) as f32 / 100.0;
            let is_mic_muted = IS_MIC_MUTED.load(Ordering::Relaxed);

            let pcm_bytes = mix_and_quantize_stereo(
                &sys_frames,
                &mic_frames,
                sys_gain,
                mic_gain,
                is_mic_muted,
            );

            if channel.send(pcm_bytes).is_err() {
                break;
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn start_audio_capture(
    channel: Channel<Vec<u8>>,
    record_sys: bool,
    record_mic: bool,
) -> Result<(), String> {
    start_capture(channel, record_sys, record_mic)
}

#[tauri::command]
pub fn stop_audio_capture() -> Result<(), String> {
    stop_capture();
    Ok(())
}

#[tauri::command]
pub fn set_recording_mic_muted(muted: bool) -> Result<(), String> {
    set_mic_muted(muted);
    Ok(())
}

#[tauri::command]
pub fn set_recording_audio_volumes(sys_vol: f32, mic_vol: f32) -> Result<(), String> {
    set_audio_volumes(sys_vol, mic_vol);
    Ok(())
}
