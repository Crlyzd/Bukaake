/**
 * Bukaake Settings Standalone Window Controller
 * Coordinates live settings, live sync with main window, and window controls (< 150 lines)
 */

import './styles/main.css';
import { tauriBridge } from './services/tauri-bridge.js';
import { toast } from './components/toast.js';
import { updaterService } from './services/updater-service.js';

class SettingsApp {
  constructor() {
    this.btnClose = document.getElementById('btnCloseWindow');
    this.sliderWindowOpacity = document.getElementById('sliderWindowOpacity');
    this.valWindowOpacity = document.getElementById('valWindowOpacity');
    this.btnCheckUpdate = document.getElementById('btnCheckUpdate');
    this.updateStatusText = document.getElementById('updateStatusText');
    this.updateBanner = document.querySelector('.settings-update-banner');

    this.init();
  }

  init() {
    this.syncThemeFromStorage();
    this.bindWindowControls();
    this.bindAppearanceControls();
    this.bindUpdater();
    tauriBridge.initExternalLinks();

    window.addEventListener('contextmenu', (e) => {
      if (!Boolean(import.meta.env?.DEV) || !e.shiftKey) e.preventDefault();
    });

    // Listen to theme or setting changes across windows
    window.addEventListener('storage', (e) => {
      if (e.key === 'bukaake_theme') {
        this.syncThemeFromStorage();
      }
    });

    if (window.__TAURI__?.event?.listen) {
      window.__TAURI__.event.listen('theme-changed', (e) => {
        this.applyTheme(e.payload?.theme || 'dark');
      });
    }
  }

  syncThemeFromStorage() {
    const theme = localStorage.getItem('bukaake_theme') || 'dark';
    this.applyTheme(theme);
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.classList.toggle('light-theme', theme === 'light');
    document.body.classList.toggle('dark', theme === 'dark');
  }

  bindWindowControls() {
    this.btnClose?.addEventListener('click', () => {
      tauriBridge.hideSettingsWindow();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        tauriBridge.hideSettingsWindow();
      }
    });
  }

  bindAppearanceControls() {
    const savedOpacity = localStorage.getItem('bukaake_window_opacity') || '28';
    this.applyWindowOpacity(savedOpacity);

    if (this.sliderWindowOpacity && this.valWindowOpacity) {
      this.sliderWindowOpacity.value = savedOpacity;
      this.valWindowOpacity.textContent = `${savedOpacity}%`;

      this.sliderWindowOpacity.addEventListener('input', (e) => {
        const val = e.target.value;
        this.valWindowOpacity.textContent = `${val}%`;
        this.applyWindowOpacity(val);
        localStorage.setItem('bukaake_window_opacity', val);
        this.broadcastChange({ opacity: val });
      });
    }
  }

  applyWindowOpacity(percentage) {
    const alpha = (parseInt(percentage, 10) / 100).toFixed(2);
    document.documentElement.style.setProperty('--window-opacity', alpha);
  }

  broadcastChange(data) {
    if (window.__TAURI__?.event?.emit) {
      window.__TAURI__.event.emit('settings-changed', data);
    }
  }

  bindUpdater() {
    updaterService.subscribe((state) => {
      this.updateBanner?.classList.toggle('has-update', Boolean(state.hasUpdate));
      if (this.btnCheckUpdate) {
        this.btnCheckUpdate.disabled = Boolean(state.isChecking);
        if (state.isChecking) {
          this.btnCheckUpdate.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Checking...';
        } else if (state.hasUpdate) {
          this.btnCheckUpdate.innerHTML = `<i class="ri-download-cloud-line"></i> Install v${state.version || '0.2.0'}`;
        } else {
          this.btnCheckUpdate.innerHTML = '<i class="ri-refresh-line"></i> Check';
        }
      }
      if (this.updateStatusText) {
        if (state.hasUpdate) {
          this.updateStatusText.textContent = `Update available: Bukaake v${state.version || '0.2.0'}`;
        } else {
          this.updateStatusText.textContent = 'Bukaake v0.1.0 (Latest Version)';
        }
      }
    });

    this.btnCheckUpdate?.addEventListener('click', () => {
      updaterService.checkUpdate({ silent: false });
    });
  }
}

new SettingsApp();
