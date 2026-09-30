/**
 * Bukaake Settings Capture & Alitken Section Controller
 * Encapsulates hotkey binding, storage folder selection, and Alitken tandem wiring (< 110 lines)
 */

import { invoke } from '@tauri-apps/api/core';
import { tauriBridge } from '../../services/tauri-bridge.js';
import { hotkeyService } from '../../services/hotkey-service.js';
import { bindTandemSettings } from './settings-tandem-section.js';
import { bindAudioSettings } from './settings-audio-section.js';

export function renderHotkeyBadge(container, combo) {
  if (!container) return;
  if (!combo || combo === 'Press keys...') {
    container.textContent = combo || '';
    return;
  }
  const parts = combo.split('+');
  container.innerHTML = parts
    .map((p) => `<span class="key-token">${p.trim()}</span>`)
    .join('<span class="key-sep">+</span>');
}

export function bindCaptureSettings() {
  // 1. Unified Hotkey Binding
  const btnCapture = document.getElementById('btnKeyCapture');
  const lblCapture = document.getElementById('lblKeyCapture');

  if (lblCapture) {
    renderHotkeyBadge(lblCapture, hotkeyService.getSharedHotkey());
    window.addEventListener('bukaake-hotkeys-changed', (e) => {
      if (e.detail?.screenshot) renderHotkeyBadge(lblCapture, e.detail.screenshot);
    });
  }

  let isListening = false;

  const cancelRecording = () => {
    if (!isListening) return;
    isListening = false;
    btnCapture?.classList.remove('listening');
    renderHotkeyBadge(lblCapture, hotkeyService.getSharedHotkey());
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('keyup', onKeyUp, true);
    window.removeEventListener('blur', onBlur);
    document.removeEventListener('click', onClickOutside, true);
  };

  const onKeyDown = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      cancelRecording();
      return;
    }

    const getMods = (evt) => {
      const m = [];
      if (evt.ctrlKey || evt.metaKey) m.push('Ctrl');
      if (evt.altKey) m.push('Alt');
      if (evt.shiftKey) m.push('Shift');
      return m;
    };
    const mods = getMods(e);

    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
      if (lblCapture) {
        lblCapture.textContent = mods.length > 0 ? `${mods.join('+')}+...` : 'Press keys...';
      }
      return;
    }

    let keyName = e.key;
    if (keyName === ' ') keyName = 'Space';
    else if (keyName === 'PrintScreen') keyName = 'PrtScn';
    else if (keyName.length === 1) keyName = keyName.toUpperCase();

    mods.push(keyName);
    const combo = mods.join('+');

    hotkeyService.setSharedHotkey(combo);
    renderHotkeyBadge(lblCapture, combo);

    isListening = false;
    btnCapture?.classList.remove('listening');
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('keyup', onKeyUp, true);
    window.removeEventListener('blur', onBlur);
    document.removeEventListener('click', onClickOutside, true);
  };

  const onKeyUp = (e) => {
    if (!isListening) return;
    e.preventDefault();
    e.stopPropagation();
    const mods = [];
    if (e.ctrlKey || e.metaKey) mods.push('Ctrl');
    if (e.altKey) mods.push('Alt');
    if (e.shiftKey) mods.push('Shift');
    if (lblCapture) {
      lblCapture.textContent = mods.length > 0 ? `${mods.join('+')}+...` : 'Press keys...';
    }
  };

  const onClickOutside = (e) => {
    if (!btnCapture?.contains(e.target)) {
      cancelRecording();
    }
  };

  const onBlur = () => {
    cancelRecording();
  };

  if (btnCapture && lblCapture) {
    btnCapture.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isListening) {
        cancelRecording();
        return;
      }
      btnCapture.blur();
      isListening = true;
      btnCapture.classList.add('listening');
      lblCapture.textContent = 'Press keys...';

      window.addEventListener('keydown', onKeyDown, true);
      window.addEventListener('keyup', onKeyUp, true);
      window.addEventListener('blur', onBlur);
      setTimeout(() => document.addEventListener('click', onClickOutside, true), 10);
    });
  }

  // 2. Custom Frosted Glass Video Quality Dropdown
  const wrapQuality = document.getElementById('wrapVideoQuality');
  const btnTrigger = document.getElementById('btnVideoQualityTrigger');
  const lblQuality = document.getElementById('lblVideoQuality');
  const menuQuality = document.getElementById('menuVideoQuality');
  const toggleSpaceSaver = document.getElementById('toggleSpaceSaver');

  const QUALITY_LABELS = {
    balanced: '60 FPS • Balanced (3 Mbps)',
    high: '60 FPS • High (6 Mbps)',
    ultra: '60 FPS • Ultra (12 Mbps)',
  };

  const SPACE_SAVER_LABELS = {
    balanced: '30 FPS • Balanced (750 Kbps)',
    high: '30 FPS • High (1.5 Mbps)',
    ultra: '30 FPS • Ultra (3 Mbps)',
  };

  const getActiveLabels = () => {
    const isSpaceSaver = localStorage.getItem('bukaake-space-saver') === 'true';
    return isSpaceSaver ? SPACE_SAVER_LABELS : QUALITY_LABELS;
  };

  const refreshQualityLabels = () => {
    const labels = getActiveLabels();
    const currentKey = localStorage.getItem('bukaake-video-quality') || 'high';
    if (lblQuality) lblQuality.textContent = labels[currentKey] || labels.high;
    menuQuality?.querySelectorAll('.glass-dropdown-item').forEach((item) => {
      const span = item.querySelector('span');
      if (span && labels[item.dataset.value]) {
        span.textContent = labels[item.dataset.value];
      }
      item.classList.toggle('active', item.dataset.value === currentKey);
    });
  };

  const setQuality = (val) => {
    const key = QUALITY_LABELS[val] ? val : 'high';
    localStorage.setItem('bukaake-video-quality', key);
    refreshQualityLabels();
  };

  if (toggleSpaceSaver) {
    toggleSpaceSaver.checked = localStorage.getItem('bukaake-space-saver') === 'true';
    toggleSpaceSaver.addEventListener('change', () => {
      localStorage.setItem('bukaake-space-saver', toggleSpaceSaver.checked ? 'true' : 'false');
      refreshQualityLabels();
    });
  }

  const savedQuality = localStorage.getItem('bukaake-video-quality') || 'high';
  setQuality(savedQuality);

  if (btnTrigger && menuQuality && wrapQuality) {
    const closeDropdown = () => {
      menuQuality.classList.add('hidden');
      wrapQuality.classList.remove('open');
      document.removeEventListener('click', onDocClick);
    };

    const onDocClick = (e) => {
      if (!wrapQuality.contains(e.target)) closeDropdown();
    };

    btnTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !menuQuality.classList.contains('hidden');
      if (isOpen) {
        closeDropdown();
      } else {
        menuQuality.classList.remove('hidden');
        wrapQuality.classList.add('open');
        setTimeout(() => document.addEventListener('click', onDocClick), 10);
      }
    });

    menuQuality.querySelectorAll('.glass-dropdown-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        setQuality(item.dataset.value);
        closeDropdown();
      });
    });
  }

  // 3. Storage Directory & Prompt
  const inputDir = document.getElementById('inputVideoSaveDir');
  const btnBrowseDir = document.getElementById('btnBrowseVideoDir');
  const btnOpenDir = document.getElementById('btnOpenVideoDir');
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

  btnOpenDir?.addEventListener('click', async () => {
    const dir = inputDir?.value || localStorage.getItem('bukaake-video-save-dir') || (await invoke('get_default_videos_dir'));
    if (dir) {
      await tauriBridge.showInFolder(dir);
    }
  });

  if (togglePrompt) {
    togglePrompt.checked = localStorage.getItem('bukaake-video-prompt-save') === 'true';
    togglePrompt.addEventListener('change', () => {
      localStorage.setItem('bukaake-video-prompt-save', togglePrompt.checked ? 'true' : 'false');
    });
  }

  // 4. Audio Recording & Sync Offset Section
  bindAudioSettings();

  // 5. Tandem Companion Editors (Alitken & Cathet)
  bindTandemSettings();
}
