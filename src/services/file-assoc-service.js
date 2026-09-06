/**
 * Bukaake File Association & Default App Service
 * Coordinates Windows Shell registry capability registration,
 * path auto-healing, and launching Windows Default Apps (< 100 lines)
 */

import { toast } from '../components/toast.js';

class FileAssocService {
  constructor() {
    this.status = {
      is_registered: false,
      is_path_matched: false,
      registered_path: null,
      current_path: '',
    };
    this.listeners = new Set();
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
      const res = await this.invoke('check_association_status');
      if (res) {
        this.status = res;
        this.notify();
      }
      return this.status;
    } catch (err) {
      console.warn('[FileAssocService] checkStatus failed:', err);
      return this.status;
    }
  }

  async registerAndOpenDefaultApps() {
    if (!this.isTauri()) {
      toast.show('Default App registration requires the native desktop app.', 'info');
      return;
    }
    try {
      const res = await this.invoke('register_file_associations');
      if (res) {
        this.status = res;
        this.notify();
      }
      await this.invoke('launch_default_apps_settings');
      toast.show('Bukaake registered! Click "Set default" in Windows Settings.', 'success');
    } catch (err) {
      console.error('[FileAssocService] register failed:', err);
      toast.show(`Registration error: ${err}`, 'error');
    }
  }

  async unregister() {
    if (!this.isTauri()) return;
    try {
      const res = await this.invoke('unregister_file_associations');
      if (res) {
        this.status = res;
        this.notify();
      }
      toast.show('File associations removed from Windows.', 'info');
    } catch (err) {
      console.error('[FileAssocService] unregister failed:', err);
      toast.show(`Unregister error: ${err}`, 'error');
    }
  }
}

export const fileAssocService = new FileAssocService();
