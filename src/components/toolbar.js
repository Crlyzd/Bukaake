/**
 * Bukaake Floating Glass Toolbar Component
 * Coordinates zoom, transforms, crop mode triggers, background mode, and batch counter
 */

export class Toolbar {
  constructor(options = {}) {
    this.container = document.getElementById('floatingToolbar');
    this.fileCounterEl = document.getElementById('fileCounter');
    this.zoomPercentText = document.getElementById('zoomPercentText');
    this.cropToolbar = document.getElementById('cropToolbar');
    this.btnCropMode = document.getElementById('btnCropMode');
    this.btnAdjustments = document.getElementById('btnAdjustments');
    this.btnDrawMode = document.getElementById('btnDrawMode');
    this.drawToolbar = document.getElementById('drawToolbar');
    this.btnSaveAs = document.getElementById('btnSaveAs');

    this.actions = options.actions || {};
    this.init();
  }

  init() {
    this.bindNavigationButtons();
    this.bindZoomButtons();
    this.bindTransformButtons();
    this.bindDisplayToggles();
    this.bindCropControls();
    this.bindDrawControls();
  }

  bindNavigationButtons() {
    document.getElementById('btnPrevImage')?.addEventListener('click', () => {
      this.actions.onNavigateBatch?.(-1);
    });

    document.getElementById('btnNextImage')?.addEventListener('click', () => {
      this.actions.onNavigateBatch?.(1);
    });
  }

  bindZoomButtons() {
    document.getElementById('btnZoomIn')?.addEventListener('click', () => {
      this.actions.onZoomIn?.();
    });

    document.getElementById('btnZoomOut')?.addEventListener('click', () => {
      this.actions.onZoomOut?.();
    });

    document.getElementById('btnFitScreen')?.addEventListener('click', () => {
      this.actions.onFitScreen?.();
    });

    document.getElementById('btnActualSize')?.addEventListener('click', () => {
      this.actions.onActualSize?.();
    });

    document.getElementById('btnZoomLabel')?.addEventListener('click', () => {
      this.actions.onFitScreen?.();
    });
  }

  bindTransformButtons() {
    document.getElementById('btnRotateLeft')?.addEventListener('click', () => {
      this.actions.onRotateLeft?.();
    });

    document.getElementById('btnRotateRight')?.addEventListener('click', () => {
      this.actions.onRotateRight?.();
    });

    document.getElementById('btnFlipH')?.addEventListener('click', () => {
      this.actions.onFlipH?.();
    });

    document.getElementById('btnFlipV')?.addEventListener('click', () => {
      this.actions.onFlipV?.();
    });
  }

  bindDisplayToggles() {
    document.getElementById('btnPixelated')?.addEventListener('click', (e) => {
      const isPixelated = this.actions.onTogglePixelated?.();
      e.currentTarget.classList.toggle('active', isPixelated);
    });

    document.getElementById('btnBgMode')?.addEventListener('click', () => {
      this.actions.onToggleBgMode?.();
    });

    document.getElementById('btnRawFull')?.addEventListener('click', () => {
      this.actions.onLoadFullRaw?.();
    });

    this.btnAdjustments?.addEventListener('click', () => {
      this.actions.onToggleAdjustments?.();
    });

    document.getElementById('btnSaveAs')?.addEventListener('click', () => {
      this.actions.onSaveImage?.();
    });
  }

