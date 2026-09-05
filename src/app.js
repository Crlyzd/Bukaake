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
import { ContextMenu } from './components/context-menu.js';
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
      document.getElementById('cropOverlayContainer'), document.getElementById('cropBox'),
      document.getElementById('cropDimensionsTag'), this.viewer
    );
    this.metadataInspector = new MetadataInspector(document.getElementById('metadataBody'));

    this.fileLoader = new FileLoader();
    this.bgModes = ['bg-transparent', 'bg-checkerboard'];
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
      onToggleSettings: async () => {
        if (!(await tauriBridge.openSettingsWindow())) this.settingsModal.toggle();
      },
      onToggleHelp: () => this.shortcutsModal.toggle(),
      onToggleMode: () => this.windowModeManager?.toggleMode(),
    });

    this.adjustmentsPanel = new AdjustmentsPanel({
      filters: this.filters,
      onClose: () => this.toolbar.setAdjustmentsActive(false),
    });

    this.metadataDrawer = new MetadataDrawer({ metadataInspector: this.metadataInspector });
    this.shortcutsModal = new ShortcutsModal();

    this.contextMenu = new ContextMenu({
      container: this.viewportEl,
      getFilePath: () => this.fileLoader.currentMeta?.path || null,
      hasImage: () => Boolean(this.viewer.img),
      actions: {
        onCopyImage: () => this.copyImage(),
        onSaveImage: () => this.saveImage(),
        onRotateRight: () => this.viewer.rotate(90),
        onFlipH: () => this.viewer.toggleFlipH(),
        onFitScreen: () => this.viewer.fitToScreen(),
        onCrop: () => this.toggleCrop(true),
        onToggleMetadata: () => this.metadataDrawer.toggle(),
      },
    });

    this.toolbar = new Toolbar({
      actions: {
        onNavigateBatch: (delta) => this.fileLoader.navigateBatch(delta),
        onZoomIn: () => this.viewer.zoomTo(this.viewer.scale * 1.25, false, this.viewer.cursorX, this.viewer.cursorY),
        onZoomOut: () => this.viewer.zoomTo(this.viewer.scale * 0.8, false, this.viewer.cursorX, this.viewer.cursorY),
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
      if (this.windowModeManager.currentMode === MODE_VIEWER) this.windowModeManager.setMode(MODE_REGULAR);
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
        if (this.cropper.active) return this.toggleCrop(false);
        if (this.adjustmentsPanel.isOpen()) { this.adjustmentsPanel.hide(); return this.toolbar.setAdjustmentsActive(false); }
        if (this.metadataDrawer.isOpen()) return this.metadataDrawer.hide();
        if (this.settingsModal.isOpen()) return this.settingsModal.hide();
        if (this.shortcutsModal.isOpen()) return this.shortcutsModal.hide();
        if (this.windowModeManager?.currentMode === MODE_VIEWER) return this.windowModeManager.setMode(MODE_REGULAR);
        tauriBridge.closeWindow();
      },
    });
  }

  async init() {
    tauriBridge.initExternalLinks();
    this.fileLoader.bindDropAndPaste(this.viewportEl, this.fileInput);
    document.getElementById('dropSampleBtn')?.addEventListener('click', () => this.loadSampleImage());
    document.body.classList.add('bg-transparent');
    this.titlebar.syncMaximizedState(await tauriBridge.isFullscreen());

    try {
      const initial = await tauriBridge.getInitialImage();
      if (initial?.target_path) return this.fileLoader.loadFromTauriContext(initial);
    } catch (err) { console.warn('[Bukaake] Startup check failed:', err); }

    if (new URLSearchParams(window.location.search).get('sample')) this.loadSampleImage();
  }

  updateStatusBadges() {
    if (!this.viewer.img) return;
    const w = this.viewer.img.naturalWidth || this.viewer.img.width;
    const h = this.viewer.img.naturalHeight || this.viewer.img.height;
    this.titlebar.setDimensions(w, h, Math.round(this.viewer.scale * 100));
    this.toolbar.updateZoomPercent(this.viewer.scale);
  }

  cycleBgMode() {
    if (document.body.classList.contains('mode-viewer')) {
      toast.show('Background theme is disabled in fullscreen');
      return;
    }
    document.body.classList.remove(...this.bgModes);
    this.currentBgIndex = (this.currentBgIndex + 1) % this.bgModes.length;
    document.body.classList.add(this.bgModes[this.currentBgIndex]);
    const names = ['Pure Crystal Transparency', 'Checkerboard Grid'];
    toast.show(`Background: ${names[this.currentBgIndex]}`);
  }

  toggleCrop(forceState = null) {
    const shouldCrop = forceState !== null ? forceState : !this.cropper.active;
    if (shouldCrop) {
      if (!this.viewer.img) return toast.show('Load an image first to crop');
      this.cropper.show();
      this.toolbar.setCropActive(true);
    } else {
      this.cropper.hide();
      this.toolbar.setCropActive(false);
    }
  }

  applyCrop() {
    const rect = this.cropper.getCropImageRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return toast.show('Invalid crop area');
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

  copyImage() {
    if (!this.viewer.img) { toast.show('No image loaded to copy'); return; }
    try {
      const off = this.viewer.getProcessedCanvas(null, this.filters.getFilterCssString());
      if (!off) return;
      off.toBlob(async (b) => {
        if (!b) return;
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]);
          toast.show('Image copied to clipboard');
        } catch { toast.show('Failed to copy to clipboard'); }
      }, 'image/png');
    } catch { toast.show('Clipboard copy unsupported'); }
  }

  saveImage() {
    if (!this.viewer.img) { toast.show('No image loaded to save'); return; }
    const off = this.viewer.getProcessedCanvas(null, this.filters.getFilterCssString());
    if (!off) return;
    const link = document.createElement('a');
    const base = this.fileLoader.currentMeta?.name?.replace(/\.[^/.]+$/, '') || 'bukaake_export';
    link.download = `${base}_edited.png`;
    link.href = off.toDataURL('image/png');
    link.click();
    toast.show(`Exported ${link.download}`);
  }

  loadSampleImage() {
    const c = document.createElement('canvas');
    c.width = 1920; c.height = 1080;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 1920, 1080);
    g.addColorStop(0, '#0a0c1b'); g.addColorStop(0.5, '#1e0538'); g.addColorStop(1, '#051b2c');
    ctx.fillStyle = g;
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
