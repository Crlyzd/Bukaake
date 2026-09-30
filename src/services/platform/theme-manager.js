import { tauriBridge } from './tauri-bridge.js';

export class ThemeManager {
  constructor(options = {}) {
    this.storageKey = 'bukaake_theme';
    this.checkerboardKey = 'bukaake_checkerboard';
    this.themeToggleBtn = null;
    this.onThemeChange = options.onThemeChange || null;
    this.onCheckerboardChange = options.onCheckerboardChange || null;
    this.currentTheme = 'dark';
    this.checkerboardEnabled = false;

    this.init();
  }

  init() {
    const saved = localStorage.getItem(this.storageKey);
    if (saved === 'light' || saved === 'dark') {
      this.currentTheme = saved;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      this.currentTheme = 'light';
    } else {
      this.currentTheme = 'dark';
    }

    this.applyTheme(this.currentTheme, false, false);

    const savedCheckerboard = localStorage.getItem(this.checkerboardKey);
    this.applyCheckerboard(savedCheckerboard === 'true', false, false);

    // Listen to system theme changes if user hasn't explicitly set one
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
        if (!localStorage.getItem(this.storageKey)) {
          this.applyTheme(e.matches ? 'light' : 'dark', false, true);
        }
      });
    }

    // Cross-window settings synchronization via StorageEvent
    window.addEventListener('storage', (e) => {
      if (e.key === this.storageKey && (e.newValue === 'light' || e.newValue === 'dark')) {
        this.applyTheme(e.newValue, false, false);
      } else if (e.key === this.checkerboardKey && e.newValue !== null) {
        this.applyCheckerboard(e.newValue === 'true', false, false);
      } else if (e.key === 'bukaake_window_opacity' && e.newValue) {
        const alpha = (parseInt(e.newValue, 10) / 100).toFixed(2);
        document.documentElement.style.setProperty('--window-opacity', alpha);
      }
    });

    // Cross-window synchronization via Tauri events
    if (window.__TAURI__?.event?.listen) {
      window.__TAURI__.event.listen('theme-changed', (e) => {
        const theme = e.payload?.theme;
        if (theme === 'light' || theme === 'dark') {
          this.applyTheme(theme, false, false);
        }
      });

      window.__TAURI__.event.listen('settings-changed', (e) => {
        if (e.payload?.theme === 'light' || e.payload?.theme === 'dark') {
          this.applyTheme(e.payload.theme, false, false);
        }
        if (typeof e.payload?.checkerboard === 'boolean') {
          this.applyCheckerboard(e.payload.checkerboard, false, false);
        }
        if (e.payload?.opacity !== undefined) {
          const alpha = (parseInt(e.payload.opacity, 10) / 100).toFixed(2);
          document.documentElement.style.setProperty('--window-opacity', alpha);
        }
      });
    }
  }

  bindToggleBtn(btnElement) {
    this.themeToggleBtn = btnElement;
    this.updateToggleIcon();
    this.themeToggleBtn?.addEventListener('click', () => {
      this.toggleTheme();
    });
  }

  toggleTheme() {
    const next = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(next, true, true);
  }

  applyTheme(theme, save = true, emitEvent = true) {
    if (this.currentTheme === theme && document.documentElement.getAttribute('data-theme') === theme) {
      return;
    }
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    document.body.classList.toggle('light-theme', theme === 'light');
    document.body.classList.toggle('dark', theme === 'dark');

    if (save) {
      localStorage.setItem(this.storageKey, theme);
    }

    const isViewer = document.body.classList.contains('mode-viewer');
    tauriBridge.setWindowVibrancy(theme === 'dark', isViewer);

    if (emitEvent && window.__TAURI__?.event?.emit) {
      window.__TAURI__.event.emit('theme-changed', { theme });
    }
    this.updateToggleIcon();
    this.onThemeChange?.(theme);
  }

  applyCheckerboard(enabled, save = true, emitEvent = true) {
    this.checkerboardEnabled = Boolean(enabled);
    if (save) {
      localStorage.setItem(this.checkerboardKey, this.checkerboardEnabled ? 'true' : 'false');
    }
    document.body.classList.toggle('bg-checkerboard', this.checkerboardEnabled);
    document.body.classList.toggle('bg-transparent', !this.checkerboardEnabled);

    if (emitEvent && window.__TAURI__?.event?.emit) {
      window.__TAURI__.event.emit('settings-changed', { checkerboard: this.checkerboardEnabled });
    }
    this.onCheckerboardChange?.(this.checkerboardEnabled);
  }

  toggleCheckerboard() {
    this.applyCheckerboard(!this.checkerboardEnabled, true, true);
  }

  updateToggleIcon() {
    if (!this.themeToggleBtn) return;
    const icon = this.themeToggleBtn.querySelector('i');
    if (icon) {
      icon.className = this.currentTheme === 'dark' ? 'ri-sun-line' : 'ri-moon-line';
    }
    this.themeToggleBtn.title = this.currentTheme === 'dark'
      ? 'Switch to Light Theme'
      : 'Switch to Dark Theme';
  }
}

export const themeManager = new ThemeManager();

