/**
 * Bukaake Settings Standalone Window Controller — Option B Architecture
 * Coordinates tabs, theme engine, live sync with main window, and system bindings (< 280 lines)
 */

import './styles/main.css';
import { tauriBridge } from './services/tauri-bridge.js';
import { toast } from './components/toast.js';
import { updaterService, APP_VERSION, hydrateAppVersions } from './services/updater-service.js';
import { fileAssocService } from './services/file-assoc-service.js';
import { bindCaptureSettings } from './components/settings-capture-section.js';
import { initHeartSprouter } from './components/heart-sprouter.js';

class SettingsApp {
  constructor() {
    this.btnClose = document.getElementById('btnCloseWindow');
    this.btnCheckUpdate = document.getElementById('btnCheckUpdate');
    this.updateStatusText = document.getElementById('updateStatusText');
    this.updateStatusIcon = document.getElementById('updateStatusIcon');
    this.updateBanner = document.querySelector('.settings-update-banner');
    this.updateProgressTrack = document.getElementById('updateProgressTrack');
    this.updateProgressFill = document.getElementById('updateProgressFill');
    this.btnSetDefault = document.getElementById('btnSetDefaultApp');
    this.assocBadge = document.getElementById('assocStatusBadge');
    this.toggleStandby = document.getElementById('toggleStandby');
    this.btnCardDark = document.getElementById('btnCardDark');
    this.btnCardLight = document.getElementById('btnCardLight');
    this.toggleCheckerboard = document.getElementById('toggleCheckerboard');

    this.init();
  }

  init() {
    hydrateAppVersions(document);
    this.syncThemeFromStorage();
    this.bindWindowControls();
    this.bindNavigation();
    this.bindThemeCards();
    this.bindCheckerboard();
    this.bindUpdater();
    this.bindFileAssociations();
    this.bindStandbySettings();
    this.bindCaptureSettings();
    initHeartSprouter(document.getElementById('authorHeart'));
    tauriBridge.initExternalLinks();

    window.addEventListener('contextmenu', (e) => {
      if (!Boolean(import.meta.env?.DEV) || !e.shiftKey) e.preventDefault();
    });

    window.addEventListener('storage', (e) => {
      if (e.key === 'bukaake_theme' && (e.newValue === 'light' || e.newValue === 'dark')) {
        this.applyTheme(e.newValue);
      } else if (e.key === 'bukaake_checkerboard' && this.toggleCheckerboard && e.newValue !== null) {
        this.toggleCheckerboard.checked = e.newValue === 'true';
      }
    });

    if (window.__TAURI__?.event?.listen) {
      window.__TAURI__.event.listen('theme-changed', (e) => {
        if (e.payload?.theme) {
          this.applyTheme(e.payload.theme);
        }
      });
      window.__TAURI__.event.listen('settings-changed', (e) => {
        if (e.payload?.theme) {
          this.applyTheme(e.payload.theme);
        }
        if (typeof e.payload?.checkerboard === 'boolean' && this.toggleCheckerboard) {
          this.toggleCheckerboard.checked = e.payload.checkerboard;
        }
      });
    }
  }

  bindNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = {
      general: document.getElementById('tabGeneral'),
      capture: document.getElementById('tabCapture'),
      about: document.getElementById('tabAbout')
    };

