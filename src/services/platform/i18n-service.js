/**
 * Bukaake Internationalization (i18n) Service
 * Micro-i18n coordinator with fallback chaining, DOM batch translation, and cross-window sync (< 160 lines)
 */

import en from '../../locales/en.json';
import id from '../../locales/id.json';
import jvNgoko from '../../locales/jv-ngoko.json';
import jvKrama from '../../locales/jv-krama.json';
import jvMalangan from '../../locales/jv-malangan.json';
import { LOCALES, DEFAULT_LOCALE, getLocaleMeta } from '../../locales/manifest.js';

const STORAGE_KEY = 'bukaake-language';
const EVENT_NAME = 'bukaake-language-changed';
const TAURI_EVENT = 'tauri-language-changed';

class I18nService {
  constructor() {
    this.dictionaries = {
      en,
      id,
      'jv-ngoko': jvNgoko,
      'jv-krama': jvKrama,
      'jv-malangan': jvMalangan,
    };
    this.currentLocale = DEFAULT_LOCALE;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;

    let saved = localStorage.getItem(STORAGE_KEY);
    if (!saved || !this.dictionaries[saved]) {
      const navLang = (navigator.language || '').toLowerCase();
      saved = navLang.startsWith('id') ? 'id' : DEFAULT_LOCALE;
    }

    this.currentLocale = saved;
    this.translateDocument();
    this.bindEvents();
    this.initialized = true;
  }

  bindEvents() {
    // Cross-window sync via storage event (when Settings changes language)
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY && e.newValue && e.newValue !== this.currentLocale) {
        this.setLanguage(e.newValue, false);
      }
    });

    // Cross-window sync via Tauri event
    if (window.__TAURI__?.event?.listen) {
      window.__TAURI__.event.listen(TAURI_EVENT, (event) => {
        const lang = event.payload?.language;
        if (lang && lang !== this.currentLocale && this.dictionaries[lang]) {
          this.setLanguage(lang, false);
        }
      });
    }
  }

  getLanguage() {
    return this.currentLocale;
  }

  getLocaleMeta() {
    return getLocaleMeta(this.currentLocale);
  }

  getLocales() {
    return LOCALES;
  }

  setLanguage(code, persist = true) {
    if (!this.dictionaries[code]) return false;
    this.currentLocale = code;

    if (persist) {
      localStorage.setItem(STORAGE_KEY, code);
      if (window.__TAURI__?.event?.emit) {
        window.__TAURI__.event.emit(TAURI_EVENT, { language: code });
      }
    }

    this.translateDocument();

    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, {
        detail: { language: code, meta: this.getLocaleMeta() },
      })
    );
    return true;
  }

  getNestedValue(obj, keyPath) {
    if (!obj || !keyPath) return null;
    return keyPath.split('.').reduce((acc, part) => (acc ? acc[part] : null), obj);
  }

  t(key, params = {}) {
    let text = this.getNestedValue(this.dictionaries[this.currentLocale], key);
    if (!text && this.currentLocale !== DEFAULT_LOCALE) {
      text = this.getNestedValue(this.dictionaries[DEFAULT_LOCALE], key);
    }
    if (!text) return key;

    if (typeof text === 'string' && params && Object.keys(params).length > 0) {
      return text.replace(/\{(\w+)\}/g, (match, p) => (p in params ? params[p] : match));
    }
    return text;
  }

  translateDocument(root = document) {
    // Text content
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        const translated = this.t(key);
        if (translated && translated !== key) {
          el.textContent = translated;
        }
      }
    });

    // Titles & tooltips
    root.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      if (key) {
        const translated = this.t(key);
        if (translated && translated !== key) {
          el.setAttribute('title', translated);
        }
      }
    });

    // Placeholders
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) {
        const translated = this.t(key);
        if (translated && translated !== key) {
          el.setAttribute('placeholder', translated);
        }
      }
    });
  }
}

export const i18n = new I18nService();
