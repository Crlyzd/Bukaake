/**
 * Bukaake Native Click Sound Generator
 * Generates punchy, tactile 48kHz stereo PCM waveforms with high perceived loudness (< 100 lines)
 */

use std::f32::consts::PI;

/// Synthesize a rich, punchy 48kHz stereo (f32, f32) waveform with rapid attack,
/// tactile pitch sweep, and high-energy soft saturation for clear audible presence.
pub fn generate_click_stereo_f32(is_right_click: bool, volume: f32) -> Vec<(f32, f32)> {
    const SAMPLE_RATE: usize = 48_000;
    let vol = volume.clamp(0.0, 1.0);
    if vol <= 0.001 {
        return Vec::new();
    }

    let (duration_secs, peak_cap) = if is_right_click {
        (0.036, 0.92) // Crisp, bright metallic tick (~36ms)
    } else {
        (0.046, 0.98) // Punchy, tactile mechanical clack (~46ms)
    };

    let total_samples = (SAMPLE_RATE as f32 * duration_secs) as usize;
    let mut samples = Vec::with_capacity(total_samples);

    for i in 0..total_samples {
        let t = i as f32 / SAMPLE_RATE as f32;

        let raw = if is_right_click {
            // Right Click: bright 4400Hz snap + 1200Hz-3200Hz pitch glide
            let snap = (-1800.0 * t).exp() * (2.0 * PI * 4400.0 * t).sin();
            let phase = 2.0 * PI * (1200.0 * t + (2000.0 / 220.0) * (1.0 - (-220.0 * t).exp()));
            let body = phase.sin();
            let env = if t < 0.0008 { t / 0.0008 } else { (-75.0 * (t - 0.0008)).exp() };
            (snap * 0.75 + body * 0.65) * env * 2.2
        } else {
            // Left Click: sharp 3200Hz switch snap + 750Hz-2200Hz mechanical body glide + sub-thump
            let snap = (-1200.0 * t).exp() * (2.0 * PI * 3200.0 * t).sin();
            let phase = 2.0 * PI * (750.0 * t + (1450.0 / 160.0) * (1.0 - (-160.0 * t).exp()));
            let body = phase.sin();
            let sub = (2.0 * PI * 400.0 * t).sin() * (-90.0 * t).exp() * 0.35;
            let env = if t < 0.001 { t / 0.001 } else { (-52.0 * (t - 0.001)).exp() };
            (snap * 0.65 + body * 0.70 + sub) * env * 2.4
        };

        // Gentle hyperbolic tangent saturation boosts RMS energy & loudness while capping peak cleanly
        let s = raw.tanh() * peak_cap * vol;
        samples.push((s, s));
    }

    samples
}
