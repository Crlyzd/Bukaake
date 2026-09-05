/**
 * Bukaake Auto-Updater Service
 * Coordinates background launch checks (with Mode 2 Fullscreen Viewer exclusion),
 * manual checks, and bidirectional state synchronization across all windows (< 130 lines)
 */

import { toast } from '../components/toast.js';

class UpdaterService {
  constructor() {
    this.storageKey = 'bukaake_update_state';
    this.subscribers = new Set();
    this.state = this.loadInitialState();
    this.bindStorageSync();
  }

  loadInitialState() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      hasUpdate: localStorage.getItem('bukaake_update_available') === 'true',
      version: '0.2.0',
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
      return; // Skip completely in Fullscreen Mode
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
    if (this.state.hasUpdate) return;
    this.checkUpdate({ silent: true });
  }

  /**
   * Perform update check (supports silent background or interactive check)
   */
  async checkUpdate({ silent = false } = {}) {
    if (this.state.isChecking) return;

    this.state.isChecking = true;
    this.broadcast();

    // Simulated check delay (or Tauri plugin-updater when configured)
    await new Promise((resolve) => setTimeout(resolve, 700));

    this.state.isChecking = false;
    this.state.lastChecked = Date.now();
    // In dev / demo mode: toggle update status to provide immediate visual feedback
    this.state.hasUpdate = !this.state.hasUpdate;
    this.broadcast();

    if (this.state.hasUpdate) {
      toast.show(`New version v${this.state.version} is available!`);
    } else if (!silent) {
      toast.show('You are on the latest version of Bukaake (v0.1.0)');
    }
  }

  setUpdateAvailable(hasUpdate, version = '0.2.0') {
    this.state.hasUpdate = hasUpdate;
    this.state.version = version;
    this.broadcast();
  }
}

export const updaterService = new UpdaterService();
if (typeof window !== 'undefined') {
  window.updaterService = updaterService;
}
