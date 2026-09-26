/**
 * Bukaake Screen Recorder Service
 * High-performance coordinator for native GPU-accelerated screen & audio capture (< 160 lines)
 */

import { invoke } from '@tauri-apps/api/core';
import { toast } from '../../components/toast.js';

export const QUALITY_PRESETS = {
  high: { fps: 60, bitrate: 6_000_000, label: '60 FPS • High (6 Mbps)' },
  balanced: { fps: 30, bitrate: 3_000_000, label: '30 FPS • Balanced (3 Mbps)' },
  ultra: { fps: 60, bitrate: 12_000_000, label: '60 FPS • Ultra (12 Mbps)' },
};

export class ScreenRecorderService {
  constructor() {
    this.state = 'idle'; // idle | recording | paused
    this.startTime = 0;
    this.pausedDuration = 0;
    this.pauseStartTime = 0;
    this.timerInterval = null;
    this.elapsedSeconds = 0;
    this.tempFilePath = null;

    this.onStateChange = null;
    this.onTimerTick = null;
  }

  getQualitySetting() {
    const saved = localStorage.getItem('bukaake-video-quality');
    return QUALITY_PRESETS[saved] ? saved : 'high';
  }

  async startRecording(presetKey = null, cropRegion = null) {
    if (this.state !== 'idle') return false;
    const quality = QUALITY_PRESETS[presetKey || this.getQualitySetting()] || QUALITY_PRESETS.high;

    const recordSys = localStorage.getItem('bukaake-record-sys-audio') !== 'false';
    const recordMic = localStorage.getItem('bukaake-record-mic') === 'true';

    let regionPayload = null;
    if (cropRegion && cropRegion.width > 20 && cropRegion.height > 20) {
      regionPayload = {
        x: Math.max(0, Math.round(cropRegion.x)),
        y: Math.max(0, Math.round(cropRegion.y)),
        width: Math.max(2, Math.round(cropRegion.width)),
        height: Math.max(2, Math.round(cropRegion.height)),
      };
    }

    try {
      this.tempFilePath = await invoke('start_native_recording', {
        region: regionPayload,
        fps: quality.fps,
        bitrate: quality.bitrate,
        recordSys,
        recordMic,
      });

      this.state = 'recording';
      this.startTime = Date.now();
      this.pausedDuration = 0;
      this.elapsedSeconds = 0;

      this.startTimer();
      this.onStateChange?.(this.state);
      return true;
    } catch (err) {
      console.error('[ScreenRecorder] Native recording start failed:', err);
      toast.show('Could not start screen recording: ' + err, 'error');
      this.cleanup();
      return false;
    }
  }

  async pauseRecording() {
    if (this.state !== 'recording') return;
    try {
      await invoke('pause_native_recording');
      this.state = 'paused';
      this.pauseStartTime = Date.now();
      this.onStateChange?.(this.state);
    } catch (err) {
      console.warn('[ScreenRecorder] Pause failed:', err);
    }
  }

  async resumeRecording() {
    if (this.state !== 'paused') return;
    try {
      await invoke('resume_native_recording');
      this.state = 'recording';
      this.pausedDuration += Date.now() - this.pauseStartTime;
      this.onStateChange?.(this.state);
    } catch (err) {
      console.warn('[ScreenRecorder] Resume failed:', err);
    }
  }

  async stopRecording() {
    if (this.state === 'idle') return null;
    this.stopTimer();

    try {
      const res = await invoke('stop_native_recording');
      const durationSecs = res?.duration_secs ?? Math.max(this.elapsedSeconds, Math.floor((Date.now() - this.startTime) / 1000));
      const durationMs = res?.duration_ms ?? durationSecs * 1000;
      const tempPath = res?.temp_path || this.tempFilePath;

      this.cleanup();
      return {
        tempPath,
        durationSecs,
        durationMs,
      };
    } catch (err) {
      console.error('[ScreenRecorder] Native recording stop failed:', err);
      this.cleanup();
      return null;
    }
  }

  async cancelRecording() {
    if (this.state === 'idle') return;
    this.stopTimer();
    const tempPath = this.tempFilePath;
    this.cleanup();

    try {
      await invoke('discard_native_recording', { tempPath });
    } catch (_) {}
    toast.show('Recording discarded', 'info');
  }

  startTimer() {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      if (this.state === 'recording') {
        const totalMs = Date.now() - this.startTime - this.pausedDuration;
        this.elapsedSeconds = Math.max(0, Math.floor(totalMs / 1000));
        this.onTimerTick?.(this.formatTime(this.elapsedSeconds));
      }
    }, 500);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  formatTime(totalSecs) {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  cleanup() {
    this.stopTimer();
    this.state = 'idle';
    this.tempFilePath = null;
    this.onStateChange?.(this.state);
  }

  async setMicMuted(muted) {
    await invoke('set_recording_mic_muted', { muted }).catch(() => {});
  }
}

export const screenRecorderService = new ScreenRecorderService();
