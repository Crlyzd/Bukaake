/**
 * Bukaake Alitken Media Converter Tandem Service
 * Handles Alitken executable discovery, Settings persistence, and video handoff (< 90 lines)
 */

import { invoke } from '@tauri-apps/api/core';
import { toast } from '../components/toast.js';

export class AlitkenService {
  constructor() {
    this.STORAGE_KEY_PATH = 'bukaake-alitken-path';
    this.STORAGE_KEY_AUTO = 'bukaake-alitken-auto-open';
  }

  getCustomPath() {
    return localStorage.getItem(this.STORAGE_KEY_PATH) || '';
  }

  setCustomPath(path) {
    if (path) {
      localStorage.setItem(this.STORAGE_KEY_PATH, path.trim());
    } else {
      localStorage.removeItem(this.STORAGE_KEY_PATH);
    }
  }

  isAutoOpenEnabled() {
    return localStorage.getItem(this.STORAGE_KEY_AUTO) === 'true';
  }

  setAutoOpen(enabled) {
    localStorage.setItem(this.STORAGE_KEY_AUTO, enabled ? 'true' : 'false');
  }

  async pickCustomExecutable() {
    try {
      const path = await invoke('prompt_select_executable');
      if (path) {
        this.setCustomPath(path);
        return path;
      }
    } catch (err) {
      console.warn('[Alitken] File picker cancelled or failed:', err);
    }
    return null;
  }

  async launch(videoPath) {
    if (!videoPath) return false;
    const customExe = this.getCustomPath() || null;

    try {
      await invoke('launch_alitken', {
        videoPath,
        customExe,
      });
      toast.show('Opened video in Alitken Media Converter', 'info');
      return true;
    } catch (err) {
      console.error('[Alitken] Launch failed:', err);
      toast.show(typeof err === 'string' ? err : (err?.message || 'Could not launch Alitken'), 'error');
      return false;
    }
  }
}

export const alitkenService = new AlitkenService();
