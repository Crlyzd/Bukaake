/**
 * Bukaake Capture & Screen Recording Subsystem Coordinator
 * Connects screenshot, snipper, recording dock, Alitken, and hotkeys (< 240 lines)
 */

import { invoke } from '@tauri-apps/api/core';
import { screenCaptureService } from './screen-capture-service.js';
import { screenRecorderService } from './screen-recorder-service.js';
import { alitkenService } from './alitken-service.js';
import { hotkeyService } from './hotkey-service.js';
import { ScreenSnipper } from '../components/screen-snipper.js';
import { RecordingDock } from '../components/recording-dock.js';
import { CaptureMenu } from '../components/capture-menu.js';
import { toast } from '../components/toast.js';
import { changeTracker } from './change-tracker.js';

export class CaptureManager {
  constructor(options = {}) {
    this.viewer = options.viewer || null;
    this.fileLoader = options.fileLoader || null;
    this.toolbar = options.toolbar || null;

    this.snipper = new ScreenSnipper();
    this.recordingDock = new RecordingDock();
    this.captureMenu = null;

    this.init();
  }

  init() {
    const btnTitlebarCapture = document.getElementById('btnTitlebarCapture');
    if (btnTitlebarCapture) {
      this.captureMenu = new CaptureMenu({
        anchorBtn: btnTitlebarCapture,
        onCaptureFullscreen: () => this.captureFullscreen(),
        onCaptureSnip: () => this.captureSnip(),
        onToggleRecord: () => this.toggleRecord(),
      });
    }

    document.getElementById('dropSnipBtn')?.addEventListener('click', () => this.captureSnip());
    document.getElementById('dropRecordBtn')?.addEventListener('click', () => this.toggleRecord());

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
    const payload = await screenCaptureService.captureDesktop();
    if (!payload) return;

    await screenCaptureService.copyToClipboard(payload.data_url);
    this.loadCapturedImage(payload.data_url, 'Fullscreen_Capture.png');
    toast.show('Full screen captured & copied to clipboard', 'info');
  }

  async captureSnip() {
    const payload = await screenCaptureService.captureDesktop();
    if (!payload) return;

    this.snipper.startSnip(
      payload.data_url,
      async ({ rect, dataUrl, copyOnly }) => {
        try {
          const croppedUrl = await screenCaptureService.cropCapturedRegion(dataUrl, rect);
          await screenCaptureService.copyToClipboard(croppedUrl);

          if (!copyOnly) {
            const filename = screenCaptureService.generateScreenshotName();
            this.loadCapturedImage(croppedUrl, filename);
            toast.show('Snippet captured & loaded into Bukaake', 'info');
          }
        } catch (err) {
          console.error('[CaptureManager] Snip processing failed:', err);
          toast.show('Snip failed: ' + err.message, 'error');
        }
      },
      () => {}
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
    if (screenRecorderService.state === 'idle') {
      await this.startRecording();
    } else {
      await this.stopRecording();
    }
  }

  async startRecording() {
    const started = await screenRecorderService.startRecording();
    if (!started) return;

    this.recordingDock.show({
      onPause: () => screenRecorderService.pauseRecording(),
      onResume: () => screenRecorderService.resumeRecording(),
      onStop: () => this.stopRecording(),
      onCancel: () => screenRecorderService.cancelRecording(),
    });
  }

  async stopRecording() {
    const result = await screenRecorderService.stopRecording();
    if (!result || !result.tempPath) return;

    try {
      const defaultName = `Recording_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.webm`;
      const askPrompt = localStorage.getItem('bukaake-video-prompt-save') === 'true';
      const customDir = localStorage.getItem('bukaake-video-save-dir');
      const defaultDir = customDir || (await invoke('get_default_videos_dir'));

      let finalPath = null;
      if (askPrompt) {
        finalPath = await invoke('prompt_save_recording', {
          defaultName,
          defaultDir,
        });
        if (!finalPath) {
          await invoke('discard_recording', { tempPath: result.tempPath });
          toast.show('Recording discarded', 'info');
          return;
        }
      } else {
        const dest = defaultDir.replace(/[\\/]$/, '');
        finalPath = `${dest}/${defaultName}`;
      }

      const savedPath = await invoke('finalize_recording', {
        tempPath: result.tempPath,
        destPath: finalPath,
      });

      this.showRecordingSavedToast(savedPath, result.durationSecs);

      if (alitkenService.isAutoOpenEnabled()) {
        alitkenService.launch(savedPath);
      }
    } catch (err) {
      console.error('[CaptureManager] Save recording failed:', err);
      toast.show('Failed to save recording: ' + err, 'error');
    }
  }

  showRecordingSavedToast(savedPath, durationSecs) {
    const filename = savedPath.split(/[/\\]/).pop();
    const timeStr = screenRecorderService.formatTime(durationSecs);
    toast.show(`Recording saved: ${filename} (${timeStr})`, 'info');

    // Create a rich interactive post-recording pill notification
    const banner = document.createElement('div');
    banner.className = 'recording-complete-banner glass-panel';
    banner.innerHTML = `
      <div class="complete-text">
        <i class="ri-video-check-line"></i>
        <span>${filename}</span>
      </div>
      <div class="complete-actions">
        <button class="complete-btn alitken" id="btnPostAlitken" title="Open with Alitken Media Converter">
          <i class="ri-film-line"></i> Open in Alitken
        </button>
        <button class="complete-btn" id="btnPostFolder" title="Show in Windows Explorer">
          <i class="ri-folder-open-line"></i> Show in Folder
        </button>
        <button class="complete-btn close" id="btnPostClose">
          <i class="ri-close-line"></i>
        </button>
      </div>
    `;

    document.body.appendChild(banner);
    banner.querySelector('#btnPostAlitken')?.addEventListener('click', () => {
      alitkenService.launch(savedPath);
      banner.remove();
    });
    banner.querySelector('#btnPostFolder')?.addEventListener('click', () => {
      invoke('show_in_folder', { path: savedPath });
      banner.remove();
    });
    banner.querySelector('#btnPostClose')?.addEventListener('click', () => banner.remove());
    setTimeout(() => { if (document.body.contains(banner)) banner.remove(); }, 12000);
  }
}
