/**
 * Bukaake Tauri v2 IPC Bridge
 * Robust wrapper for Tauri v2 window APIs, CLI arguments, and filesystem IPC
 */

export class TauriBridge {
  constructor() {
    this.hasTauri = typeof window !== 'undefined' && Boolean(window.__TAURI__);
  }

  isTauri() {
    return typeof window !== 'undefined' && Boolean(window.__TAURI__);
  }

  async invoke(cmd, args = {}) {
    if (!this.isTauri() || !window.__TAURI__.core?.invoke) {
      return null;
    }
    try {
      return await window.__TAURI__.core.invoke(cmd, args);
    } catch (err) {
      console.warn(`[TauriBridge] IPC error in '${cmd}':`, err);
      throw err;
    }
  }

  async closeWindow() {
    if (this.isTauri()) {
      try { await this.invoke('close_window'); return; } catch (e) {}
      try { await window.__TAURI__.window?.getCurrentWindow()?.close(); return; } catch (e) {}
    }
    try { window.close(); } catch (e) {}
  }

  async exitApp() {
    if (this.isTauri()) {
      try { await this.invoke('exit_app'); return; } catch (e) {}
    }
    await this.closeWindow();
  }

  async promptSaveFile(defaultName, filterExt = 'png') {
    if (this.isTauri()) {
      try {
        return await this.invoke('prompt_save_file', { defaultName, filterExt });
      } catch (e) { console.warn('[TauriBridge] prompt_save_file failed:', e); }
    }
    return null;
  }

  async saveImageBytes(path, base64Data) {
    if (this.isTauri()) {
      try {
        await this.invoke('save_image_bytes', { path, base64Data });
        return true;
      } catch (e) {
        console.warn('[TauriBridge] save_image_bytes failed:', e);
        throw e;
      }
    }
    return false;
  }

  async minimizeWindow() {
    try {
      if (this.isTauri()) {
        const win = window.__TAURI__.window?.getCurrentWindow?.();
        if (win?.minimize) await win.minimize();
        else await this.invoke('minimize_window');
      }
    } catch (e) {}
  }

  async toggleMaximize() {
    try {
      if (this.isTauri()) {
        const win = window.__TAURI__.window?.getCurrentWindow?.();
        if (win?.toggleMaximize) await win.toggleMaximize();
        else await this.invoke('toggle_maximize_window');
        return;
      }
    } catch (e) {}
    if (!document.fullscreenElement) {
      try { await document.documentElement.requestFullscreen?.(); } catch (e) {}
    } else {
      try { await document.exitFullscreen?.(); } catch (e) {}
    }
  }

  async isFullscreen() {
    try {
      if (this.isTauri()) {
        const win = window.__TAURI__.window?.getCurrentWindow?.();
        if (win?.isFullscreen) return await win.isFullscreen();
        return await this.invoke('is_window_fullscreen');
      }
    } catch (e) {}
    return Boolean(document.fullscreenElement);
  }

  async setFullscreen(fullscreen = true) {
    try {
      if (this.isTauri()) {
        const win = window.__TAURI__.window?.getCurrentWindow?.();
        if (win?.setFullscreen) await win.setFullscreen(fullscreen);
        else await this.invoke('set_fullscreen_window', { fullscreen });
        return;
      }
    } catch (e) {}
    if (fullscreen) {
      if (!document.fullscreenElement) try { await document.documentElement.requestFullscreen?.(); } catch (e) {}
    } else {
      if (document.fullscreenElement) try { await document.exitFullscreen?.(); } catch (e) {}
    }
  }

  async isMaximized() {
    try {
      if (this.isTauri()) {
        const win = window.__TAURI__.window?.getCurrentWindow?.();
        if (win?.isMaximized) return await win.isMaximized();
        return await this.invoke('is_window_maximized');
      }
    } catch (e) {}
    return Boolean(document.fullscreenElement);
  }

