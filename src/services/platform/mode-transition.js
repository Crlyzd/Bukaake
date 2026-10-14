/**
 * Bukaake Mode Transition Orchestrator
 * Coordinates DWM cloaking, atomic geometry commits, and FLIP image morphing
 * for silky-smooth Mode 1 <-> Mode 2 transitions and Explorer reveals (< 220 lines).
 */

import { windowBridge } from './window-bridge.js';
import {
  captureClientRect,
  applyClientRect,
  computeFitState,
  applyEntrance,
  regularFitScreenRect,
  animateTo,
} from '../../core/canvas/canvas-flip.js';

export class ModeTransition {
  constructor(options = {}) {
    this.viewer = options.viewer || null;
    this.isTransitioning = false;
  }

  setViewer(viewer) {
    this.viewer = viewer;
  }

  /**
   * Waits for canvas / container to adjust dimensions following geometry change
   */
  async waitForCanvasResize(targetRect = null, timeoutMs = 220) {
    if (!this.viewer?.container) return;
    const initialW = this.viewer.canvas.width;
    const initialH = this.viewer.canvas.height;
    const targetW = targetRect?.width;
    const targetH = targetRect?.height;

    if (targetW && targetH &&
        Math.abs(this.viewer.container.clientWidth - targetW) <= 24 &&
        Math.abs(this.viewer.container.clientHeight - targetH) <= 24) {
      this.viewer.resizeCanvas();
      return;
    }

    await new Promise((resolve) => {
      let timer = null;
      let ro = null;

      const done = () => {
        if (timer) clearTimeout(timer);
        if (ro) ro.disconnect();
        resolve();
      };

      timer = setTimeout(done, timeoutMs);

      const checkMatch = () => {
        const cw = this.viewer.container.clientWidth;
        const ch = this.viewer.container.clientHeight;
        if (targetW && targetH) {
          if (Math.abs(cw - targetW) <= 24 && Math.abs(ch - targetH) <= 24) {
            this.viewer.resizeCanvas();
            done();
          }
        } else if (Math.abs(cw - initialW) > 50 || Math.abs(ch - initialH) > 50) {
          this.viewer.resizeCanvas();
          done();
        }
      };

      if (window.ResizeObserver) {
        ro = new ResizeObserver(checkMatch);
        ro.observe(this.viewer.container);
      } else {
        requestAnimationFrame(() => {
          this.viewer.resizeCanvas();
          done();
        });
      }
    });
  }

  /**
   * Mode 1 -> Mode 2 FLIP Morph:
   * 1. Capture image client rect in Mode 1
   * 2. Cloak window + commit viewer geometry (maximize/fullscreen + acrylic cleared)
   * 3. Swap DOM classes to mode-viewer
   * 4. Await canvas resize & pin image to its exact pre-transition client rect
   * 5. Uncloak window (zero flash, image looks unchanged)
   * 6. Animate image from pinned rect to 75% fit target while backdrop dim fades in
   */
  async enterViewer({ style = 'maximized', updateClasses }) {
    if (this.isTransitioning || !this.viewer?.img) return;
    this.isTransitioning = true;

    const safetyTimer = setTimeout(() => {
      windowBridge.cloak(false);
      this.cleanup();
    }, 600);

    try {
      const prevRect = captureClientRect(this.viewer);

      document.body.classList.add('mode-transitioning', 'mode-snap');
      const targetRect = await windowBridge.commitViewer(style, false);

      updateClasses?.();
      await this.waitForCanvasResize(targetRect);

      if (prevRect) {
        applyClientRect(this.viewer, prevRect);
      }

      document.body.classList.remove('mode-snap');
      document.body.classList.add('mode-dim-off');

      await windowBridge.cloak(false);

      requestAnimationFrame(() => {
        document.body.classList.remove('mode-dim-off');
      });

      const fit = computeFitState(this.viewer);
      await animateTo(this.viewer, fit, 260);
    } catch (err) {
      console.warn('[ModeTransition] enterViewer error:', err);
    } finally {
      clearTimeout(safetyTimer);
      await windowBridge.cloak(false);
      this.cleanup();
    }
  }

