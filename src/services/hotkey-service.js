/**
 * Bukaake Custom Hotkey Service
 * Manages customizable capture shortcuts, key combination recording, and event dispatch (< 120 lines)
 */

export class HotkeyService {
  constructor() {
    this.DEFAULT_SCREENSHOT = 'Ctrl+Alt+S';
    this.DEFAULT_RECORD = 'Ctrl+Alt+R';

    this.STORAGE_KEY_SCREENSHOT = 'bukaake-hotkey-screenshot';
    this.STORAGE_KEY_RECORD = 'bukaake-hotkey-record';
  }

  getScreenshotHotkey() {
    return localStorage.getItem(this.STORAGE_KEY_SCREENSHOT) || this.DEFAULT_SCREENSHOT;
  }

  setScreenshotHotkey(combo) {
    if (combo) localStorage.setItem(this.STORAGE_KEY_SCREENSHOT, combo);
    else localStorage.removeItem(this.STORAGE_KEY_SCREENSHOT);
  }

  getRecordHotkey() {
    return localStorage.getItem(this.STORAGE_KEY_RECORD) || this.DEFAULT_RECORD;
  }

  setRecordHotkey(combo) {
    if (combo) localStorage.setItem(this.STORAGE_KEY_RECORD, combo);
    else localStorage.removeItem(this.STORAGE_KEY_RECORD);
  }

  resetDefaults() {
    localStorage.removeItem(this.STORAGE_KEY_SCREENSHOT);
    localStorage.removeItem(this.STORAGE_KEY_RECORD);
  }

  /**
   * Normalizes a KeyboardEvent into a standard combo string (e.g. "Ctrl+Alt+S")
   * @param {KeyboardEvent} e 
   * @returns {string|null}
   */
  parseEventToCombo(e) {
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return null;

    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');

    let keyName = e.key;
    if (keyName === ' ') keyName = 'Space';
    else if (keyName === 'PrintScreen') keyName = 'PrtScn';
    else if (keyName.length === 1) keyName = keyName.toUpperCase();

    parts.push(keyName);
    return parts.join('+');
  }

  /**
   * Checks if a KeyboardEvent matches a specified combo string
   * @param {KeyboardEvent} e 
   * @param {string} comboStr 
   * @returns {boolean}
   */
  matches(e, comboStr) {
    if (!comboStr) return false;
    const parsed = this.parseEventToCombo(e);
    if (!parsed) return false;
    return parsed.toLowerCase() === comboStr.toLowerCase();
  }

  isScreenshotTrigger(e) {
    if (e.key === 'PrintScreen') return true;
    return this.matches(e, this.getScreenshotHotkey());
  }

  isRecordTrigger(e) {
    return this.matches(e, this.getRecordHotkey());
  }
}

export const hotkeyService = new HotkeyService();
