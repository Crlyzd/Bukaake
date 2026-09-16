/**
 * Bukaake Canvas Tools Manager
 * Orchestrates interactive crop, freehand drawing, and adjustments panel with strict exclusivity (< 110 lines).
 */

import { changeTracker } from './change-tracker.js';
import { toast } from '../components/toast.js';

export class CanvasToolsManager {
  constructor({ viewer, cropper, drawingTool, textTool, toolbar, fileLoader, adjustmentsPanel }) {
    this.viewer = viewer;
    this.cropper = cropper;
    this.drawingTool = drawingTool;
    this.textTool = textTool;
    this.toolbar = toolbar;
    this.fileLoader = fileLoader;
    this.adjustmentsPanel = adjustmentsPanel;
  }

  isEditing() {
    return Boolean(
      this.cropper?.active ||
      this.drawingTool?.active ||
      this.textTool?.active ||
      this.adjustmentsPanel?.isOpen()
    );
  }

  closeAdjustments() {
    if (this.adjustmentsPanel?.isOpen()) {
      this.adjustmentsPanel.hide();
      this.toolbar?.setAdjustmentsActive(false);
    }
  }

  toggleAdjustments() {
    const isOpening = !this.adjustmentsPanel?.isOpen();
    if (isOpening) {
      if (!this.viewer.img) return toast.show('Load an image first for adjustments');
      if (this.cropper?.active) this.toggleCrop(false);
      if (this.drawingTool?.active) this.toggleDraw(false);
      if (this.textTool?.active) this.toggleText(false);
    }
    const active = this.adjustmentsPanel?.toggle();
    this.toolbar?.setAdjustmentsActive(active);
    return active;
  }

  toggleCrop(forceState = null) {
    const should = forceState !== null ? forceState : !this.cropper.active;
    if (should) {
      if (!this.viewer.img) return toast.show('Load an image first to crop');
      if (this.drawingTool?.active) this.toggleDraw(false);
      if (this.textTool?.active) this.toggleText(false);
      this.closeAdjustments();
      this.viewer.setBottomInset(110, false);
      this.cropper.show();
      this.toolbar.setCropActive(true);
    } else {
      this.viewer.setBottomInset(0, true);
      this.cropper.hide();
      this.toolbar.setCropActive(false);
    }
  }

  onTransformWhileCropping() {
    if (this.cropper?.active) {
      this.cropper.onTransform();
    }
  }

  applyCrop(filters) {
    const rect = this.cropper.getCropTransformedRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return toast.show('Invalid crop area');
    const offCanvas = this.viewer.getProcessedCanvas(rect, filters.getFilterCssString());
    if (!offCanvas) return;
    const currentMeta = this.fileLoader.currentMeta || {};
    const img = new Image();
    img.onload = () => {
      this.fileLoader.loadDirectImage(img, {
        ...currentMeta,
        name: currentMeta.name || 'Cropped Image',
        naturalWidth: rect.width,
        naturalHeight: rect.height,
      });
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
      if (this.cropper?.active) this.toggleCrop(false);
      if (this.textTool?.active) this.toggleText(false);
      this.closeAdjustments();
      this.viewer.setBottomInset(110, false);
      this.drawingTool.show();
      this.toolbar.setDrawActive(true);
    } else {
      this.viewer.setBottomInset(0, true);
      this.drawingTool.hide();
      this.toolbar.setDrawActive(false);
      changeTracker.markDraw(false);
    }
  }

  applyDraw() {
    const baked = this.drawingTool.bakeToImage();
    if (!baked) return toast.show('No drawings to apply');
    const currentMeta = this.fileLoader.currentMeta || {};
    baked.onload = () => {
      this.fileLoader.loadDirectImage(baked, {
        ...currentMeta,
        name: currentMeta.name || 'Drawn Image',
      });
      this.toggleDraw(false);
      changeTracker.markDraw(true);
      toast.show('Applied drawing to image');
    };
  }

  toggleText(forceState = null) {
    const should = forceState !== null ? forceState : !this.textTool?.active;
    if (should) {
      if (!this.viewer.img) return toast.show('Load an image first to add text');
      if (this.cropper?.active) this.toggleCrop(false);
      if (this.drawingTool?.active) this.toggleDraw(false);
      this.closeAdjustments();
      this.viewer.setBottomInset(110, false);
      this.textTool?.show();
      this.toolbar.setTextActive(true);
    } else {
      this.viewer.setBottomInset(0, true);
      this.textTool?.hide();
      this.toolbar.setTextActive(false);
      changeTracker.markText(false);
    }
  }

  applyText() {
    const baked = this.textTool?.bakeToImage();
    if (!baked) return toast.show('No text to apply');
    const currentMeta = this.fileLoader.currentMeta || {};
    baked.onload = () => {
      this.fileLoader.loadDirectImage(baked, {
        ...currentMeta,
        name: currentMeta.name || 'Edited Image',
      });
      this.toggleText(false);
      changeTracker.markText(true);
      toast.show('Applied text to image');
    };
  }

  handleUndo() {
    if (this.textTool?.active) return this.textTool.undo();
    if (this.drawingTool?.active) return this.drawingTool.undo();
  }

  handleRedo() {
    if (this.textTool?.active) return this.textTool.redo();
    if (this.drawingTool?.active) return this.drawingTool.redo();
  }
}