  /**
   * Mode 2 -> Mode 1 Reverse FLIP Morph:
   * 1. Calculate target Mode 1 rect & screen-space image destination
   * 2. Animate image toward Mode 1 destination while backdrop dim fades out (220ms)
   * 3. Cloak window + commit regular geometry (single SetWindowPos + acrylic)
   * 4. Swap DOM classes to mode-regular & snap viewer to standard fit
   * 5. Uncloak window cleanly in regular mode
   */
  async exitViewer({ dims, isDark, updateClasses }) {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    const safetyTimer = setTimeout(() => {
      windowBridge.cloak(false);
      this.cleanup();
    }, 600);

    try {
      if (this.viewer?.img && dims) {
        const targetWinRect = await windowBridge.regularTarget(dims.width, dims.height);
        if (targetWinRect) {
          const targetImageScreen = regularFitScreenRect(this.viewer, targetWinRect);
          const r = this.viewer.canvas.getBoundingClientRect();
          const targetInViewer = {
            scale: targetImageScreen.scale,
            panX: targetImageScreen.x - (window.screenX || 0) - r.left,
            panY: targetImageScreen.y - (window.screenY || 0) - r.top,
          };

          document.body.classList.add('mode-dim-off', 'mode-transitioning');
          await animateTo(this.viewer, targetInViewer, 220);
        }
      }

      document.body.classList.add('mode-snap');
      await windowBridge.commitRegular(dims.width, dims.height, isDark);

      updateClasses?.();
      this.viewer?.resizeCanvas();
      this.viewer?.fitToScreen(true);

      // Double-rAF presentation buffer ensures WebView2 presents Mode 1 canvas frame before uncloak
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      document.body.classList.remove('mode-snap');
      await windowBridge.cloak(false);
    } catch (err) {
      console.warn('[ModeTransition] exitViewer error:', err);
    } finally {
      clearTimeout(safetyTimer);
      await windowBridge.cloak(false);
      this.cleanup();
    }
  }

  /**
   * Picasa-style smooth dissolve exit into wallpaper on Esc / close.
   * Fades out canvas and desktop dim over 180ms, then invokes onComplete (e.g. enterStandby).
   */
  async dismissViewer({ onComplete } = {}) {
    if (this.isTransitioning) {
      onComplete?.();
      return;
    }
    this.isTransitioning = true;

    try {
      document.body.classList.add('mode-dismissing');
      await new Promise((r) => setTimeout(r, 180));
      onComplete?.();
    } catch (err) {
      console.warn('[ModeTransition] dismissViewer error:', err);
      onComplete?.();
    } finally {
      document.body.classList.remove('mode-dismissing');
      this.isTransitioning = false;
    }
  }

  /**
   * External Open Reveal Entrance (Cold Launch, Standby, or Background):
   * Stages decoded image into Mode 2 off-screen, reveals window via force_foreground,
   * uncloaks, and runs a gentle scale+fade entrance.
   */
  async revealExternal({ style = 'maximized', updateClasses }) {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    const safetyTimer = setTimeout(() => {
      windowBridge.reveal();
      this.cleanup();
    }, 700);

    try {
      document.body.classList.add('mode-transitioning', 'mode-snap', 'mode-entrance');

      const targetRect = await windowBridge.commitViewer(style, true);
      updateClasses?.();
      await this.waitForCanvasResize(targetRect);

      const fit = computeFitState(this.viewer);
      applyEntrance(this.viewer, fit, 0.94);

      document.body.classList.remove('mode-snap');
      await windowBridge.cloak(false);

      requestAnimationFrame(() => {
        document.body.classList.remove('mode-entrance');
      });

      await animateTo(this.viewer, fit, 260);
    } catch (err) {
      console.warn('[ModeTransition] revealExternal error:', err);
    } finally {
      clearTimeout(safetyTimer);
      await windowBridge.reveal();
      this.cleanup();
    }
  }

  cleanup() {
    this.isTransitioning = false;
    document.body.classList.remove(
      'mode-transitioning',
      'mode-snap',
      'mode-dim-off',
      'mode-entrance'
    );
  }
}

export const modeTransition = new ModeTransition();
