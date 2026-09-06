/**
 * Bukaake Settings & About Modal Component
 * Displays app information, updater checks, feedback forms, coffee links,
 * and appearance controls (vibrancy material dropdown and glass opacity slider) (< 150 lines)
 */

import { toast } from './toast.js';
import { themeManager } from '../services/theme-manager.js';
import { updaterService } from '../services/updater-service.js';

export class SettingsModal {
  constructor(options = {}) {
    this.modalEl = document.getElementById('settingsModal');
    this.btnClose = document.getElementById('btnCloseSettings');
    this.btnCheckUpdate = document.getElementById('btnCheckUpdate');
    this.btnReportBug = document.getElementById('btnReportBug');
    this.updateStatusText = document.getElementById('updateStatusText');
    this.updateBanner = this.modalEl?.querySelector('.settings-update-banner');
    this.updateProgressTrack = document.getElementById('updateProgressTrack');
    this.updateProgressFill = document.getElementById('updateProgressFill');

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

    updaterService.subscribe((state) => {
      const isUpdating = Boolean(state.isUpdating);
      const isChecking = Boolean(state.isChecking);
      this.updateBanner?.classList.toggle('has-update', Boolean(state.hasUpdate));

      if (this.updateProgressTrack) {
        this.updateProgressTrack.classList.toggle('hidden', !isUpdating);
      }
      if (this.updateProgressFill) {
        this.updateProgressFill.style.width = `${state.updatePercent || 0}%`;
      }

      if (this.btnCheckUpdate) {
        this.btnCheckUpdate.disabled = isChecking || isUpdating;
        if (isUpdating) {
          if (state.updateStatus === 'installing') {
            this.btnCheckUpdate.innerHTML = '<i class="ri-refresh-line ri-spin"></i> Restarting...';
          } else {
            this.btnCheckUpdate.innerHTML = `<i class="ri-loader-4-line ri-spin"></i> Downloading (${state.updatePercent || 0}%)...`;
          }
        } else if (isChecking) {
          this.btnCheckUpdate.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Checking...';
        } else if (state.hasUpdate) {
          this.btnCheckUpdate.innerHTML = `<i class="ri-download-cloud-line"></i> Install v${state.version || '0.1.1'}`;
        } else {
          this.btnCheckUpdate.innerHTML = '<i class="ri-refresh-line"></i> Check';
        }
      }

      if (this.updateStatusText) {
        if (isUpdating) {
          if (state.updateStatus === 'installing') {
            this.updateStatusText.textContent = `Installing Bukaake v${state.version || '0.1.1'} & restarting...`;
          } else {
            this.updateStatusText.textContent = `Downloading Bukaake v${state.version || '0.1.1'} — ${state.updatePercent || 0}%`;
          }
        } else if (state.hasUpdate) {
          this.updateStatusText.textContent = `Update available: Bukaake v${state.version || '0.1.1'}`;
        } else {
          this.updateStatusText.textContent = 'Bukaake v0.1.1 (Latest Version)';
        }
      }
    });
  }

  initAppearanceSettings() {
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
    if (updaterService.state.hasUpdate) {
      updaterService.installUpdate();
    } else {
      updaterService.checkUpdate({ silent: false });
    }
  }
}
