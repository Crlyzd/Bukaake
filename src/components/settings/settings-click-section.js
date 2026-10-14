/**
 * Bukaake Settings Click Calibration & Accordion Section Controller
 * Encapsulates accordion toggles, click sound volume slider, and Web Audio API test preview (< 110 lines)
 */

export function bindClickAndAccordionSettings() {
  // 1. Collapsible Section Accordions
  const groups = document.querySelectorAll('.settings-section-group');
  groups.forEach((group) => {
    const id = group.id;
    const header = group.querySelector('.settings-section-header');
    if (!header || !id) return;

    // Restore saved state (groupSnip defaults to expanded; others default to collapsed)
    const saved = localStorage.getItem(`bukaake-accordion-${id}`);
    if (saved === 'expanded') {
      group.classList.remove('collapsed');
    } else if (saved === 'collapsed') {
      group.classList.add('collapsed');
    } else {
      group.classList.toggle('collapsed', id !== 'groupSnip');
    }

    header.addEventListener('click', (e) => {
      e.stopPropagation();
      const isNowCollapsed = group.classList.toggle('collapsed');
      localStorage.setItem(`bukaake-accordion-${id}`, isNowCollapsed ? 'collapsed' : 'expanded');
    });
  });

  // 2. Cursor, Click Highlights & Click Sounds Toggles
  const toggleRecordCursor = document.getElementById('toggleRecordCursor');
  const toggleClickHighlights = document.getElementById('toggleClickHighlights');
  const toggleClickSounds = document.getElementById('toggleClickSounds');
  const rowClickVolume = document.getElementById('rowClickVolume');

  const updateVolumeRowVisibility = () => {
    if (!rowClickVolume) return;
    const isSoundsOn = localStorage.getItem('bukaake-record-click-sounds') !== 'false';
    rowClickVolume.classList.toggle('hidden', !isSoundsOn);
  };

  if (toggleRecordCursor) {
    toggleRecordCursor.checked = localStorage.getItem('bukaake-record-cursor') !== 'false';
    toggleRecordCursor.addEventListener('change', () => {
      localStorage.setItem('bukaake-record-cursor', toggleRecordCursor.checked ? 'true' : 'false');
    });
  }

  if (toggleClickHighlights) {
    toggleClickHighlights.checked = localStorage.getItem('bukaake-record-click-highlights') !== 'false';
    toggleClickHighlights.addEventListener('change', () => {
      localStorage.setItem('bukaake-record-click-highlights', toggleClickHighlights.checked ? 'true' : 'false');
    });
  }

  if (toggleClickSounds) {
    toggleClickSounds.checked = localStorage.getItem('bukaake-record-click-sounds') !== 'false';
    toggleClickSounds.addEventListener('change', () => {
      localStorage.setItem('bukaake-record-click-sounds', toggleClickSounds.checked ? 'true' : 'false');
      updateVolumeRowVisibility();
    });
  }

  // 3. Volume Slider Calibration
  const slider = document.getElementById('sliderClickVolume');
  const lblVal = document.getElementById('lblClickVolumeVal');
  const savedVol = parseInt(localStorage.getItem('bukaake-click-sound-volume') || '70', 10);
  const initialVol = Number.isFinite(savedVol) ? Math.max(0, Math.min(100, savedVol)) : 70;

  if (slider && lblVal) {
    slider.value = String(initialVol);
    lblVal.textContent = `${initialVol}%`;

    slider.addEventListener('input', () => {
      const val = parseInt(slider.value, 10);
      lblVal.textContent = `${val}%`;
      localStorage.setItem('bukaake-click-sound-volume', String(val));
    });
  }

  // 4. Web Audio API Test Click Preview (Zero Latency)
  const btnTest = document.getElementById('btnTestClickSound');
  btnTest?.addEventListener('click', () => {
    const vol = parseInt(slider?.value || '70', 10) / 100;
    playClickSoundPreview(vol);
  });

  updateVolumeRowVisibility();
}

function playClickSoundPreview(volumeFactor) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx({ sampleRate: 48000 });
    const vol = Math.max(0, Math.min(1, volumeFactor));
    if (vol <= 0.001) return;

    const sampleRate = 48000;
    const leftSamples = synthesizeClickWaveform(false, vol, sampleRate);
    const rightSamples = synthesizeClickWaveform(true, vol, sampleRate);

    // 160ms gap between Left and Right click in preview
    const gapSamples = Math.floor(sampleRate * 0.16);
    const totalLength = leftSamples.length + gapSamples + rightSamples.length;

    const buffer = ctx.createBuffer(2, totalLength, sampleRate);
    const lChan = buffer.getChannelData(0);
    const rChan = buffer.getChannelData(1);

    for (let i = 0; i < leftSamples.length; i++) {
      lChan[i] = leftSamples[i];
      rChan[i] = leftSamples[i];
    }
    const rightOffset = leftSamples.length + gapSamples;
    for (let i = 0; i < rightSamples.length; i++) {
      lChan[rightOffset + i] = rightSamples[i];
      rChan[rightOffset + i] = rightSamples[i];
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
  } catch (err) {
    console.warn('[ClickPreview] Web Audio error:', err);
  }
}

function synthesizeClickWaveform(isRightClick, vol, sampleRate) {
  const durationSecs = isRightClick ? 0.036 : 0.046;
  const peakCap = isRightClick ? 0.92 : 0.98;
  const totalSamples = Math.floor(sampleRate * durationSecs);
  const out = new Float32Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let raw = 0;

    if (isRightClick) {
      const snap = Math.exp(-1800 * t) * Math.sin(2 * Math.PI * 4400 * t);
      const phase = 2 * Math.PI * (1200 * t + (2000 / 220) * (1 - Math.exp(-220 * t)));
      const body = Math.sin(phase);
      const env = t < 0.0008 ? t / 0.0008 : Math.exp(-75 * (t - 0.0008));
      raw = (snap * 0.75 + body * 0.65) * env * 2.2;
    } else {
      const snap = Math.exp(-1200 * t) * Math.sin(2 * Math.PI * 3200 * t);
      const phase = 2 * Math.PI * (750 * t + (1450 / 160) * (1 - Math.exp(-160 * t)));
      const body = Math.sin(phase);
      const sub = Math.sin(2 * Math.PI * 400 * t) * Math.exp(-90 * t) * 0.35;
      const env = t < 0.001 ? t / 0.001 : Math.exp(-52 * (t - 0.001));
      raw = (snap * 0.65 + body * 0.70 + sub) * env * 2.4;
    }

    out[i] = Math.tanh(raw) * peakCap * vol;
  }

  return out;
}
