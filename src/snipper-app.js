/**
 * Bukaake Dedicated Snipper & Recording Overlay Coordinator
 * Runs in isolated transparent webview window with zero main window disruption (< 240 lines)
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, emit } from '@tauri-apps/api/event';
import { ScreenSnipper } from './components/capture/screen-snipper.js';
import { RecordingDock } from './components/capture/recording-dock.js';
import { screenCaptureService } from './services/capture/screen-capture-service.js';
import { screenRecorderService } from './services/capture/screen-recorder-service.js';
import { screenshotSaver } from './services/capture/screenshot-saver.js';
import { alitkenService } from './services/alitken-service.js';
import { toast } from './components/toast.js';

export class SnipperApp {
  constructor() {
    this.snipper = new ScreenSnipper();
    this.recordingDock = new RecordingDock();
    this.isSnipActive = false;
    this.init();
  }

  init() {
    this.syncTheme();
    window.addEventListener('storage', () => this.syncTheme());
    listen('bukaake://theme-changed', () => this.syncTheme());

    screenRecorderService.onTimerTick = (timeStr) => {
      this.recordingDock.updateTimer(timeStr);
    };

    listen('bukaake://trigger-snipper-window', (event) => {
      this.triggerSnip(event.payload || {});
    });

    listen('bukaake://trigger-snip', (event) => {
      this.triggerSnip(event.payload || { type: 'screenshot' });
    });

    listen('bukaake://trigger-record', (event) => {
      this.triggerSnip(event.payload || { type: 'record' });
    });

    listen('bukaake://start-snip-session', (event) => {
      const { payload, options = {} } = event.payload || {};
      if (payload) {
        this.startSnip(payload, options);
      }
    });

    listen('bukaake://close-snipper', () => {
      this.cancelSnip();
    });
  }

  syncTheme() {
    const savedTheme = localStorage.getItem('bukaake-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.body.classList.toggle('light-theme', savedTheme === 'light');
    document.body.classList.toggle('dark', savedTheme !== 'light');
  }

  async triggerSnip(options = {}) {
    if (this.isSnipActive) return;
    this.isSnipActive = true;
    try {
      const payload = await invoke('prepare_screen_snip');
      if (payload) {
        await this.startSnip(payload, options);
      } else {
        this.isSnipActive = false;
      }
    } catch (err) {
      console.error('[SnipperApp] prepare_screen_snip failed:', err);
      this.isSnipActive = false;
      await invoke('finish_screen_snip').catch(() => {});
    }
  }

  async startSnip(payload, options = {}) {
    options.windows = payload.windows || [];
    options.screenWidth = payload.width;
    options.screenHeight = payload.height;
    options.scaleFactor = payload.scale_factor || window.devicePixelRatio || 1;
    const capturePhysW = payload.width;
    const capturePhysH = payload.height;

    await this.snipper.startSnip(
      payload.data_url,
      async ({ rect, dataUrl, sourceImg, copyOnly, isRecord }) => {
        if (isRecord) {
          const isFull = (rect.mode === 'fullscreen' || (rect.isFullscreen && !rect.isWindow));
          const cropRect = isFull ? null : { ...rect, screenWidth: capturePhysW, screenHeight: capturePhysH };
          await this.startRecording(cropRect);
          return;
        }

        try {
          const croppedUrl = await screenCaptureService.cropCapturedRegion(dataUrl, rect, sourceImg);
          const filename = screenshotSaver.generateFilename();
          const savedPath = await screenshotSaver.saveToDisk(croppedUrl, filename);
          await screenCaptureService.copyToClipboard(croppedUrl);

          if (!copyOnly) {
            await emit('bukaake://load-captured-image', { dataUrl: croppedUrl, filename, savedPath });
            await invoke('finish_screen_snip', { openMain: true }).catch(() => {});
          } else {
            await invoke('finish_screen_snip', { openMain: false }).catch(() => {});
            const msg = savedPath ? 'Snippet saved & copied to clipboard' : 'Snippet copied to clipboard';
            await emit('bukaake://show-toast', { message: msg, type: 'info' });
          }
        } catch (err) {
          console.error('[SnipperApp] Snip processing error:', err);
          await invoke('finish_screen_snip').catch(() => {});
        } finally {
          this.isSnipActive = false;
        }
      },
      async () => {
        await this.cancelSnip();
      },
      options
    );
  }

  async cancelSnip() {
    this.isSnipActive = false;
    this.snipper.hide();
    await invoke('finish_screen_snip').catch(() => {});
  }

  async startRecording(cropRegion = null) {
    const started = await screenRecorderService.startRecording(null, cropRegion);
    if (!started) {
      this.isSnipActive = false;
      await invoke('finish_screen_snip').catch(() => {});
      return;
    }

    this.snipper.hide();
    document.body.classList.add('mode-recording-pill');
    const recordMic = localStorage.getItem('bukaake-record-mic') === 'true';
    this.recordingDock.show({
      hasMic: recordMic,
      onToggleMic: (muted) => screenRecorderService.setMicMuted(muted),
      onPause: () => {
        screenRecorderService.pauseRecording();
        invoke('set_recording_border_paused', { paused: true }).catch(() => {});
      },
      onResume: () => {
        screenRecorderService.resumeRecording();
        invoke('set_recording_border_paused', { paused: false }).catch(() => {});
      },
      onStop: () => this.stopRecording(),
      onCancel: () => this.cancelRecording(),
    });

    const pillWidth = recordMic ? 212.0 : 186.0;
    await invoke('enter_recording_pill_mode', { width: pillWidth }).catch(() => {});

    if (cropRegion && cropRegion.width > 20 && cropRegion.height > 20) {
      const BW = 5;
      await invoke('show_recording_border', {
        x: cropRegion.x - BW,
        y: cropRegion.y - BW,
        width: cropRegion.width + (BW * 2),
        height: cropRegion.height + (BW * 2),
      }).catch(() => {});
    }
  }

  async cancelRecording() {
    this.isSnipActive = false;
    this.recordingDock.hide();
    document.body.classList.remove('mode-recording-pill');
    invoke('hide_recording_border').catch(() => {});
    await invoke('exit_recording_pill_mode', { openMain: false }).catch(() => {});
    await screenRecorderService.cancelRecording();
    await emit('bukaake://show-toast', { message: 'Recording discarded', type: 'info' });
  }

  async stopRecording() {
    this.isSnipActive = false;
    this.recordingDock.hide();
    document.body.classList.remove('mode-recording-pill');
    invoke('hide_recording_border').catch(() => {});

    const result = await screenRecorderService.stopRecording();
    if (!result || !result.tempPath) {
      await invoke('exit_recording_pill_mode', { openMain: false }).catch(() => {});
      return;
    }

    try {
      const defaultName = `Recording_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.mp4`;
      const askPrompt = localStorage.getItem('bukaake-video-prompt-save') === 'true';
      const customDir = localStorage.getItem('bukaake-video-save-dir');
      const defaultDir = customDir || (await invoke('get_default_videos_dir'));

      let finalPath = null;
      if (askPrompt) {
        finalPath = await invoke('prompt_save_recording', { defaultName, defaultDir });
        if (!finalPath) {
          await invoke('discard_native_recording', { tempPath: result.tempPath });
          await invoke('exit_recording_pill_mode', { openMain: false }).catch(() => {});
          await emit('bukaake://show-toast', { message: 'Recording discarded', type: 'info' });
          return;
        }
      } else {
        const dest = defaultDir.replace(/[\\/]$/, '');
        finalPath = `${dest}/${defaultName}`;
      }

      const durationMs = result.durationMs || (result.durationSecs ? result.durationSecs * 1000 : null);
      const savedPath = await invoke('finalize_recording', { tempPath: result.tempPath, destPath: finalPath, durationMs });
      
      await invoke('exit_recording_pill_mode', { openMain: true }).catch(() => {});

      await emit('bukaake://recording-finished', {
        savedPath,
        durationSecs: result.durationSecs,
      });

      if (alitkenService.isAutoOpenEnabled()) {
        alitkenService.launch(savedPath);
      }
    } catch (err) {
      console.error('[SnipperApp] Save recording failed:', err);
      await invoke('exit_recording_pill_mode', { openMain: false }).catch(() => {});
      await emit('bukaake://show-toast', { message: 'Failed to save recording: ' + err, type: 'error' });
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { window.snipperApp = new SnipperApp(); });
} else {
  window.snipperApp = new SnipperApp();
}