    navItems.forEach(item => {
      item.addEventListener('click', () => {
        navItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        const tabKey = item.dataset.tab;
        Object.keys(tabContents).forEach(key => {
          if (tabContents[key]) {
            tabContents[key].style.display = (key === tabKey) ? 'block' : 'none';
          }
        });
      });
    });
  }

  syncThemeFromStorage() {
    const theme = localStorage.getItem('bukaake_theme') || 'dark';
    this.applyTheme(theme);
  }

  applyTheme(theme) {
    if (this.currentTheme === theme && document.documentElement.getAttribute('data-theme') === theme) {
      return;
    }
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    document.body.classList.toggle('light-theme', theme === 'light');
    document.body.classList.toggle('dark', theme === 'dark');

    const isLight = theme === 'light';
    this.btnCardLight?.classList.toggle('active-theme', isLight);
    this.btnCardDark?.classList.toggle('active-theme', !isLight);
  }

  bindThemeCards() {
    const setTheme = (theme) => {
      if (this.currentTheme === theme) return;
      localStorage.setItem('bukaake_theme', theme);
      this.applyTheme(theme);
      tauriBridge.setWindowVibrancy(theme === 'dark');
      if (window.__TAURI__?.event?.emit) {
        window.__TAURI__.event.emit('theme-changed', { theme });
      }
    };

    this.btnCardDark?.addEventListener('click', () => setTheme('dark'));
    this.btnCardLight?.addEventListener('click', () => setTheme('light'));
  }

  bindCheckerboard() {
    if (!this.toggleCheckerboard) return;
    const isEnabled = localStorage.getItem('bukaake_checkerboard') === 'true';
    this.toggleCheckerboard.checked = isEnabled;

    this.toggleCheckerboard.addEventListener('change', () => {
      const checked = this.toggleCheckerboard.checked;
      localStorage.setItem('bukaake_checkerboard', checked ? 'true' : 'false');
      if (window.__TAURI__?.event?.emit) {
        window.__TAURI__.event.emit('settings-changed', { checkerboard: checked });
      }
    });
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

  bindUpdater() {
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
            this.btnCheckUpdate.innerHTML = '<i class="ri-restart-line ri-spin"></i> Restarting...';
          } else {
            this.btnCheckUpdate.innerHTML = `<i class="ri-loader-4-line ri-spin"></i> Downloading (${state.updatePercent || 0}%)...`;
          }
        } else if (isChecking) {
          this.btnCheckUpdate.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Checking...';
        } else if (state.hasUpdate) {
          this.btnCheckUpdate.innerHTML = `<i class="ri-download-cloud-line"></i> Install v${state.version || APP_VERSION}`;
        } else {
          this.btnCheckUpdate.innerHTML = '<i class="ri-restart-line"></i> Check';
        }
      }

      if (this.updateStatusIcon) {
        if (isUpdating || isChecking) {
          this.updateStatusIcon.className = 'ri-loader-4-line ri-spin';
        } else if (state.hasUpdate) {
          this.updateStatusIcon.className = 'ri-download-cloud-line';
        } else {
          this.updateStatusIcon.className = 'ri-checkbox-circle-line';
        }
      }

      if (this.updateStatusText) {
        if (isUpdating) {
          if (state.updateStatus === 'installing') {
            this.updateStatusText.textContent = `Installing Bukaake v${state.version || APP_VERSION} & restarting...`;
          } else {
            this.updateStatusText.textContent = `Downloading Bukaake v${state.version || APP_VERSION} — ${state.updatePercent || 0}%`;
          }
        } else if (isChecking) {
          this.updateStatusText.textContent = 'Checking GitHub for updates...';
        } else if (state.hasUpdate) {
          this.updateStatusText.textContent = `Update available: Bukaake v${state.version || APP_VERSION}`;
        } else {
          this.updateStatusText.textContent = `Bukaake v${APP_VERSION} (Latest Version)`;
        }
      }
    });

    this.btnCheckUpdate?.addEventListener('click', () => {
      if (updaterService.state.hasUpdate) {
        updaterService.installUpdate();
      } else {
        updaterService.checkUpdate({ silent: false });
      }
    });
  }

  bindFileAssociations() {
    this.assocPathText = document.getElementById('assocPathText');
    this.assocSubText = document.getElementById('assocSubText');
    this.assocCard = document.getElementById('cardFileAssoc');

    fileAssocService.subscribe((status) => {
      if (!this.assocBadge || !this.btnSetDefault) return;

      if (this.assocPathText) {
        this.assocPathText.textContent = status.current_path || 'Portable location';
        this.assocPathText.title = status.current_path || '';
      }

      if (status.is_registered) {
        this.assocBadge.textContent = status.is_path_matched ? 'Active' : 'Relocated';
        this.assocBadge.classList.toggle('matched', Boolean(status.is_path_matched));
        this.assocCard?.classList.add('is-registered');
        this.btnSetDefault.classList.add('is-registered');
        this.btnSetDefault.innerHTML = '<i class="ri-delete-bin-line"></i> Unregister';
        this.btnSetDefault.title = 'Remove Bukaake from Windows file associations';
        const formatLabel = `${status.format_count || 37} Formats`;
        if (this.assocSubText) {
          this.assocSubText.textContent = status.is_path_matched
            ? `Registered in Windows (${formatLabel})`
            : 'Path updated — Click to unregister / re-apply';
        }
      } else {
        this.assocBadge.textContent = `${status.format_count || 37} Formats`;
        this.assocBadge.classList.remove('matched');
        this.assocCard?.classList.remove('is-registered');
        this.btnSetDefault.classList.remove('is-registered');
        this.btnSetDefault.innerHTML = '<i class="ri-check-line"></i> Register';
        this.btnSetDefault.title = 'Register Bukaake in Windows';
        if (this.assocSubText) {
          this.assocSubText.textContent = 'Set as default for photos, RAW & VFX';
        }
      }
    });

    fileAssocService.checkStatus();

    this.btnSetDefault?.addEventListener('click', () => {
      if (fileAssocService.status.is_registered) {
        fileAssocService.unregister();
      } else {
        fileAssocService.registerAndOpenDefaultApps();
      }
    });
  }

  bindStandbySettings() {
    const isEnabled = localStorage.getItem('bukaake_standby_enabled') !== 'false';
    if (this.toggleStandby) {
      this.toggleStandby.checked = isEnabled;
      this.toggleStandby.addEventListener('change', () => {
        const checked = this.toggleStandby.checked;
        localStorage.setItem('bukaake_standby_enabled', checked ? 'true' : 'false');
        tauriBridge.invoke('set_standby_enabled', { enabled: checked });
        window.__TAURI__?.event?.emit('bukaake-standby-setting-changed', checked);
      });
    }

    window.addEventListener('storage', (e) => {
      if (e.key === 'bukaake_standby_enabled' && this.toggleStandby) {
        this.toggleStandby.checked = e.newValue !== 'false';
      }
    });
  }

  bindCaptureSettings() {
    bindCaptureSettings();
  }
}

new SettingsApp();
