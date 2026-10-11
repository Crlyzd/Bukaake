/**
 * Bukaake Updater Launch Gate
 * Defers background launch update checks until the window is woken from standby (< 35 lines)
 */

import { tauriBridge } from './tauri-bridge.js';

export async function gateLaunchCheck(onTrigger) {
  if (typeof window === 'undefined') return;

  try {
    const args = await tauriBridge.invoke('get_cli_args');
    const isStartup = Array.isArray(args) && args.some((a) => a === '--startup' || a === '--minimized' || a === '--background');
    if (isStartup) {
      // Defer check until user actually wakes the window from tray
      window.__TAURI__?.event?.once('bukaake://wake-from-standby', () => {
        setTimeout(() => onTrigger?.(), 1500);
      });
      return;
    }
  } catch (_) {}

  // Normal launch
  onTrigger?.();
}
