/**
 * Bukaake Settings Capture & Alitken Section Controller
 * Encapsulates hotkey binding, storage folder selection, and Alitken tandem wiring (< 110 lines)
 */

import { invoke } from '@tauri-apps/api/core';
import { hotkeyService } from '../services/hotkey-service.js';
import { alitkenService } from '../services/alitken-service.js';

export function bindCaptureSettings() {
  // 1. Hotkeys Binding
  const btnSS = document.getElementById('btnKeyScreenshot');
  const lblSS = document.getElementById('lblKeyScreenshot');
  const btnRec = document.getElementById('btnKeyRecord');
  const lblRec = document.getElementById('lblKeyRecord');

  if (lblSS) lblSS.textContent = hotkeyService.getScreenshotHotkey();
  if (lblRec) lblRec.textContent = hotkeyService.getRecordHotkey();

  const setupRecorder = (btn, lbl, setter) => {
    if (!btn || !lbl) return;
    btn.addEventListener('click', () => {
      btn.classList.add('listening');
      lbl.textContent = 'Press keys...';

      const onKeyDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const combo = hotkeyService.parseEventToCombo(e);
        if (combo) {
          setter(combo);
          lbl.textContent = combo;
          btn.classList.remove('listening');
          window.removeEventListener('keydown', onKeyDown, true);
        } else if (e.key === 'Escape') {
          btn.classList.remove('listening');
          lbl.textContent = btn === btnSS ? hotkeyService.getScreenshotHotkey() : hotkeyService.getRecordHotkey();
          window.removeEventListener('keydown', onKeyDown, true);
        }
      };
      window.addEventListener('keydown', onKeyDown, true);
    });
  };

  setupRecorder(btnSS, lblSS, (combo) => hotkeyService.setScreenshotHotkey(combo));
  setupRecorder(btnRec, lblRec, (combo) => hotkeyService.setRecordHotkey(combo));

  const selCaptureMode = document.getElementById('selectDefaultCaptureMode');
  if (selCaptureMode) {
    selCaptureMode.value = localStorage.getItem('bukaake-capture-mode') || 'region';
    selCaptureMode.addEventListener('change', () => {
      localStorage.setItem('bukaake-capture-mode', selCaptureMode.value);
    });
  }

  // 2. Storage Directory & Prompt
  const inputDir = document.getElementById('inputVideoSaveDir');
  const btnBrowseDir = document.getElementById('btnBrowseVideoDir');
  const selQuality = document.getElementById('selectVideoQuality');
  const togglePrompt = document.getElementById('togglePromptSave');

  const updateDirDisplay = async () => {
    const custom = localStorage.getItem('bukaake-video-save-dir');
    if (inputDir) inputDir.value = custom || (await invoke('get_default_videos_dir'));
  };
  updateDirDisplay();

  btnBrowseDir?.addEventListener('click', async () => {
    const folder = await invoke('prompt_select_folder');
    if (folder) {
      localStorage.setItem('bukaake-video-save-dir', folder);
      if (inputDir) inputDir.value = folder;
    }
  });

  if (selQuality) {
    selQuality.value = localStorage.getItem('bukaake-video-quality') || 'high';
    selQuality.addEventListener('change', () => {
      localStorage.setItem('bukaake-video-quality', selQuality.value);
    });
  }

  if (togglePrompt) {
    togglePrompt.checked = localStorage.getItem('bukaake-video-prompt-save') === 'true';
    togglePrompt.addEventListener('change', () => {
      localStorage.setItem('bukaake-video-prompt-save', togglePrompt.checked ? 'true' : 'false');
    });
  }

  // 3. Alitken Tandem
  const inputAlitken = document.getElementById('inputAlitkenPath');
  const btnBrowseAlitken = document.getElementById('btnBrowseAlitken');
  const toggleAlitken = document.getElementById('toggleAlitkenAuto');

  if (inputAlitken) {
    inputAlitken.value = alitkenService.getCustomPath() || 'Auto-Detect (./AlitConverter.exe)';
  }

  btnBrowseAlitken?.addEventListener('click', async () => {
    const path = await alitkenService.pickCustomExecutable();
    if (path && inputAlitken) inputAlitken.value = path;
  });

  if (toggleAlitken) {
    toggleAlitken.checked = alitkenService.isAutoOpenEnabled();
    toggleAlitken.addEventListener('change', () => {
      alitkenService.setAutoOpen(toggleAlitken.checked);
    });
  }
}
