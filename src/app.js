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
import { DeleteModal } from './components/delete-modal.js';
import { ContextMenu } from './components/context-menu.js';
import { CanvasToolsManager } from './services/canvas-tools-manager.js';
import { exportImage, copyProcessedImage } from './services/image-saver.js';
import { toast } from './components/toast.js';
import { loadingIndicator } from './components/loading-indicator.js';
import { standbyService } from './services/standby-service.js';
import { CaptureManager } from './services/capture-manager.js';
import { themeManager } from './services/theme-manager.js';

const RAW_EXTS = new Set([
  'arw','srf','sr2','cr2','cr3','nef','nrw','dng','raf','rw2','orf','pef','3fr',
  'mrw','srw','x3f','mos','mef','raw','kdc','dcr','rwl','iiq','erf',
]);

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
    this.confirmModal = new ConfirmModal(); this.deleteModal = new DeleteModal();
    this.initComponents(); this.initServices(); this.init();
  }

  initComponents() {
    this.settingsModal = new SettingsModal();
    this.shortcutsModal = new ShortcutsModal();
    this.captureManager = new CaptureManager({ viewer: this.viewer, fileLoader: this.fileLoader, toolbar: this.toolbar });
    this.metadataDrawer = new MetadataDrawer({ metadataInspector: this.metadataInspector });
    this.adjustmentsPanel = new AdjustmentsPanel({ filters: this.filters, onClose: () => this.toolbar.setAdjustmentsActive(false) });
    this.titlebar = new Titlebar({
      onOpenFile: () => this.confirmModal.promptIfDirty(() => this.openFile(), () => this.saveImage()),
      onPasteClipboard: () => this.confirmModal.promptIfDirty(() => this.fileLoader.loadFromClipboard(), () => this.saveImage()),
      onToggleMetadata: () => { if (this.viewer.img) this.metadataDrawer.toggle(); },
      onToggleSettings: async () => { if (!(await tauriBridge.openSettingsWindow())) this.settingsModal.toggle(); },
      onToggleHelp: () => this.shortcutsModal.toggle(),
      onToggleMode: () => this.windowModeManager?.toggleMode(),
      onClose: () => this.confirmModal.promptIfDirty(() => standbyService.enterStandby({ viewer: this.viewer, fileLoader: this.fileLoader }), () => this.saveImage()),
    });

    this.toolbar = new Toolbar({
      actions: {
        onNavigateBatch: (d) => this.handleNavigateBatch(d),
        onZoomIn: () => this.viewer.zoomTo(this.viewer.scale * 1.25, false, this.viewer.cursorX, this.viewer.cursorY),
        onZoomOut: () => this.viewer.zoomTo(this.viewer.scale * 0.8, false, this.viewer.cursorX, this.viewer.cursorY),
        onFitScreen: () => this.viewer.fitToScreen(), onActualSize: () => this.viewer.zoomTo(1.0),
        onRotateLeft: () => this.handleRotate(-90), onRotateRight: () => this.handleRotate(90),
        onFlipH: () => this.handleFlip('h'), onFlipV: () => this.handleFlip('v'),
        onTogglePixelated: () => !this.viewer.togglePixelSmoothing(), onToggleBgMode: () => this.cycleBgMode(),
        onToggleAdjustments: () => this.toolsManager.toggleAdjustments(),
        onSaveImage: () => this.saveImage(),
        onLoadFullRaw: () => this.handleLoadFullRaw(),
        onToggleCrop: () => this.toolsManager.toggleCrop(), onCancelCrop: () => this.toolsManager.toggleCrop(false), onApplyCrop: () => this.toolsManager.applyCrop(this.filters),
        onCropPreset: (r) => this.cropper.setAspectRatio(r),
        onToggleDraw: () => this.toolsManager.toggleDraw(), onCancelDraw: () => this.toolsManager.toggleDraw(false), onApplyDraw: () => this.toolsManager.applyDraw(),
        onDrawMode: (m) => this.drawingTool.setMode(m), onDrawColor: (c) => this.drawingTool.setColor(c),
        onDrawSize: (s) => this.drawingTool.setSize(s), onDrawUndo: () => this.drawingTool.undo(), onDrawClear: () => this.drawingTool.clear(),
      },
    });

    this.toolsManager = new CanvasToolsManager({
      viewer: this.viewer, cropper: this.cropper, drawingTool: this.drawingTool,
      toolbar: this.toolbar, fileLoader: this.fileLoader, adjustmentsPanel: this.adjustmentsPanel,
    });

    this.contextMenu = new ContextMenu({
      container: this.viewportEl,
      getFilePath: () => this.fileLoader.currentMeta?.path || null,
      hasImage: () => Boolean(this.viewer.img),
      isEditing: () => this.toolsManager.isEditing(),
      isRaw: () => document.body.classList.contains('is-raw'),
      actions: {
        onCopyImage: () => this.copyImage(), onSaveImage: () => this.saveImage(),
        onRotateRight: () => this.handleRotate(90), onFlipH: () => this.handleFlip('h'),
        onFitScreen: () => this.viewer.fitToScreen(), onCrop: () => this.toolsManager.toggleCrop(true),
        onToggleMetadata: () => { if (this.viewer.img) this.metadataDrawer.toggle(); },
        onDeleteFile: () => this.deleteCurrentFile(false),
        onLoadFullRaw: () => this.handleLoadFullRaw(),
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
      this.drawingTool?.clear();
      if (this.drawingTool?.active) this.toolsManager?.toggleDraw(false);
      this.adjustmentsPanel.syncSliderUI();
      this.metadataDrawer.update(meta, img);
      this.titlebar.setFileName(meta.name);
      this.titlebar.setHasImage(true);
      this.updateStatusBadges();
      this.idleController?.refreshState();
      const ext = (meta.name || '').split('.').pop().toLowerCase();
      this.toolbar.setRawFile(RAW_EXTS.has(ext));

      if (this.windowModeManager.currentMode !== MODE_VIEWER) {
        this.windowModeManager?.applyImageAspectSize(img.naturalWidth || img.width, img.naturalHeight || img.height, 820);
      }
    };

    this.fileLoader.onListChanged = (t, i) => this.toolbar.updateCounter(t, i);
    this.fileLoader.onStatusMessage = (m) => toast.show(m);
    this.fileLoader.onStatusWarning = (m) => toast.warn(m);
    this.fileLoader.onLoadingStart = (m) => loadingIndicator.show(m);
    this.fileLoader.onLoadingEnd = () => loadingIndicator.hide();
    this.fileLoader.onPromptOpen = () => this.confirmModal.promptIfDirty(() => this.openFile(), () => this.saveImage());
    this.fileLoader.onAllFilesCleared = () => (this.windowModeManager?.currentMode === MODE_VIEWER ? standbyService.enterStandby({ viewer: this.viewer, fileLoader: this.fileLoader }) : this.handleEmptyState());
    this.viewer.onTransformChange = () => { this.updateStatusBadges(); if (this.drawingTool?.active) this.drawingTool.redraw(); if (this.cropper?.active) this.cropper.onTransform(); };

    this.windowModeManager = new WindowModeManager({
      viewer: this.viewer, titlebar: this.titlebar,
      onModeChange: (m) => { this.titlebar.syncMaximizedState(m === MODE_VIEWER); this.idleController?.refreshState(); },
    });
    this.windowModeManager.bindEdgeResizers();

    this.viewer.onToggleMode = () => this.windowModeManager.toggleMode();
    this.viewer.onOutsideClick = () => {
      if (this.windowModeManager.currentMode === MODE_VIEWER && !this.cropper.active && !this.drawingTool.active) {
        this.windowModeManager.setMode(MODE_REGULAR);
      }
    };

    this.idleController = new IdleController({
      titlebar: document.getElementById('appTitlebar'), toolbar: document.getElementById('floatingToolbar'),
      topThreshold: 55, bottomThreshold: 90, hasImage: () => Boolean(this.viewer.img),
      isBlocked: () => Boolean(this.cropper.active || this.drawingTool.active || this.settingsModal.isOpen()),
    });

    this.shortcuts = new ShortcutsRegistry({
      onOpenFile: () => this.confirmModal.promptIfDirty(() => this.openFile(), () => this.saveImage()),
      onPasteClipboard: () => this.confirmModal.promptIfDirty(() => this.fileLoader.loadFromClipboard(), () => this.saveImage()),
      onCopyImage: () => this.copyImage(), onSaveImage: () => this.saveImage(),
      onNavigateBatch: (d) => this.handleNavigateBatch(d),
      onZoomIn: () => this.viewer.zoomTo(this.viewer.scale * 1.2), onZoomOut: () => this.viewer.zoomTo(this.viewer.scale * 0.8),
      onFitScreen: () => this.viewer.fitToScreen(), onActualSize: () => this.viewer.zoomTo(1.0),
      onRotateLeft: () => this.handleRotate(-90), onRotateRight: () => this.handleRotate(90),
      onFlipH: () => this.handleFlip('h'), onFlipV: () => this.handleFlip('v'),
      onToggleCrop: () => this.toolsManager.toggleCrop(), onToggleDraw: () => this.toolsManager.toggleDraw(), onDrawUndo: () => this.drawingTool.undo(),
      onToggleAdjustments: () => this.toolsManager.toggleAdjustments(),
      onToggleMetadata: () => { if (this.viewer.img) this.metadataDrawer.toggle(); },
      onToggleBgMode: () => this.cycleBgMode(),
      onTogglePixelated: () => {
        const isPix = !this.viewer.togglePixelSmoothing();
        document.getElementById('btnPixelated')?.classList.toggle('active', isPix);
      },
      onToggleMaximize: () => { if (this.viewer.img) this.windowModeManager?.toggleMode(); else toast.info('Load an image first'); }, onToggleHelp: () => this.shortcutsModal.toggle(),
      onDeleteFile: (perm) => this.deleteCurrentFile(perm),
      onLoadFullRaw: () => this.handleLoadFullRaw(),
      onEscape: () => {
        if (this.deleteModal.isOpen()) return this.deleteModal.hide();
        if (this.confirmModal.isOpen()) return this.confirmModal.hide();
        if (this.drawingTool.active) return this.toolsManager.toggleDraw(false);
        if (this.cropper.active) return this.toolsManager.toggleCrop(false);
        if (this.adjustmentsPanel.isOpen()) return this.toolsManager.closeAdjustments();
        for (const m of [this.metadataDrawer, this.settingsModal, this.shortcutsModal]) if (m.isOpen()) return m.hide();
        this.confirmModal.promptIfDirty(() => standbyService.enterStandby({ viewer: this.viewer, fileLoader: this.fileLoader }), () => this.saveImage());
      },
    });
  }

  async init() {
    tauriBridge.initExternalLinks();
    this.fileLoader.bindDropAndPaste(this.viewportEl, this.fileInput);
    const shield = document.getElementById('modalShield');
    tauriBridge.onSettingsModalState((open) => shield?.classList.toggle('hidden', !open));
    shield?.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); tauriBridge.playWindowsDing(); tauriBridge.openSettingsWindow(); });
    this.titlebar.syncMaximizedState(await tauriBridge.isFullscreen());
    await standbyService.init({
      onOpenPath: async (p) => {
        this.dropZoneEl.style.display = 'none';
        await this.windowModeManager.setMode(MODE_VIEWER);
        const name = p.split(/[/\\]/).pop() || 'image';
        loadingIndicator.show(`Loading ${name}...`);
        const ctx = await tauriBridge.readImageContext(p);
        if (ctx) this.fileLoader.loadFromTauriContext(ctx);
        else { loadingIndicator.hide(); toast.warn(`Unsupported file format: ${name}`); }
      },
      onOpenSettings: async () => { if (!(await tauriBridge.openSettingsWindow())) this.settingsModal.toggle(); },
      onWakeFromStandby: () => this.wakeFromStandby(),
    });

    try {
      const initial = await tauriBridge.getInitialImage();
      if (initial?.target_path) {
        await this.windowModeManager.setMode(MODE_VIEWER);
        loadingIndicator.show(`Loading ${initial.file_name}...`);
        // Eagerly suppress startpage before window reveal to eliminate the ~5-frame
        // dropzone flash caused by img.onload decoding async after show_main_window.
        document.body.classList.add('image-loaded');
        this.dropZoneEl.style.display = 'none';
        this.fileLoader.loadFromTauriContext(initial);
      } else if (initial?.error) toast.warn(initial.error);
    } catch (err) { console.warn('[Bukaake] Startup check failed:', err); }
    await tauriBridge.invoke('show_main_window');
  }

  updateStatusBadges() {
    if (!this.viewer.img) return;
    this.titlebar.setDimensions(this.viewer.img.naturalWidth || this.viewer.img.width, this.viewer.img.naturalHeight || this.viewer.img.height, Math.round(this.viewer.scale * 100));
    this.toolbar.updateZoomPercent(this.viewer.scale);
  }

  cycleBgMode() {
    if (document.body.classList.contains('mode-viewer')) return toast.show('Background theme is disabled in fullscreen');
    if (!document.body.classList.contains('image-loaded')) return toast.show('Load an image first to toggle canvas background');
    themeManager.toggleCheckerboard();
    toast.show(`Background: ${themeManager.checkerboardEnabled ? 'Checkerboard Grid' : 'Pure Crystal Transparency'}`);
  }

  copyImage() { copyProcessedImage(this.viewer, this.filters); }

  async openFile() {
    if (tauriBridge.isTauri()) {
      const p = await tauriBridge.promptOpenFile();
      if (p) {
        const payload = await tauriBridge.readImageContext(p);
        if (payload) this.fileLoader.loadFromTauriContext(payload);
        else toast.warn(`Unsupported file format: ${p.split(/[/\\]/).pop()}`);
      }
    } else { this.fileInput?.click(); }
  }

  async saveImage() { return await exportImage(this.viewer, this.filters, this.fileLoader, this.cropper.active, this.drawingTool.active); }

  async handleLoadFullRaw() {
    const path = this.fileLoader.currentMeta?.path;
    if (!path || !document.body.classList.contains('is-raw')) {
      return toast.show('No RAW file is currently loaded');
    }
    if (this.toolsManager?.isEditing()) {
      return toast.show('Please finish or cancel active edits before reloading');
    }
    this.toolbar.setRawDecoding(true);
    toast.show('Loading full sensor decode…');
    try {
      const payload = await tauriBridge.readRawFullSensor(path);
      if (payload?.data_url) {
        const img = new Image();
        img.onload = () => {
          this.viewer.setImage(img);
          this.updateStatusBadges();
          toast.show('Full sensor decode loaded');
        };
        img.src = payload.data_url;
      }
    } catch (err) {
      toast.warn(`Full sensor decode failed: ${err}`);
    } finally {
      this.toolbar.setRawDecoding(false);
    }
  }

  handleEmptyState() {
    document.body.classList.remove('image-loaded');
    this.dropZoneEl.style.display = 'flex';
    this.viewer.setImage(null);
    this.filters.reset(); changeTracker.reset(); this.drawingTool?.clear();
    if (this.drawingTool?.active) this.toolsManager?.toggleDraw(false);
    if (this.cropper?.active) this.toolsManager?.toggleCrop(false);
    this.adjustmentsPanel.syncSliderUI(); this.metadataDrawer.hide();
    this.titlebar.setFileName(''); this.titlebar.setHasImage(false);
    this.toolbar.updateCounter(0, -1); this.idleController?.refreshState();
    this.toolbar.setRawFile(false);
  }

  handleNavigateBatch(delta) {
    if (this.toolsManager?.isEditing()) return toast.show('Please apply or cancel edits before navigating');
    this.confirmModal.promptIfDirty(() => this.fileLoader.navigateBatch(delta), () => this.saveImage());
  }

  handleRotate(deg) {
    if (this.drawingTool?.active || this.adjustmentsPanel?.isOpen()) return toast.show('Please finish or cancel active edits before transforming canvas');
    this.viewer.rotate(deg, this.cropper.active);
    this.toolsManager?.onTransformWhileCropping();
  }

  handleFlip(dir) {
    if (this.drawingTool?.active || this.adjustmentsPanel?.isOpen()) return toast.show('Please finish or cancel active edits before transforming canvas');
    if (dir === 'h') this.viewer.toggleFlipH(); else this.viewer.toggleFlipV();
    this.toolsManager?.onTransformWhileCropping();
  }

  async deleteCurrentFile(permanent = false) {
    if (this.toolsManager?.isEditing()) return toast.show('Please apply or cancel edits before deleting');
    const meta = this.fileLoader.currentMeta;
    if (!this.viewer.img || !meta) return;
    this.deleteModal.prompt({
      fileName: meta.name, isPermanent: permanent,
      onConfirm: async () => {
        try {
          const res = await this.fileLoader.deleteCurrent(!permanent);
          if (res?.success) { changeTracker.reset(); toast.show(permanent ? `Deleted ${res.deletedName}` : `Moved ${res.deletedName} to Recycle Bin`); }
        } catch (err) { toast.show(`Failed to delete: ${err}`); }
      },
    });
  }

  async wakeFromStandby() {
    // Restore Mode 1: resets body.mode-regular CSS, re-applies acrylic via setWindowVibrancy
    await this.windowModeManager.setMode(MODE_REGULAR);
    // Restore start page drop zone if no image is currently loaded
    if (!this.viewer.img) this.handleEmptyState();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new BukaakeApp();
});
