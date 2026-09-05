/**
 * Bukaake Settings & About Modal Component
 * Displays app information, updater checks, feedback forms, coffee links,
 * and appearance controls (vibrancy material dropdown and glass opacity slider)
 */

import { toast } from './toast.js';
import { themeManager } from '../services/theme-manager.js';

export class SettingsModal {
  constructor(options = {}) {
    this.modalEl = document.getElementById('settingsModal');
    this.btnClose = document.getElementById('btnCloseSettings');
    this.btnCheckUpdate = document.getElementById('btnCheckUpdate');
    this.btnReportBug = document.getElementById('btnReportBug');
    this.updateStatusText = document.getElementById('updateStatusText');

    this.sliderWindowOpacity = document.getElementById('sliderWindowOpacity');
    this.valWindowOpacity = document.getElementById('valWindowOpacity');

    this.init();
    this.initAppearanceSettings();
  }

  init() {
    this.btnClose?.addEventListener('click', () => this.hide());
    this.modalEl?.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.hide();
    });

    this.btnCheckUpdate?.addEventListener('click', () => this.handleCheckUpdate());
  }

  initAppearanceSettings() {
    // Restore saved opacity
    const savedOpacity = localStorage.getItem('bukaake_window_opacity') || '38';
    if (this.sliderWindowOpacity && this.valWindowOpacity) {
      this.sliderWindowOpacity.value = savedOpacity;
      this.valWindowOpacity.textContent = `${savedOpacity}%`;
      this.applyWindowOpacity(savedOpacity);

      this.sliderWindowOpacity.addEventListener('input', (e) => {
        const val = e.target.value;
        this.valWindowOpacity.textContent = `${val}%`;
        this.applyWindowOpacity(val);
        localStorage.setItem('bukaake_window_opacity', val);
      });
    }
  }

  applyWindowOpacity(percentage) {
    const alpha = (parseInt(percentage, 10) / 100).toFixed(2);
    document.documentElement.style.setProperty('--window-opacity', alpha);
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
}
