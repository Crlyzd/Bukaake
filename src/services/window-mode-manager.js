/**
 * Bukaake Window Mode Manager
 * Coordinates Mode 1 (Regular App Mode, 500px aspect-ratio, centered, frosted glass)
 * and Mode 2 (Fullscreen Image Viewer, 60% dimmed transparent desktop, auto-hide chrome)
 */

import { tauriBridge } from './tauri-bridge.js';

export const MODE_REGULAR = 'mode-regular';
export const MODE_VIEWER = 'mode-viewer';

export class WindowModeManager {
  constructor(options = {}) {
    this.viewer = options.viewer || null;
    this.titlebar = options.titlebar || null;
    this.currentMode = MODE_REGULAR;
    this.onModeChange = options.onModeChange || null;
    this.lastAspectSize = null;

    this.init();
  }

  init() {
    document.body.classList.add(MODE_REGULAR);
    this.bindWindowEvents();
  }

  bindWindowEvents() {
    const checkState = async () => {
      if (document.body.classList.contains('mode-capturing') ||
          document.body.classList.contains('mode-recording-pill') ||
          document.querySelector('.screen-snipper-overlay:not(.hidden)')) {
        return;
      }
      const isFs = await tauriBridge.isFullscreen();
      const isMax = await tauriBridge.isMaximized();
      const hasImage = Boolean(this.viewer?.img);
      if (!hasImage && (isFs || isMax)) {
        await tauriBridge.setFullscreen(false);
        await tauriBridge.unmaximize();
        if (this.currentMode !== MODE_REGULAR) {
          this.updateModeClasses(MODE_REGULAR);
        }
        return;
      }
      const nextMode = (isFs || isMax) ? MODE_VIEWER : MODE_REGULAR;
      if (nextMode !== this.currentMode) {
        this.updateModeClasses(nextMode);
      }
    };
    window.addEventListener('resize', checkState);
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
      this.updateModeClasses(MODE_REGULAR);
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
      document.body.classList.add(MODE_REGULAR);
      tauriBridge.setWindowVibrancy(isDark, false);
    }
    this.onModeChange?.(mode);
  }

  async setMode(newMode) {
    if (newMode === MODE_VIEWER) {
      if (!this.viewer?.img) return;
      this.updateModeClasses(MODE_VIEWER);
      await tauriBridge.setFullscreen(true);
    } else {
      this.updateModeClasses(MODE_REGULAR);
      await tauriBridge.setFullscreen(false);
      await tauriBridge.unmaximize();
      if (this.lastAspectSize) {
        await tauriBridge.resizeAndCenter(this.lastAspectSize.width, this.lastAspectSize.height);
      }
    }
    setTimeout(() => {
      this.viewer?.fitToScreen();
    }, 80);
  }

  async toggleMode() {
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
        if (this.currentMode === MODE_VIEWER) return;
        e.preventDefault();
        const dir = handle.dataset.direction;
        if (dir) {
          await tauriBridge.startResizeDragging(dir);
        }
      });
    });
  }
}
