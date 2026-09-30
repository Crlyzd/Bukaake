/**
 * Bukaake Cathet Companion Tandem Service
 * Handles Cathet executable discovery, Settings persistence, and text handoff (< 90 lines)
 */

import { invoke } from '@tauri-apps/api/core';
import { toast } from '../../components/viewer/toast.js';

export class CathetService {
  constructor() {
    this.STORAGE_KEY_PATH = 'bukaake-cathet-path';
    this.STORAGE_KEY_AUTO = 'bukaake-cathet-auto-open';
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
      console.warn('[Cathet] File picker cancelled or failed:', err);
    }
    return null;
  }

  async launch(text) {
    if (!text || !text.trim()) return false;
    const customExe = this.getCustomPath() || null;

    try {
      await invoke('launch_cathet', {
        text,
        customExe,
      });
      toast.show('Opened text in Cathet Scratchpad', 'info');
      return true;
    } catch (err) {
      console.error('[Cathet] Launch failed:', err);
      toast.show(typeof err === 'string' ? err : (err?.message || 'Could not launch Cathet'), 'error');
      return false;
    }
  }
}

export const cathetService = new CathetService();
