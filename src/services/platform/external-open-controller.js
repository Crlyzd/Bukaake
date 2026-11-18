/**
 * Bukaake External Open Controller
 * Coordinates image loading from Windows Explorer (cold launch, standby tray, or running below other apps).
 * Stages Mode 2 while cloaked, reveals a 250ms dimmed backdrop + center glass pill for heavy decodes,
 * and orchestrates a unified 220ms Mode 2 entrance with zero Mode 1 flash (< 160 lines).
 */

import { tauriBridge } from './tauri-bridge.js';
import { windowBridge } from './window-bridge.js';
import { modeTransition } from './mode-transition.js';
import { MODE_VIEWER } from './window-mode-manager.js';

const HEAVY_DECODE_DELAY_MS = 250;

export class ExternalOpenController {
  constructor({ windowModeManager, fileLoader, loadingIndicator, dropZoneEl }) {
    this.windowModeManager = windowModeManager;
    this.fileLoader = fileLoader;
    this.loadingIndicator = loadingIndicator;
    this.dropZoneEl = dropZoneEl;
  }

  /**
   * Immediately cloaks the window and pre-stages Mode 2 DOM classes before any I/O or decode
   * so WebView2 never paints a Mode 1 titlebar, Light Mode milky panel wash, or Mode 1 fit.
   */
  async prepareCloakedMode2(style) {
    this.windowModeManager.isPendingPathLoad = true;
    await windowBridge.cloak(true);
    if (this.dropZoneEl) this.dropZoneEl.style.display = 'none';
    document.body.classList.add('mode-transitioning', 'mode-snap', 'mode-entrance');
    this.windowModeManager.updateModeClasses(MODE_VIEWER);
    document.body.classList.toggle('window-maximized', style !== 'fullscreen');
    const viewer = this.windowModeManager.viewer;
    if (viewer?.ctx && viewer?.canvas) {
      viewer.ctx.clearRect(0, 0, viewer.canvas.width, viewer.canvas.height);
    }
  }

  /**
   * Starts a 250ms timer that reveals the dimmed Mode 2 fullscreen backdrop and centered
   * frosted glass loading pill if reading/decoding a heavy file (e.g. RAW/TIFF) takes >= 250ms.
   */
  startHeavyBackdropTimer(fileName, style) {
    const state = { timer: null, cancelled: false, revealedPromise: null, backdropRevealed: false };
    state.timer = setTimeout(() => {
      if (state.cancelled) return;
      state.revealedPromise = (async () => {
        try {
          const targetRect = await windowBridge.commitViewer(style, true);
          await modeTransition.waitForCanvasResize(targetRect);
          if (state.cancelled) return;
          this.loadingIndicator?.show(`Loading ${fileName}...`, 0);
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          if (state.cancelled) return;
          document.body.classList.remove('mode-snap');
          await windowBridge.cloak(false);
          state.backdropRevealed = true;
        } catch (err) {
          console.warn('[ExternalOpenController] Heavy backdrop reveal error:', err);
        }
      })();
    }, HEAVY_DECODE_DELAY_MS);
    return state;
  }

  async stopHeavyBackdropTimer(state) {
    if (!state) return false;
    state.cancelled = true;
    if (state.timer) clearTimeout(state.timer);
    if (state.revealedPromise) {
      await state.revealedPromise;
    }
    this.loadingIndicator?.hide();
    return state.backdropRevealed;
  }

  async openFromPath(path) {
    if (!path) return;
    const name = path.split(/[/\\]/).pop() || 'image';
    const style = this.windowModeManager.getMode2Style();
    await this.prepareCloakedMode2(style);
    const heavyState = this.startHeavyBackdropTimer(name, style);

    try {
      const ctx = await tauriBridge.readImageContext(path);
      if (!ctx) {
        await this.stopHeavyBackdropTimer(heavyState);
        modeTransition.cleanup();
        await windowBridge.reveal();
        return;
      }
      await this.openContext(ctx, { heavyState, preStaged: true });
    } catch (err) {
      console.warn('[ExternalOpenController] openFromPath error:', err);
      await this.stopHeavyBackdropTimer(heavyState);
      modeTransition.cleanup();
      await windowBridge.reveal();
    } finally {
      this.windowModeManager.isPendingPathLoad = false;
    }
  }

  async openContext(ctx, { heavyState = null, preStaged = false } = {}) {
    if (!ctx?.target_path) return;
    const style = this.windowModeManager.getMode2Style();
    const name = ctx.file_name || ctx.target_path.split(/[/\\]/).pop() || 'image';

    if (!preStaged) {
      await this.prepareCloakedMode2(style);
    }
    const activeHeavyState = heavyState || this.startHeavyBackdropTimer(name, style);

    try {
      // 1. Decode image into pre-staged Mode 2 DOM (with FileLoader's 80ms pill suppressed under 250ms)
      await this.fileLoader.loadFromTauriContext(ctx);
      const backdropAlreadyRevealed = await this.stopHeavyBackdropTimer(activeHeavyState);

      // 2. Unified smooth Mode 2 entrance across cold start, standby tray, Mode 1, and Mode 2 background
      await modeTransition.revealExternal({
        style,
        backdropAlreadyRevealed,
        updateClasses: () => {
          this.windowModeManager.updateModeClasses(MODE_VIEWER);
          document.body.classList.toggle('window-maximized', style !== 'fullscreen');
        },
      });
    } catch (err) {
      console.warn('[ExternalOpenController] openContext error:', err);
      await this.stopHeavyBackdropTimer(activeHeavyState);
      modeTransition.cleanup();
      await windowBridge.reveal();
    } finally {
      this.loadingIndicator?.hide();
      this.windowModeManager.isPendingPathLoad = false;
    }
  }
}
