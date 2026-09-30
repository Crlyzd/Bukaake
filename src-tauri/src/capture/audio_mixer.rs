/**
 * Bukaake Native Audio Mixer Engine
 * Dual-source FIFO resampling queue, clock synchronization,
 * soft-knee transparent peak limiter, and 16-bit PCM quantization (< 175 lines)
 */

use std::collections::VecDeque;

#[inline(always)]
pub fn transparent_limit(s: f32) -> f32 {
    if s.abs() <= 0.92 {
        s // Bit-exact pristine pass-through without harmonic distortion
    } else if s > 0.0 {
        0.92 + (s - 0.92).tanh() * 0.079
    } else {
        -0.92 + (s + 0.92).tanh() * 0.079
    }
}

pub struct ResamplingQueue {
    buffer: VecDeque<(f32, f32)>,
    sample_rate: u32,
    phase: f64,
    last_frame: (f32, f32),
}

impl ResamplingQueue {
    pub fn new(sample_rate: u32) -> Self {
        Self {
            buffer: VecDeque::with_capacity(9600),
            sample_rate: sample_rate.max(8000),
            phase: 0.0,
            last_frame: (0.0, 0.0),
        }
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate.max(8000);
    }

    pub fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    pub fn available_frames(&self) -> usize {
        self.buffer.len()
    }

    pub fn push_f32_interleaved(&mut self, data: &[f32], channels: usize) {
        let ch = channels.max(1);
        for frame in data.chunks(ch) {
            let l = frame.first().copied().unwrap_or(0.0);
            let r = if ch > 1 {
                frame.get(1).copied().unwrap_or(l)
            } else {
                l
            };
            self.buffer.push_back((l, r));
        }

        // Cap queue to 200ms to prevent memory or latency accumulation
        let max_len = (self.sample_rate as f32 * 0.20) as usize;
        if self.buffer.len() > max_len {
            let excess = self.buffer.len() - max_len;
            self.buffer.drain(..excess);
        }
    }

    pub fn push_i16_interleaved(&mut self, data: &[i16], channels: usize) {
        let ch = channels.max(1);
        for frame in data.chunks(ch) {
            let l = frame.first().copied().unwrap_or(0) as f32 / 32768.0;
            let r = if ch > 1 {
                frame.get(1).copied().unwrap_or(0) as f32 / 32768.0
            } else {
                l
            };
            self.buffer.push_back((l, r));
        }

        let max_len = (self.sample_rate as f32 * 0.20) as usize;
        if self.buffer.len() > max_len {
            let excess = self.buffer.len() - max_len;
            self.buffer.drain(..excess);
        }
    }

    pub fn drain_all_stereo(&mut self) -> Vec<(f32, f32)> {
        let frames: Vec<(f32, f32)> = self.buffer.drain(..).collect();
        if let Some(&last) = frames.last() {
            self.last_frame = last;
        }
        self.phase = 0.0;
        frames
    }

    pub fn read_resampled_stereo(&mut self, count: usize, target_rate: u32) -> Vec<(f32, f32)> {
        if count == 0 {
            return Vec::new();
        }

        let mut out = Vec::with_capacity(count);
        let step = self.sample_rate as f64 / target_rate as f64;

        for _ in 0..count {
            while self.phase >= 1.0 {
                if let Some(f) = self.buffer.pop_front() {
                    self.last_frame = f;
                    self.phase -= 1.0;
                } else {
                    self.phase = 0.0;
                    self.last_frame = (self.last_frame.0 * 0.9, self.last_frame.1 * 0.9);
                    break;
                }
            }

            let next_frame = self.buffer.front().copied().unwrap_or((0.0, 0.0));
            let frac = self.phase as f32;

            let l = (1.0 - frac) * self.last_frame.0 + frac * next_frame.0;
            let r = (1.0 - frac) * self.last_frame.1 + frac * next_frame.1;
            out.push((l, r));

            self.phase += step;
        }

        out
    }

    pub fn clear(&mut self) {
        self.buffer.clear();
        self.phase = 0.0;
        self.last_frame = (0.0, 0.0);
    }
}

pub fn mix_and_quantize_stereo(
    sys_frames: &[(f32, f32)],
    mic_frames: &[(f32, f32)],
    sys_gain: f32,
    mic_gain: f32,
    is_mic_muted: bool,
) -> Vec<u8> {
    let frame_count = sys_frames.len().max(mic_frames.len());
    let mut pcm_bytes = Vec::with_capacity(frame_count * 4);
    let actual_mic_gain = if is_mic_muted { 0.0 } else { mic_gain };

    for i in 0..frame_count {
        let (sys_l, sys_r) = sys_frames.get(i).copied().unwrap_or((0.0, 0.0));
        let (mic_l, mic_r) = mic_frames.get(i).copied().unwrap_or((0.0, 0.0));

        let mixed_l = transparent_limit(sys_l * sys_gain + mic_l * actual_mic_gain);
        let mixed_r = transparent_limit(sys_r * sys_gain + mic_r * actual_mic_gain);

        let i16_l = (mixed_l * 32767.0).clamp(-32768.0, 32767.0) as i16;
        let i16_r = (mixed_r * 32767.0).clamp(-32768.0, 32767.0) as i16;

        pcm_bytes.extend_from_slice(&i16_l.to_le_bytes());
        pcm_bytes.extend_from_slice(&i16_r.to_le_bytes());
    }

    pcm_bytes
}
