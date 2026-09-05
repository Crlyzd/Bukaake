/**
 * Bukaake Main Application Coordinator
 * Bootstraps and orchestrates UI components, core canvas engines, and platform services
 */

import { CanvasViewer } from './core/canvas-viewer.js';
import { CropperTool } from './core/cropper.js';
import { FilterEngine } from './core/filters.js';
import { MetadataInspector } from './core/metadata.js';
import { tauriBridge } from './services/tauri-bridge.js';
import { FileLoader } from './services/file-loader.js';
import { IdleController } from './services/idle-controller.js';
import { ShortcutsRegistry } from './services/shortcuts.js';
import { WindowModeManager, MODE_REGULAR, MODE_VIEWER } from './services/window-mode-manager.js';
import { Titlebar } from './components/titlebar.js';
import { Toolbar } from './components/toolbar.js';
import { AdjustmentsPanel } from './components/adjustments-panel.js';
import { MetadataDrawer } from './components/metadata-drawer.js';
import { ShortcutsModal } from './components/shortcuts-modal.js';
import { SettingsModal } from './components/settings-modal.js';
import { toast } from './components/toast.js';

class BukaakeApp {
  constructor() {
    this.canvasEl = document.getElementById('imageCanvas');
    this.viewportEl = document.getElementById('viewportContainer');
    this.dropZoneEl = document.getElementById('dropZone');
    this.fileInput = document.getElementById('fileInput');

    this.viewer = new CanvasViewer(this.canvasEl, this.viewportEl);
    this.filters = new FilterEngine(this.viewer);
    this.cropper = new CropperTool(
      document.getElementById('cropOverlayContainer'),
      document.getElementById('cropBox'),
      document.getElementById('cropDimensionsTag'),
      this.viewer
    );
    this.metadataInspector = new MetadataInspector(document.getElementById('metadataBody'));

    this.fileLoader = new FileLoader();
    this.bgModes = ['bg-transparent', 'bg-checkerboard', 'bg-solid-dark', 'bg-solid-light'];
    this.currentBgIndex = 0;

    this.initComponents();
    this.initServices();
    this.init();
  }

  initComponents() {
    this.settingsModal = new SettingsModal();

    this.titlebar = new Titlebar({
      onOpenFile: () => this.fileInput?.click(),
      onPasteClipboard: () => this.fileLoader.loadFromClipboard(),
      onToggleMetadata: () => this.metadataDrawer.toggle(),
      onToggleSettings: () => this.settingsModal.toggle(),
      onToggleHelp: () => this.shortcutsModal.toggle(),
      onToggleMode: () => this.windowModeManager?.toggleMode(),
    });

    this.adjustmentsPanel = new AdjustmentsPanel({
      filters: this.filters,
      onClose: () => this.toolbar.setAdjustmentsActive(false),
    });

    this.metadataDrawer = new MetadataDrawer({
      metadataInspector: this.metadataInspector,
    });

    this.shortcutsModal = new ShortcutsModal();

    this.toolbar = new Toolbar({
      actions: {
        onNavigateBatch: (delta) => this.fileLoader.navigateBatch(delta),
        onZoomIn: () => this.viewer.zoomTo(this.viewer.scale * 1.25),
        onZoomOut: () => this.viewer.zoomTo(this.viewer.scale * 0.8),
        onFitScreen: () => this.viewer.fitToScreen(),
        onActualSize: () => this.viewer.zoomTo(1.0),
        onRotateLeft: () => this.viewer.rotate(-90),
        onRotateRight: () => this.viewer.rotate(90),
        onFlipH: () => this.viewer.toggleFlipH(),
        onFlipV: () => this.viewer.toggleFlipV(),
        onTogglePixelated: () => !this.viewer.togglePixelSmoothing(),
        onToggleBgMode: () => this.cycleBgMode(),
        onToggleAdjustments: () => this.toolbar.setAdjustmentsActive(this.adjustmentsPanel.toggle()),
        onSaveImage: () => this.saveImage(),
        onToggleCrop: () => this.toggleCrop(),
        onCancelCrop: () => this.toggleCrop(false),
        onApplyCrop: () => this.applyCrop(),
        onCropPreset: (ratio) => this.cropper.setAspectRatio(ratio),
      },
    });
  }

