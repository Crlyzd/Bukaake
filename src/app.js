/**
 * Bukaake Main Application Coordinator
 * Bootstraps and orchestrates UI components, core canvas engines, and platform services (< 280 lines)
 */

import { CanvasViewer } from './core/canvas-viewer.js';
import { CropperTool } from './core/cropper.js';
import { FilterEngine } from './core/filters.js';
import { DrawingTool } from './core/drawing-tool.js';
import { MetadataInspector } from './core/metadata.js';
import { tauriBridge } from './services/tauri-bridge.js';
import { FileLoader } from './services/file-loader.js';
import { IdleController } from './services/idle-controller.js';
import { ShortcutsRegistry } from './services/shortcuts.js';
import { changeTracker } from './services/change-tracker.js';
import { WindowModeManager, MODE_REGULAR, MODE_VIEWER } from './services/window-mode-manager.js';
import { Titlebar } from './components/titlebar.js';
import { Toolbar } from './components/toolbar.js';
import { AdjustmentsPanel } from './components/adjustments-panel.js';
import { MetadataDrawer } from './components/metadata-drawer.js';
import { ShortcutsModal } from './components/shortcuts-modal.js';
import { SettingsModal } from './components/settings-modal.js';
import { ConfirmModal } from './components/confirm-modal.js';
import { ContextMenu } from './components/context-menu.js';
import { exportImage, copyProcessedImage } from './services/image-saver.js';

class BukaakeApp {
  constructor() {
    this.canvasEl = document.getElementById('imageCanvas');
    this.viewportEl = document.getElementById('viewportContainer');
    this.dropZoneEl = document.getElementById('dropZone');
    this.fileInput = document.getElementById('fileInput');

    this.viewer = new CanvasViewer(this.canvasEl, this.viewportEl);
    this.filters = new FilterEngine(this.viewer, { onModified: (d) => changeTracker.markColor(d) });
    this.cropper = new CropperTool(document.getElementById('cropOverlayContainer'), document.getElementById('cropBox'), document.getElementById('cropDimensionsTag'), this.viewer);
    this.drawingTool = new DrawingTool(document.getElementById('drawCanvas'), this.viewer, { onModified: (d) => changeTracker.markDraw(d) });
    this.metadataInspector = new MetadataInspector(document.getElementById('metadataBody'));

    this.fileLoader = new FileLoader();
    this.confirmModal = new ConfirmModal();
    this.bgModes = ['bg-transparent', 'bg-checkerboard'];
    this.currentBgIndex = 0;

    this.initComponents();
    this.initServices();
    this.init();
  }

  initComponents() {
    this.settingsModal = new SettingsModal();
    this.shortcutsModal = new ShortcutsModal();
    this.metadataDrawer = new MetadataDrawer({ metadataInspector: this.metadataInspector });
    this.adjustmentsPanel = new AdjustmentsPanel({ filters: this.filters, onClose: () => this.toolbar.setAdjustmentsActive(false) });
    this.titlebar = new Titlebar({
      onOpenFile: () => this.confirmModal.promptIfDirty(() => this.fileInput?.click(), () => this.saveImage()),
      onPasteClipboard: () => this.confirmModal.promptIfDirty(() => this.fileLoader.loadFromClipboard(), () => this.saveImage()),
      onToggleMetadata: () => { if (this.viewer.img) this.metadataDrawer.toggle(); },
      onToggleSettings: async () => { if (!(await tauriBridge.openSettingsWindow())) this.settingsModal.toggle(); },
      onToggleHelp: () => this.shortcutsModal.toggle(),
      onToggleMode: () => this.windowModeManager?.toggleMode(),
      onClose: () => this.confirmModal.promptIfDirty(() => tauriBridge.closeWindow(), () => this.saveImage()),
    });

    this.contextMenu = new ContextMenu({
      container: this.viewportEl,
      getFilePath: () => this.fileLoader.currentMeta?.path || null,
      hasImage: () => Boolean(this.viewer.img),
      isCropActive: () => Boolean(this.cropper.active || this.drawingTool.active),
      actions: {
        onCopyImage: () => this.copyImage(),
        onSaveImage: () => this.saveImage(),
        onRotateRight: () => this.viewer.rotate(90),
        onFlipH: () => this.viewer.toggleFlipH(),
        onFitScreen: () => this.viewer.fitToScreen(),
        onCrop: () => this.toggleCrop(true),
        onToggleMetadata: () => { if (this.viewer.img) this.metadataDrawer.toggle(); },
      },
    });

    this.toolbar = new Toolbar({
      actions: {
        onNavigateBatch: (d) => this.confirmModal.promptIfDirty(() => this.fileLoader.navigateBatch(d), () => this.saveImage()),
        onZoomIn: () => this.viewer.zoomTo(this.viewer.scale * 1.25, false, this.viewer.cursorX, this.viewer.cursorY),
        onZoomOut: () => this.viewer.zoomTo(this.viewer.scale * 0.8, false, this.viewer.cursorX, this.viewer.cursorY),
        onFitScreen: () => this.viewer.fitToScreen(), onActualSize: () => this.viewer.zoomTo(1.0),
        onRotateLeft: () => this.viewer.rotate(-90), onRotateRight: () => this.viewer.rotate(90),
        onFlipH: () => this.viewer.toggleFlipH(), onFlipV: () => this.viewer.toggleFlipV(),
        onTogglePixelated: () => !this.viewer.togglePixelSmoothing(), onToggleBgMode: () => this.cycleBgMode(),
        onToggleAdjustments: () => this.toolbar.setAdjustmentsActive(this.adjustmentsPanel.toggle()),
        onSaveImage: () => this.saveImage(),
        onToggleCrop: () => this.toggleCrop(), onCancelCrop: () => this.toggleCrop(false), onApplyCrop: () => this.applyCrop(),
        onCropPreset: (r) => this.cropper.setAspectRatio(r),
        onToggleDraw: () => this.toggleDraw(), onCancelDraw: () => this.toggleDraw(false), onApplyDraw: () => this.applyDraw(),
        onDrawMode: (m) => this.drawingTool.setMode(m), onDrawColor: (c) => this.drawingTool.setColor(c),
        onDrawSize: (s) => this.drawingTool.setSize(s), onDrawUndo: () => this.drawingTool.undo(), onDrawClear: () => this.drawingTool.clear(),
      },
    });
  }

