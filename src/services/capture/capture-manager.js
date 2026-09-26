/**
 * Bukaake Capture & Screen Recording Subsystem Coordinator
 * Coordinates screenshot triggers, image loading, and video saved toast banners (< 180 lines)
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, emit } from '@tauri-apps/api/event';
import { screenCaptureService } from './screen-capture-service.js';
import { screenRecorderService } from './screen-recorder-service.js';
import { alitkenService } from '../alitken-service.js';
import { hotkeyService } from '../hotkey-service.js';
import { toast } from '../../components/toast.js';
import { changeTracker } from '../change-tracker.js';
import { tauriBridge } from '../tauri-bridge.js';

export class CaptureManager {
  constructor(options = {}) {
    this.viewer = options.viewer || null;
    this.fileLoader = options.fileLoader || null;
    this.toolbar = options.toolbar || null;

    this.init();
  }

  init() {
    document.getElementById('btnTitlebarCapture')?.addEventListener('click', () => this.captureSnip());

    if (tauriBridge.isTauri()) {
      listen('bukaake://load-captured-image', async (event) => {
        const { dataUrl, filename, savedPath } = event.payload || {};
        if (savedPath && tauriBridge.isTauri()) {
          try {
            const ctx = await tauriBridge.readImageContext(savedPath);
            if (ctx && this.fileLoader) {
              this.fileLoader.loadFromTauriContext(ctx);
              changeTracker.reset();
              toast.show('Snippet saved & loaded into Bukaake', 'info');
              return;
            }
          } catch (e) {
            console.warn('[CaptureManager] readImageContext error:', e);
          }
        }
        if (dataUrl && filename) {
          this.loadCapturedImage(dataUrl, filename);
          toast.show(savedPath ? 'Snippet saved & loaded into Bukaake' : 'Snippet loaded', 'info');
        }
      });

      listen('bukaake://recording-finished', (event) => {
        const { savedPath, durationSecs } = event.payload || {};
        if (savedPath) {
          this.showRecordingSavedToast(savedPath, durationSecs);
        }
      });

      listen('bukaake://show-toast', (event) => {
        const { message, type } = event.payload || {};
        if (message) toast.show(message, type || 'info');
      });

      hotkeyService.applyToBackend();
    }

    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (hotkeyService.isCaptureTrigger(e)) {
        e.preventDefault();
        this.captureSnip();
      }
    });
  }

  async captureFullscreen() {
    this.captureSnip({ type: 'screenshot', mode: 'fullscreen' });
  }

  async captureSnip(options = {}) {
    if (tauriBridge.isTauri()) {
      try {
        await emit('bukaake://trigger-snipper-window', options);
      } catch (err) {
        console.warn('[CaptureManager] trigger-snipper error:', err);
      }
    } else {
      toast.show('Snipping requires desktop app mode', 'warning');
    }
  }

  loadCapturedImage(dataUrl, filename) {
    const file = screenCaptureService.dataUrlToFile(dataUrl, filename);
    if (this.fileLoader) {
      this.fileLoader.loadWebFiles([file]);
      changeTracker.reset();
    } else if (this.viewer) {
      const img = new Image();
      img.onload = () => {
        this.viewer.loadImage(img);
        changeTracker.reset();
      };
      img.src = dataUrl;
    }
  }

  async toggleRecord() {
    const defaultMode = localStorage.getItem('bukaake-capture-mode') || 'region';
    this.captureSnip({ type: 'record', mode: defaultMode });
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
      <div class="complete-meta"><span class="complete-filename" title="${filename}">${filename}</span><span class="complete-duration">(${timeStr})</span></div>
      <div class="complete-divider"></div>
      <div class="complete-actions">
        <button class="complete-btn play" id="btnPostPlay" title="Play Video Directly"><i class="ri-play-fill"></i> <span>Play</span></button>
        <button class="complete-btn folder" id="btnPostFolder" title="Show in Windows Explorer"><i class="ri-folder-open-line"></i> <span>Folder</span></button>
        <button class="complete-btn alitken" id="btnPostAlitken" title="Open with Alitken Media Converter"><i class="ri-magic-line"></i> <span>Open in Alitken</span></button>
        <button class="complete-btn close" id="btnPostClose" title="Dismiss"><i class="ri-close-line"></i></button>
      </div>`;

    document.body.appendChild(banner);
    const dismiss = () => { document.body.classList.remove('has-recording-banner'); banner.remove(); };
    banner.querySelector('#btnPostPlay')?.addEventListener('click', () => { invoke('open_url', { url: savedPath }); dismiss(); });
    banner.querySelector('#btnPostFolder')?.addEventListener('click', () => { invoke('show_in_folder', { path: savedPath }); dismiss(); });
    banner.querySelector('#btnPostAlitken')?.addEventListener('click', () => { alitkenService.launch(savedPath); dismiss(); });
    banner.querySelector('#btnPostClose')?.addEventListener('click', () => dismiss());
    setTimeout(() => { if (document.body.contains(banner)) dismiss(); }, 12000);
  }
}
