/**
 * Bukaake Settings Standalone Window Controller
 * Coordinates live settings, live sync with main window, and window controls (< 150 lines)
 */

import './styles/main.css';
import { tauriBridge } from './services/tauri-bridge.js';
import { toast } from './components/toast.js';
import { updaterService, APP_VERSION, hydrateAppVersions } from './services/updater-service.js';
import { fileAssocService } from './services/file-assoc-service.js';
import { bindCaptureSettings } from './components/settings-capture-section.js';

class SettingsApp {
  constructor() {
    this.btnClose = document.getElementById('btnCloseWindow');
    this.sliderWindowOpacity = document.getElementById('sliderWindowOpacity');
    this.valWindowOpacity = document.getElementById('valWindowOpacity');
    this.btnCheckUpdate = document.getElementById('btnCheckUpdate');
    this.updateStatusText = document.getElementById('updateStatusText');
    this.updateStatusIcon = document.getElementById('updateStatusIcon');
    this.updateBanner = document.querySelector('.settings-update-banner');
    this.updateProgressTrack = document.getElementById('updateProgressTrack');
    this.updateProgressFill = document.getElementById('updateProgressFill');
    this.btnSetDefault = document.getElementById('btnSetDefaultApp');
    this.btnUnregisterAssoc = document.getElementById('btnUnregisterAssoc');
    this.assocBadge = document.getElementById('assocStatusBadge');
    this.assocPathChip = document.getElementById('assocPathChip');
    this.toggleStandby = document.getElementById('toggleStandby');
    this.standbyBadge = document.getElementById('standbyStatusBadge');

    this.init();
  }

  init() {
    hydrateAppVersions(document);
    this.syncThemeFromStorage();
    this.bindWindowControls();
    this.bindAppearanceControls();
    this.bindUpdater();
    this.bindFileAssociations();
    this.bindStandbySettings();
    this.bindCaptureSettings();
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
          this.btnCheckUpdate.innerHTML = `<i class="ri-download-cloud-line"></i> Install v${state.version || APP_VERSION}`;
        } else {
          this.btnCheckUpdate.innerHTML = '<i class="ri-refresh-line"></i> Check';
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
      this.updateStandbyUI(isEnabled);
      this.toggleStandby.addEventListener('change', () => {
        const checked = this.toggleStandby.checked;
        localStorage.setItem('bukaake_standby_enabled', checked ? 'true' : 'false');
        this.updateStandbyUI(checked);
        tauriBridge.invoke('set_standby_enabled', { enabled: checked });
        window.__TAURI__?.event?.emit('bukaake-standby-setting-changed', checked);
      });
    }

    window.addEventListener('storage', (e) => {
      if (e.key === 'bukaake_standby_enabled' && this.toggleStandby) {
        const checked = e.newValue !== 'false';
        this.toggleStandby.checked = checked;
        this.updateStandbyUI(checked);
      }
    });
  }

  updateStandbyUI(enabled) {
    if (this.standbyBadge) {
      this.standbyBadge.textContent = enabled ? 'Enabled' : 'Disabled';
      this.standbyBadge.classList.toggle('matched', enabled);
    }
  }

  bindCaptureSettings() {
    bindCaptureSettings();
  }
}

new SettingsApp();
