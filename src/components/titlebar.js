/**
 * Bukaake Titlebar Component
 * Manages draggable titlebar, window actions (Min, Max, Close), theme switcher, and inline breadcrumbs
 */

import { tauriBridge } from '../services/tauri-bridge.js';
import { themeManager } from '../services/theme-manager.js';

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

    this.onOpenFile = options.onOpenFile || null;
    this.onPasteClipboard = options.onPasteClipboard || null;
    this.onToggleMetadata = options.onToggleMetadata || null;
    this.onToggleSettings = options.onToggleSettings || null;
    this.onToggleHelp = options.onToggleHelp || null;
    this.onToggleMode = options.onToggleMode || null;

    this.init();
  }

  init() {
    this.bindWindowControls();
    this.bindActionButtons();
    this.syncMaximizedState();

    if (this.btnTheme) {
      themeManager.bindToggleBtn(this.btnTheme);
    }
  }

  bindWindowControls() {
    this.btnMin?.addEventListener('click', async () => {
      await tauriBridge.minimizeWindow();
    });

    this.btnMax?.addEventListener('click', async () => {
      await this.handleToggleMaximize();
    });

    this.btnClose?.addEventListener('click', async () => {
      await tauriBridge.closeWindow();
    });

    if (this.container) {
      this.container.addEventListener('dblclick', (e) => {
        if (e.target.closest('.titlebar-right') || e.target.closest('button')) {
          return;
        }
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

    document.getElementById('btnToggleInfo')?.addEventListener('click', () => {
      this.onToggleMetadata?.();
    });

    document.getElementById('btnSettings')?.addEventListener('click', () => {
      this.onToggleSettings?.();
    });

    document.getElementById('btnHelp')?.addEventListener('click', () => {
      this.onToggleHelp?.();
    });
  }

  async handleToggleMaximize() {
    if (this.onToggleMode) {
      await this.onToggleMode();
    } else {
      await tauriBridge.toggleMaximize();
    }
    setTimeout(() => this.syncMaximizedState(), 80);
  }

  async syncMaximizedState(forceState = null) {
    const isMax = forceState !== null ? forceState : await tauriBridge.isMaximized();
    document.body.classList.toggle('window-maximized', isMax);

    if (this.btnMax) {
      const icon = this.btnMax.querySelector('i');
      if (icon) {
        icon.className = isMax ? 'ri-checkbox-multiple-blank-line' : 'ri-checkbox-blank-line';
      }
      this.btnMax.title = isMax ? 'Restore Window' : 'Maximize / Fullscreen (F11)';
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
}
