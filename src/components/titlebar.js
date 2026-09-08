/**
 * Bukaake Titlebar Component
 * Manages draggable titlebar, window actions (Min, Max, Close), theme switcher, and inline breadcrumbs
 */

import { tauriBridge } from '../services/tauri-bridge.js';
import { themeManager } from '../services/theme-manager.js';
import { updaterService, hydrateAppVersions } from '../services/updater-service.js';

export class Titlebar {
  constructor(options = {}) {
    this.container = document.getElementById('appTitlebar');
    this.fileNameBadge = document.getElementById('fileNameBadge');
    this.titlebarSep = document.getElementById('titlebarSep');
    this.dimensionsBadge = document.getElementById('titlebarDimensions');
    this.btnMin = document.getElementById('winMin');
    this.btnMax = document.getElementById('winMax');
    this.btnClose = document.getElementById('winClose');
    this.btnTheme = document.getElementById('btnThemeToggle');
    this.btnInfo = document.getElementById('btnToggleInfo');
    this.btnSettings = document.getElementById('btnSettings');

    this.onOpenFile = options.onOpenFile || null;
    this.onPasteClipboard = options.onPasteClipboard || null;
    this.onToggleMetadata = options.onToggleMetadata || null;
    this.onToggleSettings = options.onToggleSettings || null;
    this.onToggleHelp = options.onToggleHelp || null;
    this.onToggleMode = options.onToggleMode || null;
    this.onClose = options.onClose || null;
    this.hasImage = false;

    this.init();
  }

  init() {
    hydrateAppVersions(this.container || document);
    this.bindWindowControls();
    this.bindActionButtons();
    this.syncMaximizedState();
    this.setHasImage(false);
    this.initUpdateListeners();

    if (this.btnTheme) {
      themeManager.bindToggleBtn(this.btnTheme);
    }
  }

  bindWindowControls() {
    this.btnMin?.addEventListener('click', async () => {
      await tauriBridge.minimizeWindow();
    });

    this.btnMax?.addEventListener('click', async () => {
      if (!this.hasImage) return;
      await this.handleToggleMaximize();
    });

    this.btnClose?.addEventListener('click', async () => {
      if (this.onClose) {
        this.onClose();
      } else {
        await tauriBridge.closeWindow();
      }
    });

    if (this.container) {
      let pendingDrag = false;
      let startX = 0;
      let startY = 0;

      this.container.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (e.target.closest('.titlebar-right') || e.target.closest('button')) return;
        startX = e.screenX;
        startY = e.screenY;
        pendingDrag = true;
      });

      window.addEventListener('mousemove', (e) => {
        if (!pendingDrag || e.buttons !== 1) { pendingDrag = false; return; }
        if (Math.hypot(e.screenX - startX, e.screenY - startY) >= 4) {
          pendingDrag = false;
          if (tauriBridge.isTauri()) {
            window.__TAURI__.window?.getCurrentWindow?.()?.startDragging?.().catch(() => {});
          }
        }
      });

      window.addEventListener('mouseup', () => { pendingDrag = false; });

      this.container.addEventListener('dblclick', (e) => {
        if (e.target.closest('.titlebar-right') || e.target.closest('button')) return;
        if (!this.hasImage) return;
        this.handleToggleMaximize();
      });
    }

    window.addEventListener('resize', () => this.syncMaximizedState());
    document.addEventListener('fullscreenchange', () => this.syncMaximizedState());
  }

  bindActionButtons() {
    document.getElementById('btnOpenFile')?.addEventListener('click', () => {
      this.onOpenFile?.();
    });

    document.getElementById('btnClipboard')?.addEventListener('click', () => {
      this.onPasteClipboard?.();
    });

    this.btnInfo?.addEventListener('click', () => {
      if (this.btnInfo.disabled) return;
      this.onToggleMetadata?.();
    });

    document.getElementById('btnSettings')?.addEventListener('click', () => {
      updaterService.onSettingsClick();
      this.onToggleSettings?.();
    });

    document.getElementById('btnHelp')?.addEventListener('click', () => {
      this.onToggleHelp?.();
    });
  }

  async handleToggleMaximize() {
    if (!this.hasImage) return;
    if (this.onToggleMode) {
      await this.onToggleMode();
    } else {
      await tauriBridge.toggleMaximize();
    }
    setTimeout(() => this.syncMaximizedState(), 80);
  }

  async syncMaximizedState(forceState = null) {
    let isExpanded = forceState;
    if (isExpanded === null) {
      const isFs = await tauriBridge.isFullscreen();
      const isMax = await tauriBridge.isMaximized();
      isExpanded = Boolean(isFs || isMax);
    }
    document.body.classList.toggle('window-maximized', isExpanded);

    if (this.btnMax) {
      const icon = this.btnMax.querySelector('i');
      if (icon) {
        icon.className = isExpanded ? 'ri-checkbox-multiple-blank-line' : 'ri-checkbox-blank-line';
      }
      this.btnMax.title = !this.hasImage
        ? 'Fullscreen Viewer (Load an image first)'
        : (isExpanded ? 'Restore Window' : 'Fullscreen Viewer (F11)');
    }
  }

  setFileName(name) {
    const hasName = Boolean(name);
    if (this.titlebarSep) {
      this.titlebarSep.classList.toggle('hidden', !hasName);
    }
    if (this.fileNameBadge) {
      this.fileNameBadge.textContent = name || '';
      this.fileNameBadge.classList.toggle('hidden', !hasName);
    }
    if (!hasName && this.dimensionsBadge) {
      this.dimensionsBadge.classList.add('hidden');
    }
  }

  setDimensions(width, height, zoomPercent) {
    if (this.dimensionsBadge) {
      if (width && height) {
        this.dimensionsBadge.textContent = `• ${width} × ${height} (${Math.round(zoomPercent)}%)`;
        this.dimensionsBadge.classList.remove('hidden');
      } else {
        this.dimensionsBadge.textContent = '';
        this.dimensionsBadge.classList.add('hidden');
      }
    }
  }

  setHasImage(hasImage) {
    this.hasImage = Boolean(hasImage);
    if (this.btnInfo) {
      this.btnInfo.disabled = !this.hasImage;
      this.btnInfo.title = this.hasImage ? 'Toggle Image Properties (I)' : 'Image Properties (Load an image first)';
    }
    if (this.btnMax) {
      this.btnMax.disabled = !this.hasImage;
      this.btnMax.classList.toggle('disabled', !this.hasImage);
      this.btnMax.title = this.hasImage
        ? (document.body.classList.contains('window-maximized') ? 'Restore Window' : 'Fullscreen Viewer (F11)')
        : 'Fullscreen Viewer (Load an image first)';
    }
    tauriBridge.setMaximizable(this.hasImage);
  }

  initUpdateListeners() {
    updaterService.subscribe((state) => {
      this.setUpdateBadge(Boolean(state.hasUpdate));
    });

    updaterService.initLaunchCheck();

    window.__toggleUpdateBadge = (enable = true) => {
      updaterService.setUpdateAvailable(enable);
    };
  }

  setUpdateBadge(hasUpdate = true) {
    if (!this.btnSettings) return;
    this.btnSettings.classList.toggle('has-update', hasUpdate);
    this.btnSettings.title = hasUpdate
      ? 'Settings & About (Update Available!)'
      : 'Settings & About';
  }
}