  initServices() {
    this.fileLoader.onImageLoaded = (img, meta) => {
      document.body.classList.add('image-loaded');
      this.dropZoneEl.style.display = 'none';
      this.viewer.setImage(img);
      this.filters.reset();
      this.adjustmentsPanel.syncSliderUI();
      this.metadataDrawer.update(meta, img);
      this.titlebar.setFileName(meta.name);
      this.updateStatusBadges();
      this.idleController?.refreshState();

      const nw = img.naturalWidth || img.width;
      const nh = img.naturalHeight || img.height;
      this.windowModeManager?.applyImageAspectSize(nw, nh, 820);
    };

    this.fileLoader.onListChanged = (total, idx) => this.toolbar.updateCounter(total, idx);
    this.fileLoader.onStatusMessage = (msg) => toast.show(msg);
    this.viewer.onTransformChange = () => this.updateStatusBadges();

    this.windowModeManager = new WindowModeManager({
      viewer: this.viewer,
      titlebar: this.titlebar,
      onModeChange: (mode) => {
        this.titlebar.syncMaximizedState(mode === MODE_VIEWER);
        this.idleController?.refreshState();
      },
    });
    this.windowModeManager.bindEdgeResizers();

    this.viewer.onToggleMode = () => this.windowModeManager.toggleMode();
    this.viewer.onOutsideClick = () => {
      if (this.windowModeManager.currentMode === MODE_VIEWER) {
        this.windowModeManager.setMode(MODE_REGULAR);
      }
    };

    this.idleController = new IdleController({
      titlebar: document.getElementById('appTitlebar'),
      toolbar: document.getElementById('floatingToolbar'),
      topThreshold: 55,
      bottomThreshold: 90,
      hasImage: () => Boolean(this.viewer.img),
      isBlocked: () => Boolean(this.cropper.active || this.settingsModal.isOpen()),
    });

    this.shortcuts = new ShortcutsRegistry({
      onOpenFile: () => this.fileInput?.click(),
      onSaveImage: () => this.saveImage(),
      onNavigateBatch: (delta) => this.fileLoader.navigateBatch(delta),
      onZoomIn: () => this.viewer.zoomTo(this.viewer.scale * 1.2),
      onZoomOut: () => this.viewer.zoomTo(this.viewer.scale * 0.8),
      onFitScreen: () => this.viewer.fitToScreen(),
      onActualSize: () => this.viewer.zoomTo(1.0),
      onRotateLeft: () => this.viewer.rotate(-90),
      onRotateRight: () => this.viewer.rotate(90),
      onFlipH: () => this.viewer.toggleFlipH(),
      onFlipV: () => this.viewer.toggleFlipV(),
      onToggleCrop: () => this.toggleCrop(),
      onToggleAdjustments: () => this.toolbar.setAdjustmentsActive(this.adjustmentsPanel.toggle()),
      onToggleMetadata: () => this.metadataDrawer.toggle(),
      onToggleBgMode: () => this.cycleBgMode(),
      onTogglePixelated: () => {
        const isPix = !this.viewer.togglePixelSmoothing();
        document.getElementById('btnPixelated')?.classList.toggle('active', isPix);
      },
      onToggleMaximize: () => this.windowModeManager?.toggleMode(),
      onToggleHelp: () => this.shortcutsModal.toggle(),
      onEscape: () => {
        if (this.cropper.active) { this.toggleCrop(false); return; }
        if (this.adjustmentsPanel.isOpen()) { this.adjustmentsPanel.hide(); this.toolbar.setAdjustmentsActive(false); return; }
        if (this.metadataDrawer.isOpen()) { this.metadataDrawer.hide(); return; }
        if (this.settingsModal.isOpen()) { this.settingsModal.hide(); return; }
        if (this.shortcutsModal.isOpen()) { this.shortcutsModal.hide(); return; }
        if (this.windowModeManager?.currentMode === MODE_VIEWER) {
          this.windowModeManager.setMode(MODE_REGULAR);
          return;
        }
        tauriBridge.closeWindow();
      },
    });
  }