  initServices() {
    this.fileLoader.onImageLoaded = (img, meta) => {
      document.body.classList.add('image-loaded');
      this.dropZoneEl.style.display = 'none';
      this.viewer.setImage(img);
      this.filters.reset();
      changeTracker.reset();
      this.adjustmentsPanel.syncSliderUI();
      this.metadataDrawer.update(meta, img);
      this.titlebar.setFileName(meta.name);
      this.titlebar.setHasImage(true);
      this.updateStatusBadges();
      this.idleController?.refreshState();

      if (this.windowModeManager.currentMode !== MODE_VIEWER) {
        const nw = img.naturalWidth || img.width;
        const nh = img.naturalHeight || img.height;
        this.windowModeManager?.applyImageAspectSize(nw, nh, 820);
      }
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
      if (this.windowModeManager.currentMode === MODE_VIEWER && !this.cropper.active && !this.drawingTool.active) {
        this.windowModeManager.setMode(MODE_REGULAR);
      }
    };

    this.idleController = new IdleController({
      titlebar: document.getElementById('appTitlebar'),
      toolbar: document.getElementById('floatingToolbar'),
      topThreshold: 55,
      bottomThreshold: 90,
      hasImage: () => Boolean(this.viewer.img),
      isBlocked: () => Boolean(this.cropper.active || this.drawingTool.active || this.settingsModal.isOpen()),
    });

    this.shortcuts = new ShortcutsRegistry({
      onOpenFile: () => this.confirmModal.promptIfDirty(() => this.fileInput?.click(), () => this.saveImage()),
      onSaveImage: () => this.saveImage(),
      onNavigateBatch: (d) => this.confirmModal.promptIfDirty(() => this.fileLoader.navigateBatch(d), () => this.saveImage()),
      onZoomIn: () => this.viewer.zoomTo(this.viewer.scale * 1.2), onZoomOut: () => this.viewer.zoomTo(this.viewer.scale * 0.8),
      onFitScreen: () => this.viewer.fitToScreen(), onActualSize: () => this.viewer.zoomTo(1.0),
      onRotateLeft: () => this.viewer.rotate(-90), onRotateRight: () => this.viewer.rotate(90),
      onFlipH: () => this.viewer.toggleFlipH(), onFlipV: () => this.viewer.toggleFlipV(),
      onToggleCrop: () => this.toggleCrop(), onToggleDraw: () => this.toggleDraw(), onDrawUndo: () => this.drawingTool.undo(),
      onToggleAdjustments: () => this.toolbar.setAdjustmentsActive(this.adjustmentsPanel.toggle()),
      onToggleMetadata: () => { if (this.viewer.img) this.metadataDrawer.toggle(); },
      onToggleBgMode: () => this.cycleBgMode(),
      onTogglePixelated: () => {
        const isPix = !this.viewer.togglePixelSmoothing();
        document.getElementById('btnPixelated')?.classList.toggle('active', isPix);
      },
      onToggleMaximize: () => this.windowModeManager?.toggleMode(), onToggleHelp: () => this.shortcutsModal.toggle(),
      onEscape: () => {
        if (this.confirmModal.isOpen()) return this.confirmModal.hide();
        if (this.drawingTool.active) return this.toggleDraw(false);
        if (this.cropper.active) return this.toggleCrop(false);
        if (this.adjustmentsPanel.isOpen()) { this.adjustmentsPanel.hide(); return this.toolbar.setAdjustmentsActive(false); }
        for (const m of [this.metadataDrawer, this.settingsModal, this.shortcutsModal]) if (m.isOpen()) return m.hide();
        const action = this.windowModeManager?.currentMode === MODE_VIEWER ? () => tauriBridge.exitApp() : () => tauriBridge.closeWindow();
        this.confirmModal.promptIfDirty(action, () => this.saveImage());
      },
    });
  }

