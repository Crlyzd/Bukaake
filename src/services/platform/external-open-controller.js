/**
 * Bukaake External Open Controller
 * Coordinates image loading from Windows Explorer (cold launch, standby tray, or running below other apps).
 * Decodes off-screen first, prevents empty window flashes, and orchestrates smooth entrance reveals (< 150 lines).
 */

import { tauriBridge } from './tauri-bridge.js';
import { windowBridge } from './window-bridge.js';
import { modeTransition } from './mode-transition.js';
import { MODE_VIEWER, MODE_REGULAR } from './window-mode-manager.js';

export class ExternalOpenController {
  constructor({ windowModeManager, fileLoader, loadingIndicator, dropZoneEl }) {
    this.windowModeManager = windowModeManager;
    this.fileLoader = fileLoader;
    this.loadingIndicator = loadingIndicator;
    this.dropZoneEl = dropZoneEl;
  }

  async openFromPath(path) {
    if (!path) return;
    const name = path.split(/[/\\]/).pop() || 'image';
    this.windowModeManager.isPendingPathLoad = true;

    let showLoadingTimer = setTimeout(() => {
      this.loadingIndicator?.show(`Loading ${name}...`);
    }, 150);

    try {
      const ctx = await tauriBridge.readImageContext(path);
      if (!ctx) {
        clearTimeout(showLoadingTimer);
        this.loadingIndicator?.hide();
        await windowBridge.reveal();
        return;
      }
      await this.openContext(ctx, { showLoadingTimer });
    } catch (err) {
      console.warn('[ExternalOpenController] openFromPath error:', err);
      clearTimeout(showLoadingTimer);
      this.loadingIndicator?.hide();
      await windowBridge.reveal();
    } finally {
      this.windowModeManager.isPendingPathLoad = false;
    }
  }

  async openContext(ctx, { isStartup = false, showLoadingTimer = null } = {}) {
    if (!ctx?.target_path) return;
    this.windowModeManager.isPendingPathLoad = true;

    try {
      const info = await windowBridge.info();
      const style = this.windowModeManager.getMode2Style();
      const isVisible = Boolean(info?.visible && !info?.minimized);
      const curMode = this.windowModeManager.currentMode;

      if (this.dropZoneEl) this.dropZoneEl.style.display = 'none';

      // 1. Decode off-screen or off-front before triggering layout transitions
      await this.fileLoader.loadFromTauriContext(ctx);

      if (showLoadingTimer) clearTimeout(showLoadingTimer);
      this.loadingIndicator?.hide();

      // 2. Orchestrate smooth reveal based on starting window state
      if (!isVisible) {
        // Cold start or woken from hidden tray:
        await modeTransition.revealExternal({
          style,
          updateClasses: () => this.windowModeManager.updateModeClasses(MODE_VIEWER),
        });
      } else if (curMode === MODE_REGULAR) {
        // Window already visible in Mode 1: morph into Mode 2
        await this.windowModeManager.setMode(MODE_VIEWER);
        await windowBridge.reveal();
      } else {
        // Window already in Mode 2: image already swapped off-thread, ensure foreground
        await windowBridge.reveal();
      }
    } catch (err) {
      console.warn('[ExternalOpenController] openContext error:', err);
      await windowBridge.reveal();
    } finally {
      if (showLoadingTimer) clearTimeout(showLoadingTimer);
      this.loadingIndicator?.hide();
      this.windowModeManager.isPendingPathLoad = false;
    }
  }
}