  async init() {
    this.fileLoader.bindDropAndPaste(this.viewportEl, this.fileInput);
    document.getElementById('dropSampleBtn')?.addEventListener('click', () => this.loadSampleImage());
    document.body.classList.add('bg-transparent');

    try {
      const initial = await tauriBridge.getInitialImage();
      if (initial && initial.target_path) {
        this.fileLoader.loadFromTauriContext(initial);
        return;
      }
    } catch (err) {
      console.warn('[Bukaake] Startup check failed:', err);
    }

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('sample')) this.loadSampleImage();
  }

  updateStatusBadges() {
    if (!this.viewer.img) return;
    const w = this.viewer.img.naturalWidth || this.viewer.img.width;
    const h = this.viewer.img.naturalHeight || this.viewer.img.height;
    const pct = Math.round(this.viewer.scale * 100);
    this.titlebar.setDimensions(w, h, pct);
    this.toolbar.updateZoomPercent(this.viewer.scale);
  }

  cycleBgMode() {
    document.body.classList.remove(...this.bgModes);
    this.currentBgIndex = (this.currentBgIndex + 1) % this.bgModes.length;
    document.body.classList.add(this.bgModes[this.currentBgIndex]);
    const names = ['Pure Crystal Transparency', 'Checkerboard Grid', 'Solid Dark Glass', 'Solid Light Glass'];
    toast.show(`Background: ${names[this.currentBgIndex]}`);
  }

  toggleCrop(forceState = null) {
    const shouldCrop = forceState !== null ? forceState : !this.cropper.active;
    if (shouldCrop) {
      if (!this.viewer.img) {
        toast.show('Load an image first to crop');
        return;
      }
      this.cropper.show();
      this.toolbar.setCropActive(true);
      toast.show('Drag box or handles to select crop region');
    } else {
      this.cropper.hide();
      this.toolbar.setCropActive(false);
    }
  }

  applyCrop() {
    const rect = this.cropper.getCropImageRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      toast.show('Invalid crop area');
      return;
    }
    const offCanvas = this.viewer.getProcessedCanvas(rect, this.filters.getFilterCssString());
    if (!offCanvas) return;

    const img = new Image();
    img.onload = () => {
      this.fileLoader.loadDirectImage(img, { name: 'Cropped Image' });
      this.toggleCrop(false);
      toast.show(`Cropped to ${rect.width} × ${rect.height} px`);
    };
    img.src = offCanvas.toDataURL('image/png');
  }

  saveImage() {
    if (!this.viewer.img) {
      toast.show('No image loaded to save');
      return;
    }
    const offCanvas = this.viewer.getProcessedCanvas(null, this.filters.getFilterCssString());
    if (!offCanvas) return;

    const link = document.createElement('a');
    const baseName = this.fileLoader.currentMeta?.name?.replace(/\.[^/.]+$/, '') || 'bukaake_export';
    link.download = `${baseName}_edited.png`;
    link.href = offCanvas.toDataURL('image/png');
    link.click();
    toast.show(`Exported ${link.download}`);
  }

  loadSampleImage() {
    const c = document.createElement('canvas');
    c.width = 1920;
    c.height = 1080;
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 1920, 1080);
    grad.addColorStop(0, '#0a0c1b');
    grad.addColorStop(0.5, '#1e0538');
    grad.addColorStop(1, '#051b2c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1920, 1080);

    const img = new Image();
    img.onload = () => {
      this.fileLoader.loadDirectImage(img, { name: 'bukaake_demo_wallpaper.png' });
      toast.show('Loaded Demo Sample Wallpaper');
    };
    img.src = c.toDataURL('image/png');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new BukaakeApp();
});