  async init() {
    tauriBridge.initExternalLinks();
    this.fileLoader.bindDropAndPaste(this.viewportEl, this.fileInput);

    const shield = document.getElementById('modalShield');
    tauriBridge.onSettingsModalState((open) => shield?.classList.toggle('hidden', !open));
    shield?.addEventListener('mousedown', (e) => {
      e.preventDefault(); e.stopPropagation();
      tauriBridge.playWindowsDing();
      tauriBridge.openSettingsWindow();
    });

    document.body.classList.add('bg-transparent');
    this.titlebar.syncMaximizedState(await tauriBridge.isFullscreen());

    try {
      const initial = await tauriBridge.getInitialImage();
      if (initial?.target_path) {
        await this.windowModeManager.setMode(MODE_VIEWER);
        return this.fileLoader.loadFromTauriContext(initial);
      }
    } catch (err) { console.warn('[Bukaake] Startup check failed:', err); }
  }

  updateStatusBadges() {
    if (!this.viewer.img) return;
    const w = this.viewer.img.naturalWidth || this.viewer.img.width;
    const h = this.viewer.img.naturalHeight || this.viewer.img.height;
    this.titlebar.setDimensions(w, h, Math.round(this.viewer.scale * 100));
    this.toolbar.updateZoomPercent(this.viewer.scale);
  }

  cycleBgMode() {
    if (document.body.classList.contains('mode-viewer')) return toast.show('Background theme is disabled in fullscreen');
    document.body.classList.remove(...this.bgModes);
    this.currentBgIndex = (this.currentBgIndex + 1) % this.bgModes.length;
    document.body.classList.add(this.bgModes[this.currentBgIndex]);
    toast.show(`Background: ${['Pure Crystal Transparency', 'Checkerboard Grid'][this.currentBgIndex]}`);
  }

  toggleCrop(forceState = null) {
    const should = forceState !== null ? forceState : !this.cropper.active;
    if (should) {
      if (!this.viewer.img) return toast.show('Load an image first to crop');
      if (this.drawingTool.active) this.toggleDraw(false);
      this.viewer.setBottomInset(110, false);
      this.cropper.show();
      this.toolbar.setCropActive(true);
    } else {
      this.viewer.setBottomInset(0, true);
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
      changeTracker.markCrop(true);
      toast.show(`Cropped to ${rect.width} × ${rect.height} px`);
    };
    img.src = offCanvas.toDataURL('image/png');
  }

  toggleDraw(forceState = null) {
    const should = forceState !== null ? forceState : !this.drawingTool.active;
    if (should) {
      if (!this.viewer.img) return toast.show('Load an image first to draw');
      if (this.cropper.active) this.toggleCrop(false);
      this.drawingTool.show();
      this.toolbar.setDrawActive(true);
    } else {
      this.drawingTool.hide();
      this.toolbar.setDrawActive(false);
    }
  }

  applyDraw() {
    const baked = this.drawingTool.bakeToImage();
    if (!baked) return toast.show('No drawings to apply');
    baked.onload = () => {
      this.fileLoader.loadDirectImage(baked, { name: this.fileLoader.currentMeta?.name || 'Drawn Image' });
      this.toggleDraw(false);
      changeTracker.markDraw(true);
      toast.show('Applied drawing to image');
    };
  }

  copyImage() {
    copyProcessedImage(this.viewer, this.filters);
  }

  async saveImage() {
    return await exportImage(
      this.viewer,
      this.filters,
      this.fileLoader,
      this.cropper.active,
      this.drawingTool.active
    );
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new BukaakeApp();
});
