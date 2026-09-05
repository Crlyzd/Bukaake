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
    try {
      if (this.isTauri() && window.__TAURI__.window?.getCurrentWindow) {
        await window.__TAURI__.window.getCurrentWindow().close();
        return;
      }
    } catch (e) { console.warn('[TauriBridge] getCurrentWindow().close() failed', e); }

    try {
      if (this.isTauri()) { await this.invoke('close_window'); return; }
    } catch (e) { console.warn('[TauriBridge] invoke close_window failed', e); }

    try { window.close(); } catch (e) {}
  }

  async minimizeWindow() {
    try {
      if (this.isTauri() && window.__TAURI__.window?.getCurrentWindow) {
        await window.__TAURI__.window.getCurrentWindow().minimize();
        return;
      }
    } catch (e) {}

    try {
      if (this.isTauri()) await this.invoke('minimize_window');
    } catch (e) {}
  }

  async toggleMaximize() {
    try {
      if (this.isTauri() && window.__TAURI__.window?.getCurrentWindow) {
        await window.__TAURI__.window.getCurrentWindow().toggleMaximize();
        return;
      }
    } catch (e) {}

    try {
      if (this.isTauri()) { await this.invoke('toggle_maximize_window'); return; }
    } catch (e) {}

    // Fallback for standalone browser/preview
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        try { await document.documentElement.requestFullscreen(); } catch (e) {}
      }
    } else if (document.exitFullscreen) {
      try { await document.exitFullscreen(); } catch (e) {}
    }
  }

  async isFullscreen() {
    try {
      if (this.isTauri() && window.__TAURI__.window?.getCurrentWindow) {
        return await window.__TAURI__.window.getCurrentWindow().isFullscreen();
      }
      if (this.isTauri()) {
        return await this.invoke('is_window_fullscreen');
      }
    } catch (e) {}

    return Boolean(document.fullscreenElement);
  }

  async setFullscreen(fullscreen = true) {
    try {
      if (this.isTauri() && window.__TAURI__.window?.getCurrentWindow) {
        await window.__TAURI__.window.getCurrentWindow().setFullscreen(fullscreen);
        return;
      }
    } catch (e) {
      console.warn('[TauriBridge] getCurrentWindow().setFullscreen failed, trying native IPC', e);
    }

    try {
      if (this.isTauri()) {
        await this.invoke('set_fullscreen_window', { fullscreen });
        return;
      }
    } catch (e) {
      console.warn('[TauriBridge] invoke set_fullscreen_window failed', e);
    }

    if (fullscreen) {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        try { await document.documentElement.requestFullscreen(); } catch (e) {}
      }
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        try { await document.exitFullscreen(); } catch (e) {}
      }
    }
  }

  async isMaximized() {
    try {
      if (this.isTauri() && window.__TAURI__.window?.getCurrentWindow) {
        return await window.__TAURI__.window.getCurrentWindow().isMaximized();
      }
      if (this.isTauri()) {
        return await this.invoke('is_window_maximized');
      }
    } catch (e) {}

    return Boolean(document.fullscreenElement);
  }

  async maximizeBorderless() {
    try {
      if (this.isTauri() && window.__TAURI__.window?.getCurrentWindow) {
        const win = window.__TAURI__.window.getCurrentWindow();
        const isMax = await win.isMaximized();
        if (!isMax) {
          await win.maximize();
        }
        return;
      }
    } catch (e) {}

    try {
      if (this.isTauri()) {
        const isMax = await this.invoke('is_window_maximized');
        if (!isMax) {
          await this.invoke('toggle_maximize_window');
        }
      }
    } catch (e) {}
  }

  async unmaximize() {
    try {
      if (this.isTauri() && window.__TAURI__.window?.getCurrentWindow) {
        await window.__TAURI__.window.getCurrentWindow().unmaximize();
        return;
      }
    } catch (e) {}

    try {
      if (this.isTauri()) {
        await this.invoke('unmaximize_window');
        return;
      }
    } catch (e) {}

    if (document.fullscreenElement && document.exitFullscreen) {
      try { await document.exitFullscreen(); } catch (e) {}
    }
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
