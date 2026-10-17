/**
 * Bukaake Shortcuts Modal Component
 * Displays keyboard shortcuts overlay
 */

import { hotkeyService } from '../../services/interaction/hotkey-service.js';

export class ShortcutsModal {
  constructor() {
    this.container = document.getElementById('helpModal');
    this.lblCapture = document.getElementById('helpShortcutCapture');
    this.init();
  }

  init() {
    document.getElementById('btnCloseHelp')?.addEventListener('click', () => {
      this.hide();
    });

    this.container?.addEventListener('click', (e) => {
      if (e.target === this.container) {
        this.hide();
      }
    });

    this.syncShortcuts();
    window.addEventListener('bukaake-hotkeys-changed', () => this.syncShortcuts());
    window.addEventListener('storage', (e) => {
      if (e.key === 'bukaake-hotkey-capture' || e.key === 'bukaake-hotkey-screenshot') {
        this.syncShortcuts();
      }
    });
  }

  syncShortcuts() {
    if (this.lblCapture) {
      this.lblCapture.textContent = hotkeyService.getHotkey();
    }
  }

  toggle() {
    if (this.container) {
      const isHidden = this.container.classList.toggle('hidden');
      if (!isHidden) this.syncShortcuts();
      return !isHidden;
    }
    return false;
  }

  show() {
    this.syncShortcuts();
    this.container?.classList.remove('hidden');
  }

  hide() {
    this.container?.classList.add('hidden');
  }

  isOpen() {
    return this.container && !this.container.classList.contains('hidden');
  }
}

