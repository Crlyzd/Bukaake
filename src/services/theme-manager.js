/**
 * Bukaake Theme Manager Service
 * Manages pure neutral Dark and Light themes per Pillar 2
 */

export class ThemeManager {
  constructor(options = {}) {
    this.storageKey = 'bukaake_theme';
    this.themeToggleBtn = null;
    this.onThemeChange = options.onThemeChange || null;
    this.currentTheme = 'dark';

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

    this.applyTheme(this.currentTheme, false);

    // Listen to system theme changes if user hasn't explicitly set one
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
        if (!localStorage.getItem(this.storageKey)) {
          this.applyTheme(e.matches ? 'light' : 'dark', false);
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
    this.applyTheme(next, true);
  }

  applyTheme(theme, save = true) {
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    document.body.classList.toggle('light-theme', theme === 'light');
    document.body.classList.toggle('dark', theme === 'dark');

    if (save) {
      localStorage.setItem(this.storageKey, theme);
    }

    this.updateToggleIcon();
    this.onThemeChange?.(theme);
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
