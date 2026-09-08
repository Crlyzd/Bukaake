/**
 * Bukaake Screen Recorder Service
 * Hardware-accelerated display capture with low-RAM stream-to-disk chunking (< 190 lines)
 */

import { invoke } from '@tauri-apps/api/core';
import { toast } from '../components/toast.js';

export const QUALITY_PRESETS = {
  high: { fps: 60, bitrate: 6_000_000, label: '60 FPS • High (6 Mbps)' },
  balanced: { fps: 30, bitrate: 3_000_000, label: '30 FPS • Balanced (3 Mbps)' },
  ultra: { fps: 60, bitrate: 12_000_000, label: '60 FPS • Ultra (12 Mbps)' },
};

export class ScreenRecorderService {
  constructor() {
    this.mediaStream = null;
    this.mediaRecorder = null;
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

  async startRecording(presetKey = null) {
    if (this.state !== 'idle') return false;
    const quality = QUALITY_PRESETS[presetKey || this.getQualitySetting()] || QUALITY_PRESETS.high;

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          frameRate: { ideal: quality.fps, max: quality.fps },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      this.mediaStream = stream;
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';

      const tempFilename = `rec_${Date.now()}.part`;
      this.tempFilePath = await invoke('init_recording_stream', { tempFilename });

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: quality.bitrate,
      });

      this.mediaRecorder.ondataavailable = async (e) => {
        if (e.data && e.data.size > 0 && this.tempFilePath) {
          try {
            const buf = await e.data.arrayBuffer();
            const bytes = Array.from(new Uint8Array(buf));
            await invoke('append_recording_chunk', {
              tempPath: this.tempFilePath,
              chunk: bytes,
            });
          } catch (err) {
            console.error('[ScreenRecorder] Failed to stream chunk to disk:', err);
          }
        }
      };

      // Auto-stop if user clicks native browser "Stop sharing" button
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        if (this.state !== 'idle') this.stopRecording();
      });

      this.mediaRecorder.start(1000); // 1-second chunks for low RAM usage
      this.state = 'recording';
      this.startTime = Date.now();
      this.pausedDuration = 0;
      this.elapsedSeconds = 0;

      this.startTimer();
      this.onStateChange?.(this.state);
      return true;
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        console.error('[ScreenRecorder] Stream capture error:', err);
        toast.show('Could not start screen recording: ' + err.message, 'error');
      }
      this.cleanup();
      return false;
    }
  }

  pauseRecording() {
    if (this.state !== 'recording' || !this.mediaRecorder) return;
    this.mediaRecorder.pause();
    this.state = 'paused';
    this.pauseStartTime = Date.now();
    this.onStateChange?.(this.state);
  }

  resumeRecording() {
    if (this.state !== 'paused' || !this.mediaRecorder) return;
    this.mediaRecorder.resume();
    this.state = 'recording';
    this.pausedDuration += Date.now() - this.pauseStartTime;
    this.onStateChange?.(this.state);
  }

  async stopRecording() {
    if (this.state === 'idle' || !this.mediaRecorder) return null;

    return new Promise((resolve) => {
      this.mediaRecorder.onstop = async () => {
        this.stopTimer();
        const recordedSeconds = this.elapsedSeconds;
        const tempPath = this.tempFilePath;
        this.cleanup();

        resolve({
          tempPath,
          durationSecs: recordedSeconds,
        });
      };

      try {
        this.mediaRecorder.stop();
      } catch (_) {
        this.cleanup();
        resolve(null);
      }
    });
  }

  async cancelRecording() {
    if (this.state === 'idle') return;
    this.stopTimer();
    if (this.tempFilePath) {
      try {
        await invoke('discard_recording', { tempPath: this.tempFilePath });
      } catch (_) {}
    }
    this.cleanup();
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
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    this.mediaRecorder = null;
    this.state = 'idle';
    this.tempFilePath = null;
    this.onStateChange?.(this.state);
  }
}

export const screenRecorderService = new ScreenRecorderService();
