/**
 * Bukaake Standby & Session Lifecycle Service
 * Manages memory reclamation, prefetch clearing, and background tray standby (< 100 lines)
 */

import { tauriBridge } from './tauri-bridge.js';

const STORAGE_KEY = 'bukaake_standby_enabled';

class StandbyService {
  constructor() {
    this.enabled = localStorage.getItem(STORAGE_KEY) !== 'false';
  }

  async init({ onOpenPath, onTriggerOpenFile, onOpenSettings } = {}) {
    if (!tauriBridge.isTauri()) return;

    // Sync initial state to Rust backend
    await tauriBridge.invoke('set_standby_enabled', { enabled: this.enabled });

    // Listen for incoming files while running in standby
    window.__TAURI__?.event?.listen('bukaake://open-path', async (event) => {
      const path = event.payload;
      if (path && onOpenPath) {
        await onOpenPath(path);
      }
    });

    // Listen for tray menu trigger open
    window.__TAURI__?.event?.listen('bukaake://trigger-open-file', () => {
      onTriggerOpenFile?.();
    });

    // Listen for tray menu open settings
    window.__TAURI__?.event?.listen('bukaake://open-settings', () => {
      onOpenSettings?.();
    });

    // Cross-window sync (e.g. from standalone settings window)
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) {
        this.setEnabled(e.newValue !== 'false', false);
      }
    });
    window.__TAURI__?.event?.listen('bukaake-standby-setting-changed', (e) => {
      this.setEnabled(Boolean(e.payload), false);
    });
  }

  isEnabled() {
    return this.enabled;
  }

  async setEnabled(enabled, syncTauri = true) {
    this.enabled = enabled;
    localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
    if (tauriBridge.isTauri() && syncTauri) {
      await tauriBridge.invoke('set_standby_enabled', { enabled });
      window.__TAURI__?.event?.emit('bukaake-standby-setting-changed', enabled);
    }
  }

  async enterStandby({ viewer, fileLoader, windowModeManager }) {
    if (!this.enabled) {
      return await tauriBridge.exitApp();
    }

    // Purge memory buffers before hiding
    try {
      fileLoader?.prefetchCache?.clear();
      viewer?.setImage(null);
      if (fileLoader) {
        fileLoader.currentMeta = null;
      }
      const dz = document.getElementById('dropZone');
      if (dz) dz.style.display = 'none';
      if (windowModeManager) {
        windowModeManager.updateModeClasses('mode-viewer');
      }
    } catch (err) {
      console.warn('[StandbyService] Error clearing buffers:', err);
    }

    // Hide window, trim memory working-set, and start 5-minute countdown in Rust
    await tauriBridge.invoke('enter_standby');
  }
}

export const standbyService = new StandbyService();
