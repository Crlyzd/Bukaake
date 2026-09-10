/**
 * Bukaake Windows Startup & Autostart Service
 * Coordinates HKCU registry startup configuration and multi-window sync (< 100 lines)
 */

import { toast } from '../components/toast.js';

class AutostartService {
  constructor() {
    this.status = {
      is_enabled: false,
      is_path_matched: false,
      registered_path: null,
      current_path: '',
    };
    this.listeners = new Set();
    this.initSync();
  }

  isTauri() {
    return typeof window !== 'undefined' && Boolean(window.__TAURI__?.core?.invoke);
  }

  async invoke(cmd, args = {}) {
    if (!this.isTauri()) return null;
    return await window.__TAURI__.core.invoke(cmd, args);
  }

  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.status);
    return () => this.listeners.delete(callback);
  }

  notify() {
    for (const cb of this.listeners) {
      try { cb(this.status); } catch (e) { console.error(e); }
    }
  }

  async checkStatus() {
    if (!this.isTauri()) return this.status;
    try {
      const res = await this.invoke('get_autostart_status');
      if (res) {
        this.status = res;
        this.notify();
      }
      return this.status;
    } catch (err) {
      console.warn('[AutostartService] checkStatus failed:', err);
      return this.status;
    }
  }

  async setEnabled(enabled) {
    if (!this.isTauri()) {
      toast.show('Windows startup configuration requires the desktop app.', 'info');
      return this.status;
    }

    try {
      const res = await this.invoke('set_autostart_enabled', { enabled: Boolean(enabled) });
      if (res) {
        this.status = res;
        this.notify();
        localStorage.setItem('bukaake_autostart_enabled', enabled ? 'true' : 'false');
        if (window.__TAURI__?.event?.emit) {
          window.__TAURI__.event.emit('bukaake-autostart-changed', this.status);
        }
        toast.show(
          enabled ? 'Start with Windows enabled (tray launch)' : 'Start with Windows disabled',
          'success'
        );
      }
      return this.status;
    } catch (err) {
      console.error('[AutostartService] setEnabled failed:', err);
      toast.show('Failed to update startup configuration: ' + (err.message || err), 'error');
      return this.status;
    }
  }

  initSync() {
    if (typeof window === 'undefined') return;

    window.addEventListener('storage', (e) => {
      if (e.key === 'bukaake_autostart_enabled') {
        this.checkStatus();
      }
    });

    if (window.__TAURI__?.event?.listen) {
      window.__TAURI__.event.listen('bukaake-autostart-changed', (event) => {
        if (event.payload) {
          this.status = event.payload;
          this.notify();
        } else {
          this.checkStatus();
        }
      });
    }
  }
}

export const autostartService = new AutostartService();
