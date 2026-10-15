/**
 * Bukaake Window Mode Manager
 * Coordinates Mode 1 (Regular App Mode, 500px aspect-ratio, centered, frosted glass)
 * and Mode 2 (Fullscreen Image Viewer, 60% dimmed transparent desktop, auto-hide chrome)
 */

import { tauriBridge } from './tauri-bridge.js';
import { windowBridge } from './window-bridge.js';
import { modeTransition } from './mode-transition.js';

export const MODE_REGULAR = 'mode-regular';
export const MODE_VIEWER = 'mode-viewer';

export class WindowModeManager {
  constructor(options = {}) {
    this.viewer = options.viewer || null;
    this.titlebar = options.titlebar || null;
    this.currentMode = MODE_REGULAR;
    this.onModeChange = options.onModeChange || null;
    this.lastAspectSize = null;
    this.isPendingPathLoad = false;
    this.isTransitioning = false;

    if (this.viewer) modeTransition.setViewer(this.viewer);
    this.init();
  }

  init() {
    document.body.classList.add(MODE_REGULAR);
    this.bindWindowEvents();
    if (tauriBridge.isTauri() && window.__TAURI__?.event?.listen) {
      window.__TAURI__.event.listen('bukaake-toggle-mode', () => {
        if (this.viewer?.img && !this.isTransitioning && !modeTransition.isTransitioning) {
          this.toggleMode();
        }
      });
      window.__TAURI__.event.listen('settings-changed', async (e) => {
        if (e.payload?.mode2Style && this.currentMode === MODE_VIEWER) {
          if (e.payload.mode2Style === 'fullscreen') {
            await windowBridge.setAlwaysOnTop(true);
            await tauriBridge.setFullscreen(true);
          } else {
            await windowBridge.commitViewer('maximized', true);
          }
        }
      });
    }
  }

  bindWindowEvents() {
    let resizeTimer = null;
    const checkState = async () => {
      if (this.isTransitioning || modeTransition.isTransitioning || this.isPendingPathLoad) return;
      if (document.body.classList.contains('mode-capturing') ||
          document.body.classList.contains('mode-recording-pill') ||
          document.querySelector('.screen-snipper-overlay:not(.hidden)')) {
        return;
      }
      const isFs = await tauriBridge.isFullscreen();
      const isMax = await tauriBridge.isMaximized();
      const hasImage = Boolean(this.viewer?.img);
      if (!hasImage && !this.isPendingPathLoad && (isFs || isMax)) {
        await tauriBridge.setFullscreen(false);
        await tauriBridge.unmaximize();
        if (this.currentMode !== MODE_REGULAR) {
          this.updateModeClasses(MODE_REGULAR);
        }
        return;
      }
      const isExpanded = Boolean(isFs || isMax || this.currentMode === MODE_VIEWER);
      const nextMode = isExpanded ? MODE_VIEWER : MODE_REGULAR;
      if (nextMode !== this.currentMode) {
        this.updateModeClasses(nextMode, isMax);
      } else {
        document.body.classList.toggle('window-maximized', isMax);
      }
    };
    window.addEventListener('resize', () => {
      if (this.isTransitioning || modeTransition.isTransitioning) return;
      if (resizeTimer) cancelAnimationFrame(resizeTimer);
      resizeTimer = requestAnimationFrame(checkState);
    });
    document.addEventListener('fullscreenchange', checkState);
  }

  calculateAspectDimensions(imgWidth, imgHeight, maxDim = 820) {
    const minW = 680;
    const minH = 480;

    if (!imgWidth || !imgHeight) {
      return { width: minW, height: minH };
    }

    const ar = imgWidth / imgHeight;
    let targetW = maxDim;
    let targetH = maxDim;

    if (ar >= 1) {
      // Landscape
      targetW = Math.max(minW, Math.min(maxDim, Math.round(maxDim)));
      targetH = Math.max(minH, Math.round(targetW / ar));
    } else {
      // Portrait
      targetH = Math.max(minH, Math.min(maxDim, Math.round(maxDim)));
      targetW = Math.max(minW, Math.round(targetH * ar));
    }

    // Add 42px for docked titlebar in regular mode
    return { width: Math.max(minW, targetW), height: Math.max(minH, targetH) + 42 };
  }

  async applyImageAspectSize(imgWidth, imgHeight, maxDim = 820) {
    const isFs = await tauriBridge.isFullscreen();
    const isMax = await tauriBridge.isMaximized();
    const isExpanded = isFs || isMax;
    const dims = this.calculateAspectDimensions(imgWidth, imgHeight, maxDim);
    this.lastAspectSize = dims;

    if (!isExpanded) {
      this.updateModeClasses(MODE_REGULAR, false);
      await tauriBridge.resizeAndCenter(dims.width, dims.height);
      setTimeout(() => {
        this.viewer?.fitToScreen(true);
      }, 60);
    }
  }

  updateModeClasses(mode) {
    this.currentMode = mode;
    const isDark = !document.body.classList.contains('light-theme');
    const isViewer = (mode === MODE_VIEWER);
    const btnBg = document.getElementById('btnBgMode');
    if (btnBg) btnBg.disabled = isViewer;

    if (isViewer) {
      document.body.classList.remove(MODE_REGULAR);
      document.body.classList.add(MODE_VIEWER);
      tauriBridge.setWindowVibrancy(isDark, true);
    } else {
      document.body.classList.remove(MODE_VIEWER);
      document.body.classList.remove('window-maximized');
      document.body.classList.add(MODE_REGULAR);
      tauriBridge.setWindowVibrancy(isDark, false);
    }
    this.onModeChange?.(mode);
  }

  getMode2Style() {
    return localStorage.getItem('bukaake-mode2-style') || 'maximized';
  }

  async setMode(newMode, force = false) {
    if (this.isTransitioning || modeTransition.isTransitioning) return;
    if (newMode === MODE_VIEWER) {
      if (!this.viewer?.img && !force) return;
      modeTransition.setViewer(this.viewer);
      const style = this.getMode2Style();
      await modeTransition.enterViewer({
        style,
        updateClasses: () => this.updateModeClasses(MODE_VIEWER),
      });
    } else {
      modeTransition.setViewer(this.viewer);
      const isDark = !document.body.classList.contains('light-theme');
      const dims = this.lastAspectSize || { width: 680, height: 480 };
      await modeTransition.exitViewer({
        dims,
        isDark,
        updateClasses: () => this.updateModeClasses(MODE_REGULAR),
      });
    }
  }

  async toggleMode() {
    if (this.isTransitioning || modeTransition.isTransitioning) return;
    const isFs = await tauriBridge.isFullscreen();
    const isMax = await tauriBridge.isMaximized();
    if (isFs || isMax || this.currentMode === MODE_VIEWER) {
      await this.setMode(MODE_REGULAR);
    } else {
      if (!this.viewer?.img) return;
      await this.setMode(MODE_VIEWER);
    }
  }

  bindEdgeResizers(container = document) {
    const resizers = container.querySelectorAll('.resize-handle');
    resizers.forEach((handle) => {
      handle.addEventListener('mousedown', async (e) => {
        if (this.currentMode === MODE_VIEWER || !this.viewer?.img) return;
        e.preventDefault();
        const dir = handle.dataset.direction;
        if (dir) {
          await tauriBridge.startResizeDragging(dir);
        }
      });
    });
  }
}
