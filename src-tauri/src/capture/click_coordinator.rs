/**
 * Bukaake Click Effects Coordinator
 * Encapsulates global mouse hook, visual halo overlay, and audio mixer injection (< 85 lines)
 */

use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use crate::capture::click_overlay;
use crate::capture::click_sound;
use crate::capture::mouse_hook;
use crate::capture::audio_mixer;

static IS_ACTIVE: AtomicBool = AtomicBool::new(false);
static SHOW_VISUAL: AtomicBool = AtomicBool::new(false);
static PLAY_SOUND: AtomicBool = AtomicBool::new(false);
static CLICK_VOLUME: AtomicU32 = AtomicU32::new(700); // 0.70 default

pub fn start_click_effects(show_clicks: bool, sound_clicks: bool, volume: f32) {
    if !show_clicks && !sound_clicks {
        stop_click_effects();
        return;
    }

    let vol_u32 = (volume.clamp(0.0, 1.0) * 1000.0) as u32;
    CLICK_VOLUME.store(vol_u32, Ordering::Relaxed);
    SHOW_VISUAL.store(show_clicks, Ordering::Relaxed);
    PLAY_SOUND.store(sound_clicks, Ordering::Relaxed);
    IS_ACTIVE.store(true, Ordering::Relaxed);

    let _ = mouse_hook::start_mouse_hook(move |x, y, is_right| {
        if !IS_ACTIVE.load(Ordering::Relaxed) {
            return;
        }

        if SHOW_VISUAL.load(Ordering::Relaxed) {
            click_overlay::trigger_click_ripple(x, y, is_right);
        }

        if PLAY_SOUND.load(Ordering::Relaxed) {
            let vol = CLICK_VOLUME.load(Ordering::Relaxed) as f32 / 1000.0;
            let samples = click_sound::generate_click_stereo_f32(is_right, vol);
            audio_mixer::inject_click_transient(samples);
        }
    });
}

pub fn stop_click_effects() {
    IS_ACTIVE.store(false, Ordering::Relaxed);
    mouse_hook::stop_mouse_hook();
    click_overlay::hide_click_overlay();
    audio_mixer::clear_click_transients();
}
