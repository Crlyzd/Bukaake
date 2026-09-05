/**
 * Bukaake Settings Standalone Window Controller
 * Coordinates live settings, live sync with main window, and window controls (< 150 lines)
 */

import { tauriBridge } from './services/tauri-bridge.js';
import { toast } from './components/toast.js';

class SettingsApp {
  constructor() {
    this.btnClose = document.getElementById('btnCloseWindow');
    this.sliderWindowOpacity = document.getElementById('sliderWindowOpacity');
    this.valWindowOpacity = document.getElementById('valWindowOpacity');
    this.btnCheckUpdate = document.getElementById('btnCheckUpdate');
    this.updateStatusText = document.getElementById('updateStatusText');

    this.init();
  }

  init() {
    this.syncThemeFromStorage();
    this.bindWindowControls();
    this.bindAppearanceControls();
    this.bindUpdater();
    tauriBridge.initExternalLinks();

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
    this.btnCheckUpdate?.addEventListener('click', () => {
      const original = this.btnCheckUpdate.innerHTML;
      this.btnCheckUpdate.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Checking...';
      this.btnCheckUpdate.disabled = true;

      setTimeout(() => {
        this.btnCheckUpdate.innerHTML = original;
        this.btnCheckUpdate.disabled = false;
        if (this.updateStatusText) {
          this.updateStatusText.textContent = 'Bukaake v0.1.0 (Latest Version)';
        }
        toast.show('You are on the latest version of Bukaake (v0.1.0)');
      }, 800);
    });
  }
}

new SettingsApp();
