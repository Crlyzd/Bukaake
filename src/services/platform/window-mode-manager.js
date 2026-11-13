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
    this.mode2Style = localStorage.getItem('bukaake-mode2-style') || 'maximized';
    this.isPendingPathLoad = false;
    this.isTransitioning = false;
    this.preEditSize = null;

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
        if (e.payload?.mode2Style) {
          const newStyle = e.payload.mode2Style;
          this.mode2Style = newStyle;
          try {
            localStorage.setItem('bukaake-mode2-style', newStyle);
          } catch (_) {}
          window.dispatchEvent(new CustomEvent('bukaake-mode2-style-changed', { detail: { mode2Style: newStyle } }));

          if (this.currentMode === MODE_VIEWER) {
            if (newStyle === 'fullscreen') {
              await windowBridge.setAlwaysOnTop(true);
              await tauriBridge.setFullscreen(true);
            } else {
              await windowBridge.setAlwaysOnTop(false);
              await tauriBridge.setFullscreen(false);
              await tauriBridge.maximizeBorderless();
            }
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
      const nextMode = (isFs || isMax) ? MODE_VIEWER : MODE_REGULAR;
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
    window.addEventListener('storage', (e) => {
      if (e.key === 'bukaake-mode2-style' && e.newValue) {
        this.mode2Style = e.newValue;
        window.dispatchEvent(new CustomEvent('bukaake-mode2-style-changed', { detail: { mode2Style: e.newValue } }));
      }
    });
  }

  calculateAspectDimensions(imgWidth, imgHeight, maxDim = 820) {
    const minW = 740;
    const minH = 520;

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
    return this.mode2Style || localStorage.getItem('bukaake-mode2-style') || 'maximized';
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
      const img = this.viewer?.img;
      const dims = img
        ? (this.lastAspectSize || this.calculateAspectDimensions(img.naturalWidth || img.width, img.naturalHeight || img.height, 820))
        : { width: 680, height: 480 };
      await modeTransition.exitViewer({
        dims,
        isDark,
        updateClasses: () => this.updateModeClasses(MODE_REGULAR),
      });
    }
  }

  async setEditingWindowSize(isEditing) {
    if (this.currentMode === MODE_VIEWER || !this.viewer?.img) return;
    if (isEditing) {
      if (!this.preEditSize) {
        this.preEditSize = {
          width: window.innerWidth || this.lastAspectSize?.width || 740,
          height: window.innerHeight || this.lastAspectSize?.height || 520,
        };
      }
      const maxW = Math.max(740, (window.screen?.availWidth || 1280) - 40);
      const maxH = Math.max(520, (window.screen?.availHeight || 800) - 40);
      const targetW = Math.min(Math.max(this.preEditSize.width, 1280), maxW);
      const targetH = Math.min(Math.max(this.preEditSize.height, 720), maxH);
      if (targetW > (window.innerWidth || 0) || targetH > (window.innerHeight || 0)) {
        await tauriBridge.resizeAndCenter(targetW, targetH);
        setTimeout(() => { this.viewer?.fitToScreen(true); this.viewer?.onTransformChange?.(); }, 60);
      }
    } else if (this.preEditSize) {
      const restore = this.preEditSize;
      this.preEditSize = null;
      await tauriBridge.resizeAndCenter(restore.width, restore.height);
      setTimeout(() => { this.viewer?.fitToScreen(true); this.viewer?.onTransformChange?.(); }, 60);
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
