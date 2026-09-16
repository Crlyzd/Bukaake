/**
 * Bukaake Screenshot Auto-Saver Service
 * Always saves captured screenshots directly to captures folder with timestamp (< 70 lines)
 */

import { invoke } from '@tauri-apps/api/core';
import { toast } from '../components/toast.js';

export class ScreenshotSaver {
  /**
   * Generates timestamped filename: Screenshot_YYYYMMDD_HHMMSS_Bukaake.png
   * @returns {string}
   */
  generateFilename() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const ymd = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const hms = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    return `Screenshot_${ymd}_${hms}_Bukaake.png`;
  }

  /**
   * Saves screenshot to disk in the configured captures folder
   * @param {string} dataUrl Base64 PNG data URL
   * @param {string} [customFilename] Optional filename
   * @returns {Promise<string|null>} Path where file was saved
   */
  async saveToDisk(dataUrl, customFilename = null) {
    const filename = customFilename || this.generateFilename();
    try {
      const customDir = localStorage.getItem('bukaake-video-save-dir');
      const targetDir = customDir || (await invoke('get_default_videos_dir'));
      const savedPath = await invoke('save_screenshot_to_dir', {
        base64Png: dataUrl,
        destDir: targetDir,
        filename,
      });
      return savedPath;
    } catch (err) {
      console.warn('[ScreenshotSaver] Auto-save failed:', err);
      toast.show('Failed to save screenshot: ' + (err?.message || err), 'error');
      return null;
    }
  }
}

export const screenshotSaver = new ScreenshotSaver();
