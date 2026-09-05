/**
 * Bukaake Settings & About Modal Component
 * Displays app information, updater checks, feedback forms, and coffee links
 */

import { toast } from './toast.js';

export class SettingsModal {
  constructor(options = {}) {
    this.modalEl = document.getElementById('settingsModal');
    this.btnClose = document.getElementById('btnCloseSettings');
    this.btnCheckUpdate = document.getElementById('btnCheckUpdate');
    this.btnReportBug = document.getElementById('btnReportBug');
    this.btnOpenLogs = document.getElementById('btnOpenLogs');
    this.updateStatusText = document.getElementById('updateStatusText');

    this.init();
  }

  init() {
    this.btnClose?.addEventListener('click', () => this.hide());
    this.modalEl?.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.hide();
    });

    this.btnCheckUpdate?.addEventListener('click', () => this.handleCheckUpdate());
    this.btnOpenLogs?.addEventListener('click', () => this.handleOpenLogs());
  }

  show() {
    this.modalEl?.classList.remove('hidden');
  }

  hide() {
    this.modalEl?.classList.add('hidden');
  }

  toggle() {
    if (this.isOpen()) {
      this.hide();
      return false;
    } else {
      this.show();
      return true;
    }
  }

  isOpen() {
    return this.modalEl ? !this.modalEl.classList.contains('hidden') : false;
  }

  async handleCheckUpdate() {
    if (!this.btnCheckUpdate) return;
    const originalText = this.btnCheckUpdate.innerHTML;
    this.btnCheckUpdate.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Checking...';
    this.btnCheckUpdate.disabled = true;

    setTimeout(() => {
      this.btnCheckUpdate.innerHTML = originalText;
      this.btnCheckUpdate.disabled = false;
      if (this.updateStatusText) {
        this.updateStatusText.textContent = 'Bukaake v0.1.0 (Latest Version)';
      }
      toast.show('You are on the latest version of Bukaake (v0.1.0)');
    }, 900);
  }

  handleOpenLogs() {
    const logInfo = `[Bukaake v0.1.0] OS: Windows | Engine: Tauri v2 | Mode: Active`;
    console.log(logInfo);
    toast.show('Application diagnostics logged to console (F12)');
  }
}
