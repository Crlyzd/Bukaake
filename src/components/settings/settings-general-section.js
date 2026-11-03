/**
 * Bukaake Settings General Section Controller
 * Encapsulates Theme cards, Canvas Checkerboard, Mode 2 Window Presentation, and Display Language (< 180 lines)
 */

import { tauriBridge } from '../../services/platform/tauri-bridge.js';
import { i18n } from '../../services/platform/i18n-service.js';

export function bindGeneralSettings(app) {
  // 1. Theme Selection Cards
  const btnDark = document.getElementById('btnCardDark');
  const btnLight = document.getElementById('btnCardLight');

  const setTheme = (theme) => {
    if (app.currentTheme === theme) return;
    localStorage.setItem('bukaake_theme', theme);
    app.applyTheme(theme);
    tauriBridge.setWindowVibrancy(theme === 'dark');
    if (window.__TAURI__?.event?.emit) {
      window.__TAURI__.event.emit('theme-changed', { theme });
    }
  };

  btnDark?.addEventListener('click', () => setTheme('dark'));
  btnLight?.addEventListener('click', () => setTheme('light'));

  // 2. Canvas Checkerboard
  const toggleCheckerboard = document.getElementById('toggleCheckerboard');
  if (toggleCheckerboard) {
    toggleCheckerboard.checked = localStorage.getItem('bukaake_checkerboard') === 'true';
    toggleCheckerboard.addEventListener('change', () => {
      const checked = toggleCheckerboard.checked;
      localStorage.setItem('bukaake_checkerboard', checked ? 'true' : 'false');
      if (window.__TAURI__?.event?.emit) {
        window.__TAURI__.event.emit('settings-changed', { checkerboard: checked });
      }
    });
  }

  // 3. Mode 2 Window Presentation Dropdown
  const wrapMode = document.getElementById('wrapMode2Style');
  const btnTrigger = document.getElementById('btnMode2StyleTrigger');
  const lblMode = document.getElementById('lblMode2Style');
  const menuMode = document.getElementById('menuMode2Style');

  const MODE_LABELS = {
    maximized: 'Maximized',
    fullscreen: 'Fullscreen',
  };

  const refreshModeLabels = () => {
    const currentVal = localStorage.getItem('bukaake-mode2-style') || 'maximized';
    if (lblMode) lblMode.textContent = MODE_LABELS[currentVal] || MODE_LABELS.maximized;
    menuMode?.querySelectorAll('.glass-dropdown-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.value === currentVal);
    });
  };

  const setMode2Style = (val) => {
    const key = (val === 'fullscreen') ? 'fullscreen' : 'maximized';
    localStorage.setItem('bukaake-mode2-style', key);
    refreshModeLabels();
    if (window.__TAURI__?.event?.emit) {
      window.__TAURI__.event.emit('settings-changed', { mode2Style: key });
    }
  };

  refreshModeLabels();

  if (btnTrigger && menuMode && wrapMode) {
    const closeDropdown = () => {
      menuMode.classList.add('hidden');
      wrapMode.classList.remove('open');
      document.removeEventListener('click', onDocClick);
    };

    const onDocClick = (e) => {
      if (!wrapMode.contains(e.target)) closeDropdown();
    };

    btnTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !menuMode.classList.contains('hidden');
      if (isOpen) {
        closeDropdown();
      } else {
        menuMode.classList.remove('hidden');
        wrapMode.classList.add('open');
        setTimeout(() => document.addEventListener('click', onDocClick), 10);
      }
    });

    menuMode.querySelectorAll('.glass-dropdown-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        setMode2Style(item.dataset.value);
        closeDropdown();
      });
    });
  }

  // 4. Display Language Dropdown
  const wrapLang = document.getElementById('wrapLanguage');
  const btnLangTrigger = document.getElementById('btnLanguageTrigger');
  const lblLang = document.getElementById('lblLanguage');
  const menuLang = document.getElementById('menuLanguage');

  if (menuLang) {
    menuLang.innerHTML = i18n.getLocales().map((loc) => `
      <button type="button" class="dropdown-item glass-dropdown-item ${loc.code === i18n.getLanguage() ? 'active' : ''}" data-value="${loc.code}">
        <span>${loc.nativeName}</span>
        <i class="ri-check-line check item-check"></i>
      </button>
    `).join('');
  }

  const refreshLanguageLabels = () => {
    const meta = i18n.getLocaleMeta();
    if (lblLang) lblLang.textContent = meta.nativeName;
    menuLang?.querySelectorAll('.glass-dropdown-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.value === i18n.getLanguage());
    });
  };

  refreshLanguageLabels();

  if (btnLangTrigger && menuLang && wrapLang) {
    const closeLangDropdown = () => {
      menuLang.classList.add('hidden');
      wrapLang.classList.remove('open');
      document.removeEventListener('click', onLangDocClick);
    };

    const onLangDocClick = (e) => {
      if (!wrapLang.contains(e.target)) closeLangDropdown();
    };

    btnLangTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !menuLang.classList.contains('hidden');
      if (isOpen) {
        closeLangDropdown();
      } else {
        menuLang.classList.remove('hidden');
        wrapLang.classList.add('open');
        setTimeout(() => document.addEventListener('click', onLangDocClick), 10);
      }
    });

    menuLang.querySelectorAll('.glass-dropdown-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        i18n.setLanguage(item.dataset.value);
        refreshLanguageLabels();
        closeLangDropdown();
      });
    });
  }

  window.addEventListener('storage', (e) => {
    if (e.key === 'bukaake-mode2-style') {
      refreshModeLabels();
    } else if (e.key === 'bukaake-language') {
      refreshLanguageLabels();
    }
  });

  window.addEventListener('bukaake-language-changed', () => {
    refreshLanguageLabels();
  });

  if (window.__TAURI__?.event?.listen) {
    window.__TAURI__.event.listen('settings-changed', (e) => {
      if (e.payload?.mode2Style) {
        refreshModeLabels();
      }
    });
  }
}
