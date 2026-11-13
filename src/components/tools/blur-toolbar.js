/**
 * Bukaake Floating Glass Blur & Pixelate Sub-Toolbar Component
 * Coordinates effect mode, shape (Brush/Rect/Circle), brush size, strength, feather, and history (< 180 lines).
 */

import { i18n } from '../../services/platform/i18n-service.js';

const STRENGTH_ORDER = ['low', 'med', 'high'];

export class BlurToolbar {
  constructor(blurTool, options = {}) {
    this.tool = blurTool;
    this.actions = options;
    this.container = document.getElementById('blurToolbar');
    this.strength = 'med';
    this.feather = false;
    this.currentSize = 32;

    this.init();
  }

  init() {
    this.bindModeButtons();
    this.bindShapeButtons();
    this.bindSizeControls();
    this.bindStrengthAndFeather();
    this.bindHistoryAndActions();

    window.addEventListener('bukaake-language-changed', () => this.applyStrengthUI());
  }

  bindModeButtons() {
    const btnBlur = document.getElementById('btnBlurModeGaussian');
    const btnPix = document.getElementById('btnBlurModePixelate');
    btnBlur?.addEventListener('click', () => {
      btnBlur.classList.add('active');
      btnPix?.classList.remove('active');
      this.tool?.setMode('blur');
    });
    btnPix?.addEventListener('click', () => {
      btnPix.classList.add('active');
      btnBlur?.classList.remove('active');
      this.tool?.setMode('pixelate');
    });
  }

  bindShapeButtons() {
    const sizeAnchor = document.getElementById('blurSizeAnchor');
    const sizeDiv = document.getElementById('blurSizeDivider');
    const btns = [
      { id: 'btnBlurShapeBrush', shape: 'brush' },
      { id: 'btnBlurShapeRect', shape: 'rect' },
      { id: 'btnBlurShapeCircle', shape: 'circle' },
    ];

    btns.forEach(({ id, shape }) => {
      document.getElementById(id)?.addEventListener('click', () => {
        btns.forEach((b) => document.getElementById(b.id)?.classList.remove('active'));
        document.getElementById(id)?.classList.add('active');
        const isBrush = shape === 'brush';
        if (sizeAnchor) sizeAnchor.style.display = isBrush ? '' : 'none';
        if (sizeDiv) sizeDiv.style.display = isBrush ? '' : 'none';
        if (!isBrush) this.closePopovers();
        this.tool?.setShape(shape);
      });
    });
  }

  closePopovers() {
    document.getElementById('blurSizePopover')?.classList.add('hidden');
    document.getElementById('btnBlurSizePop')?.classList.remove('active');
  }

  bindSizeControls() {
    const sizePop = document.getElementById('blurSizePopover');
    const btnSize = document.getElementById('btnBlurSizePop');
    const sizeTrack = document.getElementById('blurSizeTrack');
    const sizeFill = document.getElementById('blurSizeFill');
    const sizeThumb = document.getElementById('blurSizeThumb');
    const sizeBadge = document.getElementById('blurSizeBadge');
    const sizeDot = document.getElementById('blurSizePreviewDot');

    btnSize?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = sizePop?.classList.toggle('hidden');
      btnSize.classList.toggle('active', !isHidden);
    });

    const updateSize = (val) => {
      this.currentSize = Math.min(150, Math.max(10, parseInt(val, 10) || 32));
      const pct = (this.currentSize - 10) / (150 - 10);
      if (sizeFill) sizeFill.style.height = `${pct * 100}%`;
      if (sizeThumb) sizeThumb.style.bottom = `${pct * 100}%`;
      if (sizeBadge) sizeBadge.textContent = `${this.currentSize}px`;
      if (sizeDot) {
        const previewPx = Math.round(6 + pct * 26);
        sizeDot.style.width = `${previewPx}px`;
        sizeDot.style.height = `${previewPx}px`;
      }
      this.tool?.setSize(this.currentSize);
    };
    updateSize(32);

    let isDraggingSize = false;
    const handleTrackMove = (e) => {
      if (!sizeTrack) return;
      const rect = sizeTrack.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (rect.bottom - e.clientY) / rect.height));
      updateSize(Math.round(10 + ratio * (150 - 10)));
    };

    sizeTrack?.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      isDraggingSize = true;
      handleTrackMove(e);
    });
    window.addEventListener('mousemove', (e) => { if (isDraggingSize) handleTrackMove(e); });
    window.addEventListener('mouseup', () => { isDraggingSize = false; });

    const onWheel = (e) => {
      e.stopPropagation();
      e.preventDefault();
      updateSize(this.currentSize + (e.deltaY < 0 ? 5 : -5));
    };
    sizePop?.addEventListener('wheel', onWheel, { passive: false });
    btnSize?.addEventListener('wheel', onWheel, { passive: false });

    window.addEventListener('bukaake-blur-step-size', (e) => updateSize(this.currentSize + (e.detail || 0)));
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#blurToolbar, .draw-popover')) this.closePopovers();
    });
  }

  applyStrengthUI() {
    const btn = document.getElementById('btnBlurStrength');
    const lbl = document.getElementById('blurStrengthLabel');
    const keyMap = { low: 'blur.strengthLow', med: 'blur.strengthMed', high: 'blur.strengthHigh' };
    const defMap = { low: 'Low', med: 'Med', high: 'High' };
    if (lbl) lbl.textContent = i18n.t(keyMap[this.strength], {}, defMap[this.strength]);
    btn?.classList.toggle('active-subtle', this.strength !== 'high');
    btn?.classList.toggle('active-galaxy', this.strength === 'high');
    if (btn) btn.title = `Intensity: ${defMap[this.strength]} (Click to cycle)`;
  }

  bindStrengthAndFeather() {
    const btnStrength = document.getElementById('btnBlurStrength');
    this.applyStrengthUI();
    btnStrength?.addEventListener('click', () => {
      const idx = STRENGTH_ORDER.indexOf(this.strength);
      this.strength = STRENGTH_ORDER[(idx + 1) % STRENGTH_ORDER.length];
      this.applyStrengthUI();
      this.tool?.setStrength(this.strength);
    });

    const btnFeather = document.getElementById('btnBlurFeather');
    btnFeather?.addEventListener('click', () => {
      this.feather = !this.feather;
      btnFeather.classList.toggle('active-subtle', this.feather);
      btnFeather.title = this.feather
        ? 'Feather Edge: On (Soft fade blend)'
        : 'Feather Edge: Off (Sharp boundary)';
      this.tool?.setFeather(this.feather);
    });
  }

  bindHistoryAndActions() {
    document.getElementById('btnBlurUndo')?.addEventListener('click', () => this.tool?.undo());
    document.getElementById('btnBlurRedo')?.addEventListener('click', () => this.tool?.redo());
    document.getElementById('btnBlurClear')?.addEventListener('click', () => this.tool?.clear());
    document.getElementById('btnCancelBlur')?.addEventListener('click', () => this.actions.onCancel?.());
    document.getElementById('btnApplyBlur')?.addEventListener('click', () => this.actions.onApply?.());
  }
}

