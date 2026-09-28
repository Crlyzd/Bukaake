/**
 * Bukaake Settings Audio & Sync Section Controller
 * Encapsulates audio recording source chips and sync offset stepper pill (< 120 lines)
 */

export function bindAudioSettings() {
  // 1. Audio Source Chips (Desktop & Mic)
  const chipSysAudio = document.getElementById('chipRecordSysAudio');
  const chipMic = document.getElementById('chipRecordMic');

  const updateAudioChips = () => {
    const isSysOn = localStorage.getItem('bukaake-record-sys-audio') !== 'false';
    const isMicOn = localStorage.getItem('bukaake-record-mic') === 'true';
    chipSysAudio?.classList.toggle('active', isSysOn);
    chipMic?.classList.toggle('active', isMicOn);
  };

  chipSysAudio?.addEventListener('click', () => {
    const current = localStorage.getItem('bukaake-record-sys-audio') !== 'false';
    localStorage.setItem('bukaake-record-sys-audio', current ? 'false' : 'true');
    updateAudioChips();
  });

  chipMic?.addEventListener('click', () => {
    const current = localStorage.getItem('bukaake-record-mic') === 'true';
    localStorage.setItem('bukaake-record-mic', current ? 'false' : 'true');
    updateAudioChips();
  });

  updateAudioChips();

  // 2. Audio Sync Offset Segmented Stepper (-200ms to +200ms)
  const btnSyncDec = document.getElementById('btnAudioSyncDec');
  const btnSyncInc = document.getElementById('btnAudioSyncInc');
  const lblSyncVal = document.getElementById('lblAudioSyncVal');

  let currentSync = parseInt(localStorage.getItem('bukaake-audio-sync-offset') || '0', 10);
  if (!Number.isFinite(currentSync)) currentSync = 0;

  const updateSync = (val) => {
    currentSync = Math.max(-200, Math.min(200, val));
    localStorage.setItem('bukaake-audio-sync-offset', String(currentSync));
    if (lblSyncVal) {
      lblSyncVal.textContent = `${currentSync > 0 ? '+' : ''}${currentSync} ms`;
      lblSyncVal.classList.toggle('has-offset', currentSync !== 0);
    }
  };
  updateSync(currentSync);

  const bindStepperBtn = (btn, delta) => {
    if (!btn) return;
    let timer = null;
    let interval = null;
    let wasHolding = false;

    const stop = () => {
      clearTimeout(timer);
      clearInterval(interval);
      timer = null;
      interval = null;
    };

    btn.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      wasHolding = false;
      timer = setTimeout(() => {
        wasHolding = true;
        interval = setInterval(() => updateSync(currentSync + delta), 75);
      }, 350);
    });

    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointerleave', stop);
    btn.addEventListener('pointercancel', stop);
    btn.addEventListener('click', () => {
      if (!wasHolding) updateSync(currentSync + delta);
      wasHolding = false;
    });
  };

  bindStepperBtn(btnSyncDec, -10);
  bindStepperBtn(btnSyncInc, 10);
  lblSyncVal?.addEventListener('click', () => updateSync(0));
}