  async maximizeBorderless() {
    try {
      if (this.isTauri()) {
        const win = window.__TAURI__.window?.getCurrentWindow?.();
        if (win && !(await win.isMaximized())) await win.maximize();
        else if (!(await this.invoke('is_window_maximized'))) await this.invoke('toggle_maximize_window');
      }
    } catch (e) {}
  }

  async unmaximize() {
    try {
      if (this.isTauri()) {
        const win = window.__TAURI__.window?.getCurrentWindow?.();
        if (win?.unmaximize) await win.unmaximize();
        else await this.invoke('unmaximize_window');
        return;
      }
    } catch (e) {}
    if (document.fullscreenElement) try { await document.exitFullscreen?.(); } catch (e) {}
  }

  async resizeAndCenter(width, height) {
    try {
      if (this.isTauri()) {
        await this.invoke('resize_and_center_window', {
          width: Math.round(width),
          height: Math.round(height),
        });
        return;
      }
    } catch (e) {
      console.warn('[TauriBridge] resize_and_center_window failed:', e);
    }

    try {
      if (this.isTauri() && window.__TAURI__.window?.getCurrentWindow) {
        const win = window.__TAURI__.window.getCurrentWindow();
        await win.unmaximize();
        if (window.__TAURI__.window.LogicalSize) {
          await win.setSize(new window.__TAURI__.window.LogicalSize(width, height));
        }
        await win.center();
      }
    } catch (e) {}
  }

  async startResizeDragging(direction) {
    try {
      if (this.isTauri() && window.__TAURI__.window?.getCurrentWindow) {
        await window.__TAURI__.window.getCurrentWindow().startResizeDragging(direction);
      }
    } catch (e) {}
  }

  async getInitialImage() {
    if (!this.isTauri()) return null;
    try {
      return await this.invoke('get_initial_image');
    } catch (err) {
      console.warn('[TauriBridge] get_initial_image failed:', err);
      return null;
    }
  }

  async readImageFile(path) {
    if (!this.isTauri()) return null;
    try {
      return await this.invoke('read_image_file', { path });
    } catch (err) {
      console.warn(`[TauriBridge] read_image_file failed for '${path}':`, err);
      throw err;
    }
  }

  async openUrl(url) {
    if (!url) return;
    try {
      if (this.isTauri()) {
        await this.invoke('open_url', { url });
        return;
      }
    } catch (e) {
      console.warn('[TauriBridge] invoke open_url failed:', e);
    }

    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {}
  }

  async setWindowVibrancy(isDark = false, isViewer = false) {
    if (this.isTauri()) {
      try { await this.invoke('set_window_vibrancy', { isDark, isViewer }); } catch (e) {}
    }
  }

  async openSettingsWindow() {
    if (!this.isTauri()) return false;
    try {
      await this.invoke('open_settings_window');
      return true;
    } catch (e) {
      return false;
    }
  }

  async hideSettingsWindow() {
    if (this.isTauri()) {
      try { await this.invoke('hide_settings_window'); } catch (e) {}
    }
  }

  async showInFolder(path) {
    if (this.isTauri() && path) {
      try { await this.invoke('show_in_folder', { path }); return true; } catch (e) { console.warn(e); }
    }
    return false;
  }

  async readImageContext(path) {
    if (!this.isTauri()) return null;
    try {
      return await this.invoke('read_image_context', { path });
    } catch (err) {
      console.warn(`[TauriBridge] read_image_context failed for '${path}':`, err);
      return null;
    }
  }

  async playWindowsDing() {
    if (this.isTauri()) {
      try { await this.invoke('play_windows_ding'); } catch (e) {}
    }
  }

  onSettingsModalState(callback) {
    if (this.isTauri() && window.__TAURI__?.event?.listen) {
      window.__TAURI__.event.listen('settings-modal-state', (event) => {
        callback(Boolean(event.payload));
      });
    }
  }

  initExternalLinks() {
    document.addEventListener('click', (e) => {
      const anchor = e.target.closest('a[href^="http"]');
      if (anchor) {
        e.preventDefault();
        this.openUrl(anchor.href);
      }
    });
  }
}

export const tauriBridge = new TauriBridge();
