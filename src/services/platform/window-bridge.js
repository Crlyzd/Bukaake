/**
 * Bukaake Window Transition Bridge
 * Thin IPC wrappers for native DWM cloaking and atomic geometry commits (< 60 lines)
 */

import { tauriBridge } from './tauri-bridge.js';

const call = async (cmd, args = {}, fallback = null) => {
  if (!tauriBridge.isTauri()) return fallback;
  try {
    return await tauriBridge.invoke(cmd, args);
  } catch (err) {
    console.warn(`[WindowBridge] ${cmd} failed:`, err);
    return fallback;
  }
};

export const windowBridge = {
  /** Hide/show from DWM composition without touching visibility, focus or z-order */
  cloak: (cloak) => call('cloak_main_window', { cloak }),

  /** { visible, minimized, rect: { x, y, width, height } } in logical px */
  info: () => call('get_main_window_info', {}, { visible: true, minimized: false, rect: null }),

  /** Logical rect a Mode 1 window of this size will occupy, centered on the current monitor */
  regularTarget: (width, height) => call('get_regular_target_rect', { width, height }),

  /** Cloaked maximize/fullscreen + acrylic clear; `reveal` also shows and forces foreground */
  commitViewer: (style, reveal = false) => call('commit_viewer_geometry', { style, reveal }),

  /** Cloaked unmaximize + single SetWindowPos + theme acrylic */
  commitRegular: (width, height, isDark) => call('commit_regular_geometry', { width, height, isDark }),

  /** Show + foreground + uncloak (also the safety net for a stuck cloak) */
  reveal: () => call('reveal_main_window'),

  /** Dynamic always_on_top sync (e.g. settings change) */
  setAlwaysOnTop: (alwaysOnTop) => call('set_main_always_on_top', { alwaysOnTop }),
};