  bindCropControls() {
    this.btnCropMode?.addEventListener('click', () => {
      this.actions.onToggleCrop?.();
    });

    document.getElementById('btnCancelCrop')?.addEventListener('click', () => {
      this.actions.onCancelCrop?.();
    });

    document.getElementById('btnApplyCrop')?.addEventListener('click', () => {
      this.actions.onApplyCrop?.();
    });

    document.querySelectorAll('.crop-preset-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.crop-preset-btn').forEach((b) => b.classList.remove('active'));
        e.target.classList.add('active');
        const ratio = e.target.getAttribute('data-ratio');
        this.actions.onCropPreset?.(ratio);
      });
    });
  }

  bindDrawControls() {
    this.btnDrawMode?.addEventListener('click', () => {
      this.actions.onToggleDraw?.();
    });

    document.getElementById('btnCancelDraw')?.addEventListener('click', () => {
      this.actions.onCancelDraw?.();
    });

    document.getElementById('btnApplyDraw')?.addEventListener('click', () => this.actions.onApplyDraw?.());
    document.getElementById('btnDrawUndo')?.addEventListener('click', () => this.actions.onDrawUndo?.());
    document.getElementById('btnDrawClear')?.addEventListener('click', () => this.actions.onDrawClear?.());

    const sizeAnchor = document.getElementById('drawSizeAnchor');

    document.getElementById('btnDrawPen')?.addEventListener('click', () => {
      document.getElementById('btnDrawPen')?.classList.add('active');
      document.getElementById('btnDrawHighlighter')?.classList.remove('active');
      if (sizeAnchor) sizeAnchor.style.display = '';
      this.actions.onDrawMode?.('pen');
    });

    document.getElementById('btnDrawHighlighter')?.addEventListener('click', () => {
      document.getElementById('btnDrawHighlighter')?.classList.add('active');
      document.getElementById('btnDrawPen')?.classList.remove('active');
      if (sizeAnchor) {
        sizeAnchor.style.display = 'none';
        closeDrawPopovers();
      }
      this.actions.onDrawMode?.('highlighter');
    });

    const colorPop = document.getElementById('drawColorPopover');
    const sizePop = document.getElementById('drawSizePopover');
    const colorDot = document.getElementById('drawCurrentColorDot');
    const sizeDot = document.getElementById('drawSizePreviewDot');
    const sizeBadge = document.getElementById('drawSizeBadge');

    const closeDrawPopovers = () => {
      colorPop?.classList.add('hidden');
      sizePop?.classList.add('hidden');
      document.getElementById('btnDrawColorPop')?.classList.remove('active');
      document.getElementById('btnDrawSizePop')?.classList.remove('active');
    };

    document.getElementById('btnDrawColorPop')?.addEventListener('click', (e) => {
      e.stopPropagation();
      sizePop?.classList.add('hidden');
      document.getElementById('btnDrawSizePop')?.classList.remove('active');
      const isHidden = colorPop?.classList.toggle('hidden');
      document.getElementById('btnDrawColorPop')?.classList.toggle('active', !isHidden);
    });

    document.getElementById('btnDrawSizePop')?.addEventListener('click', (e) => {
      e.stopPropagation();
      colorPop?.classList.add('hidden');
      document.getElementById('btnDrawColorPop')?.classList.remove('active');
      const isHidden = sizePop?.classList.toggle('hidden');
      document.getElementById('btnDrawSizePop')?.classList.toggle('active', !isHidden);
    });

    const applyColor = (color) => {
      if (colorDot) colorDot.style.backgroundColor = color;
      if (sizeDot) sizeDot.style.backgroundColor = color;
      this.actions.onDrawColor?.(color);
    };

    document.querySelectorAll('.draw-color-chip').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.draw-color-chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        applyColor(chip.getAttribute('data-color'));
        closeDrawPopovers();
      });
    });

    const sizeTrack = document.getElementById('drawSizeTrack');
    const sizeFill = document.getElementById('drawSizeFill');
    const sizeThumb = document.getElementById('drawSizeThumb');
    let currentSize = 24;

    const updateSize = (val) => {
      currentSize = Math.min(150, Math.max(10, parseInt(val, 10) || 24));
      const pct = (currentSize - 10) / (150 - 10);
      if (sizeFill) sizeFill.style.height = `${pct * 100}%`;
      if (sizeThumb) sizeThumb.style.bottom = `${pct * 100}%`;
      if (sizeBadge) sizeBadge.textContent = `${currentSize}px`;
      if (sizeDot) {
        const previewPx = Math.round(6 + pct * 26);
        sizeDot.style.width = `${previewPx}px`;
        sizeDot.style.height = `${previewPx}px`;
      }
      this.actions.onDrawSize?.(currentSize);
    };

    updateSize(24);

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

    sizePop?.addEventListener('wheel', (e) => {
      e.stopPropagation();
      e.preventDefault();
      updateSize(currentSize + (e.deltaY < 0 ? 5 : -5));
    }, { passive: false });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#drawToolbar, .draw-popover')) closeDrawPopovers();
    });
  }

  updateCounter(total, currentIndex) {
    if (this.fileCounterEl) this.fileCounterEl.textContent = total > 0 ? `${currentIndex + 1} / ${total}` : '0 / 0';
    const bP = document.getElementById('btnPrevImage'), bN = document.getElementById('btnNextImage');
    if (bP) bP.disabled = total <= 1;
    if (bN) bN.disabled = total <= 1;
  }

  updateZoomPercent(scale) {
    if (this.zoomPercentText) this.zoomPercentText.textContent = `${Math.round(scale * 100)}%`;
  }

  _setLocked(ids, active) {
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) {
        el.disabled = active;
        el.classList.toggle('tool-locked', active);
      }
    }
  }

  setCropActive(active) {
    if (this.btnCropMode) this.btnCropMode.classList.toggle('active', active);
    if (this.cropToolbar) this.cropToolbar.classList.toggle('hidden', !active);
    if (this.container) this.container.classList.toggle('crop-locked', active);
    // Transforms remain enabled in crop mode per user preference
    this._setLocked(['btnPrevImage', 'btnNextImage', 'btnDrawMode', 'btnAdjustments', 'btnPixelated', 'btnBgMode', 'btnRawFull', 'btnSaveAs'], active);
  }

  setDrawActive(active) {
    if (this.btnDrawMode) this.btnDrawMode.classList.toggle('active', active);
    if (this.drawToolbar) this.drawToolbar.classList.toggle('hidden', !active);
    if (this.container) this.container.classList.toggle('draw-locked', active);
    if (!active) {
      document.getElementById('drawColorPopover')?.classList.add('hidden');
      document.getElementById('drawSizePopover')?.classList.add('hidden');
      document.getElementById('btnDrawColorPop')?.classList.remove('active');
      document.getElementById('btnDrawSizePop')?.classList.remove('active');
    }
    this._setLocked(['btnPrevImage', 'btnNextImage', 'btnRotateLeft', 'btnRotateRight', 'btnFlipH', 'btnFlipV', 'btnCropMode', 'btnAdjustments', 'btnPixelated', 'btnBgMode', 'btnRawFull', 'btnSaveAs'], active);
  }

  setAdjustmentsActive(active) {
    if (this.btnAdjustments) this.btnAdjustments.classList.toggle('active', active);
    if (this.container) this.container.classList.toggle('adjustments-locked', active);
    this._setLocked(['btnPrevImage', 'btnNextImage', 'btnRotateLeft', 'btnRotateRight', 'btnFlipH', 'btnFlipV', 'btnCropMode', 'btnDrawMode', 'btnPixelated', 'btnBgMode', 'btnRawFull', 'btnSaveAs'], active);
  }

  /** Show / hide the Full Sensor Decode button based on whether a RAW file is active. */
  setRawFile(isRaw) {
    document.body.classList.toggle('is-raw', Boolean(isRaw));
  }

  /** Toggle the in-flight spinner on #btnRawFull during the decode IPC call. */
  setRawDecoding(loading) {
    const btn = document.getElementById('btnRawFull');
    if (!btn) return;
    btn.classList.toggle('loading', loading);
    btn.disabled = loading;
  }
}
