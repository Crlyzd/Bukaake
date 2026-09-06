/**
 * Bukaake Auto-Updater Service
 * Coordinates background launch checks (with Mode 2 Fullscreen Viewer exclusion),
 * manual checks, asset matching, in-place self-updating, and multi-window state synchronization (< 270 lines)
 */

import { toast } from '../components/toast.js';

export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.2';

function compareVersions(v1, v2) {
  const clean1 = (v1 || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const clean2 = (v2 || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const maxLen = Math.max(clean1.length, clean2.length);
  for (let i = 0; i < maxLen; i++) {
    const num1 = clean1[i] || 0;
    const num2 = clean2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

class UpdaterService {
  constructor() {
    this.storageKey = 'bukaake_update_state';
    this.subscribers = new Set();
    this.currentVersion = APP_VERSION;
    this.repoEndpoint = 'https://api.github.com/repos/Crlyzd/Bukaake/releases/latest';
    this.state = this.loadInitialState();
    this.bindStorageSync();
  }

  loadInitialState() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.version === '0.2.0' && parsed.hasUpdate) {
          localStorage.removeItem(this.storageKey);
          localStorage.removeItem('bukaake_update_available');
        } else {
          return {
            ...parsed,
            isUpdating: false,
            updatePercent: 0,
            updateStatus: 'idle',
          };
        }
      }
    } catch (_) {}
    return {
      hasUpdate: false,
      version: this.currentVersion,
      releaseUrl: '',
      assetUrl: '',
      isChecking: false,
      isUpdating: false,
      updatePercent: 0,
      updateStatus: 'idle',
      lastChecked: 0,
    };
  }

  saveState() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.state));
      localStorage.setItem('bukaake_update_available', String(this.state.hasUpdate));
    } catch (_) {}
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    callback(this.state);
    return () => this.subscribers.delete(callback);
  }

  broadcast() {
    this.saveState();
    this.subscribers.forEach((fn) => {
      try { fn(this.state); } catch (_) {}
    });

    document.dispatchEvent(new CustomEvent('bukaake:update-state', { detail: this.state }));

    if (window.__TAURI__?.event?.emit) {
      window.__TAURI__.event.emit('bukaake-update-state', this.state);
      window.__TAURI__.event.emit('settings-changed', {
        type: 'update-status',
        available: this.state.hasUpdate,
        version: this.state.version,
        releaseUrl: this.state.releaseUrl,
        assetUrl: this.state.assetUrl,
        isUpdating: this.state.isUpdating,
        updatePercent: this.state.updatePercent,
        updateStatus: this.state.updateStatus,
      });
    }
  }

  bindStorageSync() {
    window.addEventListener('storage', (e) => {
      if (e.key === this.storageKey && e.newValue) {
        try {
          this.state = JSON.parse(e.newValue);
          this.subscribers.forEach((fn) => fn(this.state));
        } catch (_) {}
      }
    });

    if (window.__TAURI__?.event?.listen) {
      window.__TAURI__.event.listen('bukaake-update-state', (e) => {
        if (e.payload) {
          this.state = e.payload;
          this.subscribers.forEach((fn) => fn(this.state));
        }
      });

      window.__TAURI__.event.listen('bukaake-update-progress', (e) => {
        if (e.payload) {
          const { status, percent } = e.payload;
          this.state.isUpdating = status === 'downloading' || status === 'installing';
          this.state.updateStatus = status || 'downloading';
          if (typeof percent === 'number') {
            this.state.updatePercent = Math.round(percent);
          }
          this.broadcast();
        }
      });
    }
  }

  async getSystemArch() {
    if (window.__TAURI__?.core?.invoke) {
      try {
        return await window.__TAURI__.core.invoke('get_system_arch');
      } catch (_) {}
    }
    return /arm64|aarch64/i.test(navigator.userAgent || '') ? 'arm64' : 'x64';
  }

  selectAssetUrl(assets = [], arch = 'x64') {
    if (!Array.isArray(assets) || assets.length === 0) return '';
    const exeAssets = assets.filter((a) => (a.name || '').toLowerCase().endsWith('.exe'));
    if (exeAssets.length === 0) return '';
    const match = exeAssets.find((a) => (a.name || '').toLowerCase().includes(arch));
    return match ? match.browser_download_url : exeAssets[0].browser_download_url || '';
  }

  initLaunchCheck() {
    if (document.body.classList.contains('mode-viewer')) return;
    setTimeout(() => {
      if (document.body.classList.contains('mode-viewer')) return;
      this.checkUpdate({ silent: true });
    }, 1500);
  }

  onSettingsClick() {
    const ONE_HOUR = 60 * 60 * 1000;
    if (this.state.hasUpdate || (Date.now() - this.state.lastChecked < ONE_HOUR)) return;
    this.checkUpdate({ silent: true });
  }

  async checkUpdate({ silent = false } = {}) {
    if (this.state.isChecking || this.state.isUpdating) return;
    this.state.isChecking = true;
    this.broadcast();

    try {
      const res = await fetch(this.repoEndpoint, {
        headers: { 'Accept': 'application/vnd.github.v3+json' },
      });

      if (res.status === 404) {
        this.state.hasUpdate = false;
        this.state.version = this.currentVersion;
        this.state.releaseUrl = '';
        this.state.assetUrl = '';
        if (!silent) toast.show(`You are on the latest version of Bukaake (v${this.currentVersion})`);
      } else if (res.ok) {
        const data = await res.json();
        const remoteTag = data.tag_name || data.name || '';
        const remoteVer = remoteTag.replace(/^v/i, '');

        if (compareVersions(remoteVer, this.currentVersion) > 0) {
          const arch = await this.getSystemArch();
          this.state.hasUpdate = true;
          this.state.version = remoteVer;
          this.state.releaseUrl = data.html_url || 'https://github.com/Crlyzd/Bukaake/releases';
          this.state.assetUrl = this.selectAssetUrl(data.assets, arch);
          toast.show(`New version v${this.state.version} is available!`);
        } else {
          this.state.hasUpdate = false;
          this.state.version = this.currentVersion;
          this.state.releaseUrl = '';
          this.state.assetUrl = '';
          if (!silent) toast.show(`You are on the latest version of Bukaake (v${this.currentVersion})`);
        }
      } else {
        this.state.hasUpdate = false;
        if (!silent) toast.show(`You are on the latest version of Bukaake (v${this.currentVersion})`);
      }
    } catch (_) {
      this.state.hasUpdate = false;
      if (!silent) toast.show('Unable to connect to GitHub releases.');
    } finally {
      this.state.isChecking = false;
      this.state.lastChecked = Date.now();
      this.broadcast();
    }
  }

  async installUpdate() {
    if (this.state.isUpdating) return;
    if (!this.state.hasUpdate) {
      return this.checkUpdate({ silent: false });
    }

    const assetUrl = this.state.assetUrl;
    if (!window.__TAURI__?.core?.invoke || !assetUrl) {
      const url = this.state.releaseUrl || 'https://github.com/Crlyzd/Bukaake/releases';
      window.open(url, '_blank');
      return;
    }

    this.state.isUpdating = true;
    this.state.updateStatus = 'downloading';
    this.state.updatePercent = 0;
    this.broadcast();
    toast.show(`Downloading Bukaake v${this.state.version}...`);

    try {
      await window.__TAURI__.core.invoke('download_and_install_update', { assetUrl });
    } catch (err) {
      console.error('[UpdaterService] Install failed:', err);
      this.state.isUpdating = false;
      this.state.updateStatus = 'error';
      this.broadcast();
      toast.show(`Update failed: ${err}`);
      const url = this.state.releaseUrl || 'https://github.com/Crlyzd/Bukaake/releases';
      if (window.__TAURI__?.core?.invoke) {
        window.__TAURI__.core.invoke('open_url', { url }).catch(() => window.open(url, '_blank'));
      } else {
        window.open(url, '_blank');
      }
    }
  }

  setUpdateAvailable(hasUpdate, version = APP_VERSION, assetUrl = '') {
    this.state.hasUpdate = hasUpdate;
    this.state.version = version;
    this.state.assetUrl = assetUrl;
    this.broadcast();
  }
}

export function hydrateAppVersions(root = document) {
  root.querySelectorAll('.app-version, .settings-win-version').forEach((el) => {
    el.textContent = `v${APP_VERSION}`;
  });
  root.querySelectorAll('.settings-hero-subtitle').forEach((el) => {
    el.textContent = `v${APP_VERSION} • Portable Edition`;
  });
  root.querySelectorAll('.settings-subtitle').forEach((el) => {
    el.textContent = `v${APP_VERSION} (x64) • Glass Image Viewer`;
  });
  root.querySelectorAll('#updateStatusText').forEach((el) => {
    if (!updaterService.state.hasUpdate && !updaterService.state.isUpdating) {
      el.textContent = `Bukaake v${APP_VERSION} (Latest Version)`;
    }
  });
}

export const updaterService = new UpdaterService();
if (typeof window !== 'undefined') {
  window.updaterService = updaterService;
  window.hydrateAppVersions = hydrateAppVersions;
}
