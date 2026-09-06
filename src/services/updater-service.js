/**
 * Bukaake Auto-Updater Service
 * Coordinates background launch checks (with Mode 2 Fullscreen Viewer exclusion),
 * manual checks, and bidirectional state synchronization across all windows (< 160 lines)
 */

import { toast } from '../components/toast.js';

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
    this.currentVersion = '0.1.0';
    this.repoEndpoint = 'https://api.github.com/repos/Crlyzd/Bukaake/releases/latest';
    this.state = this.loadInitialState();
    this.bindStorageSync();
  }

  loadInitialState() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Purge legacy mock toggle data claiming v0.2.0
        if (parsed.version === '0.2.0' && parsed.hasUpdate) {
          localStorage.removeItem(this.storageKey);
          localStorage.removeItem('bukaake_update_available');
        } else {
          return parsed;
        }
      }
    } catch (_) {}
    return {
      hasUpdate: false,
      version: this.currentVersion,
      releaseUrl: '',
      isChecking: false,
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
    }
  }

  /**
   * App Launch Check
   * STRICT IMMERSION INVARIANT: Mode 2 (Fullscreen Viewer) is strictly excluded
   * for zero loading delays and instant Picasa-style desktop photo viewing.
   */
  initLaunchCheck() {
    if (document.body.classList.contains('mode-viewer')) {
      return;
    }

    // Delayed by 1.5s in Regular App Mode so initial render stays at 60 FPS
    setTimeout(() => {
      if (document.body.classList.contains('mode-viewer')) return;
      this.checkUpdate({ silent: true });
    }, 1500);
  }

  /**
   * Called when Settings button is clicked in the main window
   */
  onSettingsClick() {
    // Only check if no check within the last hour to prevent rate limiting
    const ONE_HOUR = 60 * 60 * 1000;
    if (this.state.hasUpdate || (Date.now() - this.state.lastChecked < ONE_HOUR)) return;
    this.checkUpdate({ silent: true });
  }

  /**
   * Perform update check against GitHub Releases
   */
  async checkUpdate({ silent = false } = {}) {
    if (this.state.isChecking) return;

    this.state.isChecking = true;
    this.broadcast();

    try {
      const res = await fetch(this.repoEndpoint, {
        headers: { 'Accept': 'application/vnd.github.v3+json' },
      });

      if (res.status === 404) {
        // No release published yet on GitHub repository
        this.state.hasUpdate = false;
        this.state.version = this.currentVersion;
        this.state.releaseUrl = '';
        if (!silent) toast.show(`You are on the latest version of Bukaake (v${this.currentVersion})`);
      } else if (res.ok) {
        const data = await res.json();
        const remoteTag = data.tag_name || data.name || '';
        const remoteVer = remoteTag.replace(/^v/i, '');

        if (compareVersions(remoteVer, this.currentVersion) > 0) {
          this.state.hasUpdate = true;
          this.state.version = remoteVer;
          this.state.releaseUrl = data.html_url || 'https://github.com/Crlyzd/Bukaake/releases';
          toast.show(`New version v${this.state.version} is available!`);
        } else {
          this.state.hasUpdate = false;
          this.state.version = this.currentVersion;
          this.state.releaseUrl = '';
          if (!silent) toast.show(`You are on the latest version of Bukaake (v${this.currentVersion})`);
        }
      } else {
        // Rate-limited or other non-fatal HTTP response
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

  setUpdateAvailable(hasUpdate, version = '0.1.0') {
    this.state.hasUpdate = hasUpdate;
    this.state.version = version;
    this.broadcast();
  }
}

export const updaterService = new UpdaterService();
if (typeof window !== 'undefined') {
  window.updaterService = updaterService;
}
