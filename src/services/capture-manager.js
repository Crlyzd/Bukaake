/**
 * Bukaake Capture & Screen Recording Subsystem Coordinator
 * Connects screenshot, snipper, recording dock, Alitken, and hotkeys (< 240 lines)
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { screenCaptureService } from './screen-capture-service.js';
import { screenRecorderService } from './screen-recorder-service.js';
import { alitkenService } from './alitken-service.js';
import { hotkeyService } from './hotkey-service.js';
import { ScreenSnipper } from '../components/screen-snipper.js';
import { RecordingDock } from '../components/recording-dock.js';
import { toast } from '../components/toast.js';
import { changeTracker } from './change-tracker.js';
import { tauriBridge } from './tauri-bridge.js';
import { screenshotSaver } from './screenshot-saver.js';

export class CaptureManager {
  constructor(options = {}) {
    this.viewer = options.viewer || null;
    this.fileLoader = options.fileLoader || null;
    this.toolbar = options.toolbar || null;

    this.snipper = new ScreenSnipper();
    this.recordingDock = new RecordingDock();

    this.init();
  }

  init() {
    document.getElementById('btnTitlebarCapture')?.addEventListener('click', () => this.captureSnip());

    if (tauriBridge.isTauri()) {
      listen('bukaake://trigger-snip', () => this.captureSnip());
      listen('bukaake://trigger-record', () => this.toggleRecord());
    }

    screenRecorderService.onTimerTick = (timeStr) => {
      this.recordingDock.updateTimer(timeStr);
    };

    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (hotkeyService.isScreenshotTrigger(e)) {
        e.preventDefault();
        this.captureSnip();
      } else if (hotkeyService.isRecordTrigger(e)) {
        e.preventDefault();
        this.toggleRecord();
      }
    });
  }

  async captureFullscreen() {
    this.captureSnip({ type: 'screenshot', mode: 'fullscreen' });
  }

  async captureSnip(options = {}) {
    if (this.snipper.isActive || document.body.classList.contains('mode-capturing')) return;
    document.body.classList.add('mode-capturing');
    const isFs = await tauriBridge.isFullscreen();
    const isMax = await tauriBridge.isMaximized();

    let payload = null;
    if (tauriBridge.isTauri()) {
      payload = await invoke('prepare_screen_snip').catch((err) => {
        console.warn('[CaptureManager] prepare_screen_snip fallback:', err);
        return null;
      });
    }

    if (!payload) payload = await screenCaptureService.captureDesktop();
    if (!payload) {
      document.body.classList.remove('mode-capturing');
      return;
    }

    const cleanupSnip = async () => {
      document.body.classList.remove('mode-capturing');
      if (tauriBridge.isTauri()) {
        await invoke('finish_screen_snip', {
          wasFullscreen: isFs || isMax,
          wasMinimized: false,
          wasHidden: false,
        }).catch(() => {});
      }
    };

    options.windows = payload.windows || [];
    options.screenWidth = payload.width;    // GDI physical width (pixels)
    options.screenHeight = payload.height;  // GDI physical height (pixels)
    // Capture physical dimensions at overlay-open time, before any window resize
    const capturePhysW = payload.width;
    const capturePhysH = payload.height;

    this.snipper.startSnip(
      payload.data_url,
      async ({ rect, dataUrl, copyOnly, isRecord }) => {
        await cleanupSnip();

        if (isRecord) {
          const isFull = (rect.mode === 'fullscreen' || (rect.isFullscreen && !rect.isWindow));
          // Attach GDI physical dimensions so screen-recorder-service can compute scale
          // without relying on the live window.innerWidth (which changes to 320px during pill mode)
          const cropRect = isFull ? null : {
            ...rect,
            screenWidth: capturePhysW,
            screenHeight: capturePhysH,
          };
          await this.startRecording(cropRect);
          return;
        }

        try {
          const croppedUrl = await screenCaptureService.cropCapturedRegion(dataUrl, rect);
          const filename = screenshotSaver.generateFilename();
          const savedPath = await screenshotSaver.saveToDisk(croppedUrl, filename);
          await screenCaptureService.copyToClipboard(croppedUrl);

          if (!copyOnly) {
            this.loadCapturedImage(croppedUrl, filename);
            toast.show(savedPath ? 'Snippet saved & loaded into Bukaake' : 'Snippet loaded', 'info');
          } else {
            toast.show(savedPath ? 'Snippet saved & copied to clipboard' : 'Snippet copied to clipboard', 'info');
          }
        } catch (err) {
          console.error('[CaptureManager] Snip processing failed:', err);
          toast.show('Snip failed: ' + err.message, 'error');
        }
      },
      async () => {
        await cleanupSnip();
      },
      options
    );
  }

  loadCapturedImage(dataUrl, filename) {
    const file = screenCaptureService.dataUrlToFile(dataUrl, filename);
    if (this.fileLoader) {
      this.fileLoader.loadWebFiles([file]);
      changeTracker.markDraw(true);
    } else if (this.viewer) {
      const img = new Image();
      img.onload = () => {
        this.viewer.loadImage(img);
        changeTracker.markDraw(true);
      };
      img.src = dataUrl;
    }
  }

  async toggleRecord() {
    if (screenRecorderService.state === 'recording' || screenRecorderService.state === 'paused') {
      await this.stopRecording();
    } else {
      const defaultMode = localStorage.getItem('bukaake-capture-mode') || 'region';
      this.captureSnip({ type: 'record', mode: defaultMode });
    }
  }

  async startRecording(cropRegion = null) {
    const started = await screenRecorderService.startRecording(null, cropRegion);
    if (!started) return;

    document.body.classList.add('mode-recording-pill');
    this.recordingDock.show({
      onPause: () => {
        screenRecorderService.pauseRecording();
        if (tauriBridge.isTauri()) {
          invoke('set_recording_border_paused', { paused: true }).catch(() => {});
        }
      },
      onResume: () => {
        screenRecorderService.resumeRecording();
        if (tauriBridge.isTauri()) {
          invoke('set_recording_border_paused', { paused: false }).catch(() => {});
        }
      },
      onStop: () => this.stopRecording(),
      onCancel: () => this.cancelRecording(),
    });

    if (tauriBridge.isTauri()) {
      await invoke('enter_recording_pill_mode').catch(() => {});
      // cropRegion.x/y/width/height are already physical screen pixels
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
    toast.show(cropRegion ? 'Recording selected region...' : 'Recording full screen...', 'info');
  }

  async cancelRecording() {
    this.recordingDock.hide();
    document.body.classList.remove('mode-recording-pill');
    if (tauriBridge.isTauri()) {
      invoke('hide_recording_border').catch(() => {});
      await invoke('exit_recording_pill_mode').catch(() => {});
    }
    await screenRecorderService.cancelRecording();
    toast.show('Recording discarded', 'info');
  }

  async stopRecording() {
    this.recordingDock.hide();
    document.body.classList.remove('mode-recording-pill');
    if (tauriBridge.isTauri()) {
      invoke('hide_recording_border').catch(() => {});
      await invoke('exit_recording_pill_mode').catch(() => {});
    }

    const result = await screenRecorderService.stopRecording();
    if (!result || !result.tempPath) return;

    try {
      const defaultName = `Recording_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.webm`;
      const askPrompt = localStorage.getItem('bukaake-video-prompt-save') === 'true';
      const customDir = localStorage.getItem('bukaake-video-save-dir');
      const defaultDir = customDir || (await invoke('get_default_videos_dir'));

      let finalPath = null;
      if (askPrompt) {
        finalPath = await invoke('prompt_save_recording', { defaultName, defaultDir });
        if (!finalPath) {
          await invoke('discard_recording', { tempPath: result.tempPath });
          toast.show('Recording discarded', 'info');
          return;
        }
      } else {
        const dest = defaultDir.replace(/[\\/]$/, '');
        finalPath = `${dest}/${defaultName}`;
      }

      const savedPath = await invoke('finalize_recording', { tempPath: result.tempPath, destPath: finalPath });
      this.showRecordingSavedToast(savedPath, result.durationSecs);
      if (alitkenService.isAutoOpenEnabled()) alitkenService.launch(savedPath);
    } catch (err) {
      console.error('[CaptureManager] Save recording failed:', err);
      toast.show('Failed to save recording: ' + err, 'error');
    }
  }

  showRecordingSavedToast(savedPath, durationSecs) {
    const filename = savedPath.split(/[/\\]/).pop();
    const timeStr = screenRecorderService.formatTime(durationSecs);
    document.querySelectorAll('.recording-complete-banner').forEach((b) => b.remove());
    document.body.classList.add('has-recording-banner');

    const banner = document.createElement('div');
    banner.className = 'recording-complete-banner glass-panel';
    banner.innerHTML = `
      <div class="complete-badge"><i class="ri-checkbox-circle-fill"></i></div>
      <div class="complete-meta">
        <span class="complete-filename" title="${filename}">${filename}</span>
        <span class="complete-duration">(${timeStr})</span>
      </div>
      <div class="complete-divider"></div>
      <div class="complete-actions">
        <button class="complete-btn play" id="btnPostPlay" title="Play Video Directly">
          <i class="ri-play-fill"></i> <span>Play</span>
        </button>
        <button class="complete-btn folder" id="btnPostFolder" title="Show in Windows Explorer">
          <i class="ri-folder-open-line"></i> <span>Folder</span>
        </button>
        <button class="complete-btn alitken" id="btnPostAlitken" title="Open with Alitken Media Converter">
          <i class="ri-magic-line"></i> <span>Open in Alitken</span>
        </button>
        <button class="complete-btn close" id="btnPostClose" title="Dismiss">
          <i class="ri-close-line"></i>
        </button>
      </div>
    `;

    document.body.appendChild(banner);
    const dismiss = () => { document.body.classList.remove('has-recording-banner'); banner.remove(); };
    banner.querySelector('#btnPostPlay')?.addEventListener('click', () => { invoke('open_url', { url: savedPath }); dismiss(); });
    banner.querySelector('#btnPostFolder')?.addEventListener('click', () => { invoke('show_in_folder', { path: savedPath }); dismiss(); });
    banner.querySelector('#btnPostAlitken')?.addEventListener('click', () => { alitkenService.launch(savedPath); dismiss(); });
    banner.querySelector('#btnPostClose')?.addEventListener('click', () => dismiss());
    setTimeout(() => { if (document.body.contains(banner)) dismiss(); }, 12000);
  }
}
