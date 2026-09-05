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
    window.addEventListener('resize', async () => {
      const isMax = await tauriBridge.isMaximized();
      const nextMode = isMax ? MODE_VIEWER : MODE_REGULAR;
      if (nextMode !== this.currentMode) {
        this.updateModeClasses(nextMode);
      }
    });
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
    const isMax = await tauriBridge.isMaximized();
    const dims = this.calculateAspectDimensions(imgWidth, imgHeight, maxDim);
    this.lastAspectSize = dims;

    if (!isMax) {
      this.updateModeClasses(MODE_REGULAR);
      await tauriBridge.resizeAndCenter(dims.width, dims.height);
      setTimeout(() => {
        this.viewer?.fitToScreen(true);
      }, 60);
    }
  }

  updateModeClasses(mode) {
    this.currentMode = mode;
    if (mode === MODE_VIEWER) {
      document.body.classList.remove(MODE_REGULAR);
      document.body.classList.add(MODE_VIEWER);
    } else {
      document.body.classList.remove(MODE_VIEWER);
      document.body.classList.add(MODE_REGULAR);
    }
    this.onModeChange?.(mode);
  }

  async setMode(newMode) {
    if (newMode === MODE_VIEWER) {
      this.updateModeClasses(MODE_VIEWER);
      await tauriBridge.maximizeBorderless();
    } else {
      this.updateModeClasses(MODE_REGULAR);
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
    const isMax = await tauriBridge.isMaximized();
    if (isMax || this.currentMode === MODE_VIEWER) {
      await this.setMode(MODE_REGULAR);
    } else {
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
