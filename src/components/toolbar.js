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

    this.actions = options.actions || {};
    this.init();
  }

  init() {
    this.bindNavigationButtons();
    this.bindZoomButtons();
    this.bindTransformButtons();
    this.bindDisplayToggles();
    this.bindCropControls();
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
    if (this.btnCropMode) {
      this.btnCropMode.classList.toggle('active', active);
    }
    if (this.cropToolbar) {
      this.cropToolbar.classList.toggle('hidden', !active);
    }
  }

  setAdjustmentsActive(active) {
    if (this.btnAdjustments) {
      this.btnAdjustments.classList.toggle('active', active);
    }
  }
}
