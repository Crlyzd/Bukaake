/**
 * Bukaake Custom Hotkey Service
 * Manages customizable unified capture shortcut, key combination recording, and event dispatch (< 120 lines)
 */

import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';

export class HotkeyService {
  constructor() {
    this.DEFAULT_HOTKEY = 'Alt+Shift+S';
    this.STORAGE_KEY = 'bukaake-hotkey-capture';
    this.LEGACY_STORAGE_KEY = 'bukaake-hotkey-screenshot';

    this.init();
  }

  init() {
    window.addEventListener('storage', (e) => {
      if (e.key === this.STORAGE_KEY || e.key === this.LEGACY_STORAGE_KEY) {
        this.applyToBackend();
      }
    });

    if (window.__TAURI__?.event?.listen) {
      window.__TAURI__.event.listen('bukaake-hotkeys-changed', (e) => {
        const val = e.payload?.combo || e.payload?.screenshot;
        if (val) {
          localStorage.setItem(this.STORAGE_KEY, val);
          localStorage.setItem(this.LEGACY_STORAGE_KEY, val);
        }
      }).catch(() => {});
    }

    this.applyToBackend();
  }

  async applyToBackend() {
    try {
      await invoke('update_global_shortcuts', {
        combo: this.getHotkey(),
      });
    } catch (_) {}
  }

  getHotkey() {
    return localStorage.getItem(this.STORAGE_KEY)
      || localStorage.getItem(this.LEGACY_STORAGE_KEY)
      || this.DEFAULT_HOTKEY;
  }

  setHotkey(combo) {
    if (combo) {
      localStorage.setItem(this.STORAGE_KEY, combo);
      localStorage.setItem(this.LEGACY_STORAGE_KEY, combo);
    } else {
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem(this.LEGACY_STORAGE_KEY);
    }
    this.notifyChange();
  }

  // Aliases for compatibility
  getSharedHotkey() { return this.getHotkey(); }
  setSharedHotkey(combo) { this.setHotkey(combo); }
  getScreenshotHotkey() { return this.getHotkey(); }
  setScreenshotHotkey(combo) { this.setHotkey(combo); }

  resetDefaults() {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.LEGACY_STORAGE_KEY);
    localStorage.removeItem('bukaake-hotkey-record');
    this.notifyChange();
  }

  notifyChange() {
    const hotkey = this.getHotkey();
    const detail = { combo: hotkey, screenshot: hotkey };
    window.dispatchEvent(new CustomEvent('bukaake-hotkeys-changed', { detail }));
    this.applyToBackend();
    emit('bukaake-hotkeys-changed', detail).catch(() => {});
  }

  parseEventToCombo(e) {
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return null;

    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');

    let keyName = e.key;
    if (keyName === ' ') keyName = 'Space';
    else if (keyName === 'PrintScreen') keyName = 'PrtScn';
    else if (keyName.length === 1) keyName = keyName.toUpperCase();

    parts.push(keyName);
    return parts.join('+');
  }

  matches(e, comboStr) {
    if (!comboStr) return false;
    const parsed = this.parseEventToCombo(e);
    if (!parsed) return false;
    const norm = (s) => s.toLowerCase().replace(/printscreen/g, 'prtscn');
    return norm(parsed) === norm(comboStr);
  }

  isCaptureTrigger(e) {
    if (e.key === 'PrintScreen') return true;
    return this.matches(e, this.getHotkey());
  }

  isScreenshotTrigger(e) {
    return this.isCaptureTrigger(e);
  }
}

export const hotkeyService = new HotkeyService();
