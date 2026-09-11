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

  async init({ onOpenPath, onOpenSettings, onWakeFromStandby } = {}) {
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

    // Listen for tray menu open settings
    window.__TAURI__?.event?.listen('bukaake://open-settings', () => {
      onOpenSettings?.();
    });

    // Listen for bare exe/shortcut re-launch while in tray (no file argument)
    window.__TAURI__?.event?.listen('bukaake://wake-from-standby', () => {
      onWakeFromStandby?.();
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

  async enterStandby({ viewer, fileLoader, onHidden } = {}) {
    if (!this.enabled) {
      return await tauriBridge.exitApp();
    }

    // 1. Hide window immediately — prevents any visible clearing or layout jumping
    await tauriBridge.invoke('enter_standby');

    // 2. Window is now completely invisible: clean up buffers and reset DOM offscreen
    try {
      onHidden?.();
      fileLoader?.clearItems?.();
      viewer?.setImage(null);
      if (fileLoader) fileLoader.currentMeta = null;
      if (typeof window !== 'undefined' && window.gc) {
        try { window.gc(); } catch (_) {}
      }
      await tauriBridge.trimMemoryWorkingSet();
    } catch (err) {
      console.warn('[StandbyService] Error clearing buffers:', err);
    }
  }
}

export const standbyService = new StandbyService();
