/**
 * Bukaake Raw Load Controller
 * Coordinates non-blocking background full-sensor RAW decoding (Q key),
 * zero-base64 binary IPC, off-thread DOM rasterization, and session cancellation (< 120 lines).
 */

import { tauriBridge } from '../platform/tauri-bridge.js';
import { titlebarLoader } from '../../components/viewer/titlebar-loader.js';

export class RawLoadController {
  constructor(options = {}) {
    this.viewer = options.viewer;
    this.toolbar = options.toolbar;
    this.toast = options.toast;
    this.titlebarLoader = options.titlebarLoader || titlebarLoader;
    this.onLoaded = options.onLoaded;

    this.activeSessionId = 0;
    this.isDecoding = false;
    this.currentObjectUrl = null;
  }

  cancel() {
    this.activeSessionId++;
    this.titlebarLoader?.cancel();
    if (this.isDecoding) {
      this.isDecoding = false;
      this.toolbar?.setRawDecoding(false);
    }
  }

  async loadFullRaw(currentMeta, isEditing = false) {
    const path = currentMeta?.path;
    if (!path || !document.body.classList.contains('is-raw')) {
      this.toast?.show('No RAW file is currently loaded');
      return;
    }
    if (isEditing) {
      this.toast?.show('Please finish or cancel active edits before reloading');
      return;
    }
    if (this.isDecoding) return;

    const sessionId = ++this.activeSessionId;
    this.isDecoding = true;
    this.toolbar?.setRawDecoding(true);
    this.titlebarLoader?.start();
    this.toast?.show('Loading full sensor decode…');

    try {
      const buffer = await tauriBridge.readRawFullSensorBinary(path);
      if (sessionId !== this.activeSessionId || !buffer) {
        this.cleanupDecodingState();
        return;
      }

      const blob = new Blob([buffer], { type: 'image/jpeg' });
      const objectUrl = URL.createObjectURL(blob);

      const img = new Image();
      img.src = objectUrl;

      if (typeof img.decode === 'function') {
        await img.decode();
      } else {
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
      }

      if (sessionId !== this.activeSessionId) {
        URL.revokeObjectURL(objectUrl);
        this.cleanupDecodingState();
        return;
      }

      if (this.currentObjectUrl) {
        URL.revokeObjectURL(this.currentObjectUrl);
      }
      this.currentObjectUrl = objectUrl;

      this.viewer.setImage(img);
      this.onLoaded?.(img);
      this.titlebarLoader?.complete();
      this.toast?.show('Full sensor decode loaded');
    } catch (err) {
      if (sessionId === this.activeSessionId) {
        this.titlebarLoader?.cancel();
        this.toast?.warn(`Full sensor decode failed: ${err}`);
      }
    } finally {
      if (sessionId === this.activeSessionId) {
        this.cleanupDecodingState();
      }
    }
  }

  cleanupDecodingState() {
    this.isDecoding = false;
    this.toolbar?.setRawDecoding(false);
  }

  destroy() {
    this.cancel();
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
  }
}
