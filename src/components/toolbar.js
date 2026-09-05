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

    document.getElementById('btnApplyDraw')?.addEventListener('click', () => {
      this.actions.onApplyDraw?.();
    });

    document.getElementById('btnDrawUndo')?.addEventListener('click', () => {
      this.actions.onDrawUndo?.();
    });

    document.getElementById('btnDrawClear')?.addEventListener('click', () => {
      this.actions.onDrawClear?.();
    });

    document.getElementById('btnDrawPen')?.addEventListener('click', (e) => {
      document.getElementById('btnDrawPen')?.classList.add('active');
      document.getElementById('btnDrawHighlighter')?.classList.remove('active');
      this.actions.onDrawMode?.('pen');
    });

    document.getElementById('btnDrawHighlighter')?.addEventListener('click', (e) => {
      document.getElementById('btnDrawHighlighter')?.classList.add('active');
      document.getElementById('btnDrawPen')?.classList.remove('active');
      this.actions.onDrawMode?.('highlighter');
    });

    document.querySelectorAll('.draw-color-chip').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        document.querySelectorAll('.draw-color-chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        const color = chip.getAttribute('data-color');
        this.actions.onDrawColor?.(color);
      });
    });

    const customColorInput = document.getElementById('drawCustomColor');
    customColorInput?.addEventListener('input', (e) => {
      document.querySelectorAll('.draw-color-chip').forEach((c) => c.classList.remove('active'));
      this.actions.onDrawColor?.(e.target.value);
    });

    document.querySelectorAll('.draw-size-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.draw-size-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const size = parseInt(btn.getAttribute('data-size'), 10) || 6;
        this.actions.onDrawSize?.(size);
      });
    });
  }

  updateCounter(total, currentIndex) {
    if (this.fileCounterEl) {
      this.fileCounterEl.textContent = total > 0 ? `${currentIndex + 1} / ${total}` : '0 / 0';
    }
    const btnPrev = document.getElementById('btnPrevImage');
    const btnNext = document.getElementById('btnNextImage');
    if (btnPrev) btnPrev.disabled = total <= 1;
    if (btnNext) btnNext.disabled = total <= 1;
  }

  updateZoomPercent(scale) {
    if (this.zoomPercentText) {
      this.zoomPercentText.textContent = `${Math.round(scale * 100)}%`;
    }
  }

  setCropActive(active) {
    if (this.btnCropMode) this.btnCropMode.classList.toggle('active', active);
    if (this.cropToolbar) this.cropToolbar.classList.toggle('hidden', !active);
    if (this.container) this.container.classList.toggle('crop-locked', active);

    const lockedIds = [
      'btnPrevImage', 'btnNextImage', 'btnRotateLeft', 'btnRotateRight',
      'btnFlipH', 'btnFlipV', 'btnDrawMode', 'btnAdjustments',
      'btnPixelated', 'btnBgMode', 'btnSaveAs',
    ];
    for (const id of lockedIds) {
      const el = document.getElementById(id);
      if (el) {
        el.disabled = active;
        el.style.opacity = active ? '0.28' : '';
        el.style.pointerEvents = active ? 'none' : '';
      }
    }
  }

  setDrawActive(active) {
    if (this.btnDrawMode) this.btnDrawMode.classList.toggle('active', active);
    if (this.drawToolbar) this.drawToolbar.classList.toggle('hidden', !active);
    if (this.container) this.container.classList.toggle('draw-locked', active);

    const lockedIds = [
      'btnPrevImage', 'btnNextImage', 'btnRotateLeft', 'btnRotateRight',
      'btnFlipH', 'btnFlipV', 'btnCropMode', 'btnAdjustments',
      'btnPixelated', 'btnBgMode', 'btnSaveAs',
    ];
    for (const id of lockedIds) {
      const el = document.getElementById(id);
      if (el) {
        el.disabled = active;
        el.style.opacity = active ? '0.28' : '';
        el.style.pointerEvents = active ? 'none' : '';
      }
    }
  }

  setAdjustmentsActive(active) {
    if (this.btnAdjustments) {
      this.btnAdjustments.classList.toggle('active', active);
    }
  }
}
