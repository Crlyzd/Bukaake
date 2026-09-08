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
   * Clips a region from a full-desktop capture data URL
   * @param {string} dataUrl 
   * @param {{ x: number, y: number, width: number, height: number }} rect 
   * @returns {Promise<string>} Cropped data URL
   */
  async cropCapturedRegion(dataUrl, rect) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(rect.width));
        canvas.height = Math.max(1, Math.round(rect.height));
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas 2D context unavailable'));

        ctx.drawImage(
          img,
          Math.round(rect.x),
          Math.round(rect.y),
          canvas.width,
          canvas.height,
          0,
          0,
          canvas.width,
          canvas.height
        );
        resolve(canvas.toDataURL('image/png'));
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
      await invoke('write_clipboard_image', { base64: base64Clean });
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
