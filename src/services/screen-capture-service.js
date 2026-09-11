/**
 * Bukaake Screen Capture Service
 * Orchestrates Win32 GDI desktop capture, region clipping, and clipboard copy (< 130 lines)
 */

import { invoke } from '@tauri-apps/api/core';
import { toast } from '../components/toast.js';

export class ScreenCaptureService {
  constructor(options = {}) {
    this.onImageCaptured = options.onImageCaptured || null;
  }

  /**
   * Captures the full virtual desktop via native GDI
   * @returns {Promise<Object|null>} { dataUrl, width, height, x, y }
   */
  async captureDesktop() {
    try {
      const payload = await invoke('capture_screen');
      if (!payload || !payload.data_url) {
        throw new Error('No capture data returned from system');
      }
      return payload;
    } catch (err) {
      console.error('[ScreenCapture] Capture failed:', err);
      toast.show('Screenshot capture failed: ' + (err?.message || err), 'error');
      return null;
    }
  }

  /**
   * Clips a region from a full-desktop capture data URL or preloaded Image
   * @param {string} dataUrl 
   * @param {{ x: number, y: number, width: number, height: number }} rect 
   * @param {HTMLImageElement|null} sourceImg Optional preloaded image for instant zero-allocation crop
   * @returns {Promise<string>} Cropped data URL
   */
  async cropCapturedRegion(dataUrl, rect, sourceImg = null) {
    const doCrop = (img) => {
      const naturalW = img.naturalWidth || img.width || 1;
      const naturalH = img.naturalHeight || img.height || 1;
      const sX = Math.max(0, Math.min(naturalW - 1, Math.round(rect.x)));
      const sY = Math.max(0, Math.min(naturalH - 1, Math.round(rect.y)));
      const sW = Math.max(1, Math.min(naturalW - sX, Math.round(rect.width)));
      const sH = Math.max(1, Math.min(naturalH - sY, Math.round(rect.height)));

      const canvas = document.createElement('canvas');
      canvas.width = sW;
      canvas.height = sH;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Canvas 2D context unavailable');

      ctx.drawImage(img, sX, sY, sW, sH, 0, 0, sW, sH);
      return canvas.toDataURL('image/png');
    };

    if (sourceImg && sourceImg.complete && (sourceImg.naturalWidth || sourceImg.width)) {
      try {
        return doCrop(sourceImg);
      } catch (err) {
        console.warn('[ScreenCapture] Fast sourceImg crop failed, using dataUrl fallback:', err);
      }
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          resolve(doCrop(img));
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Failed to load capture for cropping'));
      img.src = dataUrl;
    });
  }

  /**
   * Converts a base64 data URL to a File object
   * @param {string} dataUrl 
   * @param {string} filename 
   * @returns {File}
   */
  dataUrlToFile(dataUrl, filename) {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }

  /**
   * Copies an image data URL to the system clipboard
   * @param {string} dataUrl 
   */
  async copyToClipboard(dataUrl) {
    try {
      const base64Clean = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
      await invoke('write_clipboard_image', { base64Data: base64Clean, base64: base64Clean });
      toast.show('Screenshot copied to clipboard', 'info');
    } catch (err) {
      console.warn('[ScreenCapture] Clipboard copy failed:', err);
    }
  }

  /**
   * Generates a timestamped screenshot filename
   * @returns {string}
   */
  generateScreenshotName() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const ymd = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const hms = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    return `Screenshot_${ymd}_${hms}.png`;
  }
}

export const screenCaptureService = new ScreenCaptureService();
