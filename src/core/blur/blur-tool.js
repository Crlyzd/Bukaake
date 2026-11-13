/**
 * Bukaake Interactive Blur & Pixelate Tool Engine
 * Supports freehand brush, rectangle, circle/ellipse, feathering, undo/redo, and baking (< 300 lines).
 */

import { constrainAxis } from '../draw/stroke-smoother.js';
import { BlurEffectCache, clampToImage, constrainShapePoint, renderBlurItems, createBakedBlurImage } from './blur-renderer.js';

export class BlurTool {
  constructor(canvasElement, canvasViewer, options = {}) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.viewer = canvasViewer;
    this.onModified = options.onModified || null;
    this.onHistoryChange = options.onHistoryChange || null;
    this.cursorRing = document.getElementById('drawCursorRing');
    this.active = false;
    this.mode = 'blur';
    this.shape = 'brush';
    this.strength = 'med';
    this.feather = false;
    this.size = 32;
    this.isDrawing = false;
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;
    this.items = [];
    this.redoItems = [];
    this.currentItem = null;
    this.effectCache = new BlurEffectCache();
    this.scratchCanvas = document.createElement('canvas');
    this.initEvents();
    this.initKeyboard();
  }

  initKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (!this.active || ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '[' || e.key === ']') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('bukaake-blur-step-size', { detail: e.key === '[' ? -4 : 4 }));
      }
    });
  }

  initEvents() {
    this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    window.addEventListener('mousemove', (e) => this._onMouseMove(e));
    window.addEventListener('mouseup', (e) => this._onMouseUp(e));
    this.canvas.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
    this.canvas.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });
    this.canvas.addEventListener('mouseleave', () => this.cursorRing?.classList.add('hidden'));
    this.canvas.addEventListener('mouseenter', (e) => this.updateCursor(e));
    window.addEventListener('resize', () => { if (this.active) this.syncCanvasSize(); });
  }

  _onMouseDown(e) {
    if (!this.active || !this.viewer.img) return;
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
      this.isPanning = true;
      this.panStartX = e.clientX - this.viewer.panX;
      this.panStartY = e.clientY - this.viewer.panY;
      this.canvas.classList.add('is-panning');
      this.cursorRing?.classList.add('hidden');
      return;
    }
    if (e.button !== 0) return;

    const rect = this.canvas.getBoundingClientRect();
    let imgPt = this.viewer.screenToImageCoords(e.clientX - rect.left, e.clientY - rect.top);
    if (this.shape === 'brush') {
      if (imgPt.x < 0 || imgPt.x > this.viewer.img.width || imgPt.y < 0 || imgPt.y > this.viewer.img.height) return;
    } else {
      imgPt = clampToImage(this.viewer.img, imgPt);
    }

    e.stopPropagation();
    this.isDrawing = true;
    this.redoItems = [];
    this.currentItem = this.shape === 'brush'
      ? { mode: this.mode, shape: 'brush', strength: this.strength, feather: this.feather, size: this.size, points: [imgPt] }
      : { mode: this.mode, shape: this.shape, strength: this.strength, feather: this.feather, start: imgPt, end: { ...imgPt }, viewScale: this.viewer.scale || 1 };

    this.items.push(this.currentItem);
    this.redraw();
    this.onModified?.(true);
    this._notifyHistory();
  }

  _onMouseMove(e) {
    if (!this.active) return;
    if (this.isPanning) {
      this.viewer.panX = e.clientX - this.panStartX;
      this.viewer.panY = e.clientY - this.panStartY;
      this.viewer.targetPanX = this.viewer.panX;
      this.viewer.targetPanY = this.viewer.panY;
      this.viewer.render();
      this.viewer.onTransformChange?.();
      return;
    }
    this.updateCursor(e);
    if (!this.isDrawing || !this.currentItem) return;

    const rect = this.canvas.getBoundingClientRect();
    const rawPt = this.viewer.screenToImageCoords(e.clientX - rect.left, e.clientY - rect.top);

    if (this.currentItem.shape === 'brush') {
      const imgPt = (e.shiftKey || e.ctrlKey)
        ? constrainAxis(rawPt, this.currentItem.points[0], e.shiftKey, e.ctrlKey)
        : rawPt;
      this.currentItem.points.push(imgPt);
    } else {
      this.currentItem.end = constrainShapePoint(this.viewer.img, this.currentItem.start, rawPt, e.shiftKey);
      this.currentItem.viewScale = this.viewer.scale || 1;
    }
    this.redraw();
  }

  _onMouseUp(e) {
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.classList.remove('is-panning');
      this.updateCursor(e);
      this.viewer.snapBackToBounds(true);
    }
    if (this.isDrawing && this.currentItem) {
      if (this.currentItem.shape !== 'brush') {
        const w = Math.abs(this.currentItem.end.x - this.currentItem.start.x);
        const h = Math.abs(this.currentItem.end.y - this.currentItem.start.y);
        if (w < 2 || h < 2) {
          this.items.pop();
          this.onModified?.(this.items.length > 0);
          this._notifyHistory();
        }
      }
      this.isDrawing = false;
      this.currentItem = null;
      this.redraw();
    }
  }

  _onWheel(e) {
    if (!this.active || !this.viewer.img) return;
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const rect = this.canvas.getBoundingClientRect();
    this.viewer.zoomTo(this.viewer.targetScale * zoomFactor, false, e.clientX - rect.left, e.clientY - rect.top);
    this.updateCursor(e);
  }

  updateCursor(e) {
    if (!this.active || this.isPanning || !e) return;
    const hitEl = (e.clientX !== undefined && e.clientY !== undefined)
      ? document.elementFromPoint(e.clientX, e.clientY) || e.target : e.target;
    const isOverChrome = Boolean(
      e.clientY <= 44 ||
      hitEl?.closest?.('#appTitlebar, #floatingToolbar, #blurToolbar, .draw-popover, .context-menu, .modal-backdrop, .dialog-card')
    );
    const rect = this.canvas.getBoundingClientRect();
    const pt = this.viewer.screenToImageCoords(e.clientX - rect.left, e.clientY - rect.top);
    const isOutside = !this.viewer.img || pt.x < 0 || pt.x > this.viewer.img.width || pt.y < 0 || pt.y > this.viewer.img.height;

    if (isOverChrome || isOutside) {
      this.cursorRing?.classList.add('hidden');
      this.canvas.classList.remove('cursor-crosshair');
      return;
    }

    const isBrush = this.shape === 'brush';
    this.canvas.classList.toggle('cursor-crosshair', !isBrush);
    if (!this.cursorRing) return;
    if (isBrush) {
      this._syncRingSize();
      this.cursorRing.style.left = `${e.clientX}px`;
      this.cursorRing.style.top = `${e.clientY}px`;
      this.cursorRing.classList.remove('hidden');
    } else {
      this.cursorRing.classList.add('hidden');
    }
  }

  _syncRingSize() {
    if (!this.cursorRing) return;
    const diam = Math.max(4, Math.round(this.size * this.viewer.scale));
    this.cursorRing.style.width = `${diam}px`;
    this.cursorRing.style.height = `${diam}px`;
  }

  updateCursorMode() {
    if (!this.active) return;
    const isBrush = this.shape === 'brush';
    this.cursorRing?.classList.toggle('hidden', !isBrush);
    this.canvas.classList.toggle('cursor-crosshair', !isBrush);
  }

  syncCanvasSize() {
    const target = this.viewer.canvas || this.viewer.container;
    if (!target) return;
    const w = target.width || target.clientWidth;
    const h = target.height || target.clientHeight;
    if (w > 0 && h > 0 && (this.canvas.width !== w || this.canvas.height !== h)) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.redraw();
  }

  show() {
    if (!this.viewer.img) return;
    this.active = true;
    this.canvas.classList.remove('hidden');
    this.syncCanvasSize();
    this.updateCursorMode();
  }

  hide() {
    this.active = false;
    this.isDrawing = false;
    this.isPanning = false;
    this.currentItem = null;
    this.cursorRing?.classList.add('hidden');
    this.canvas.classList.remove('cursor-crosshair', 'is-panning');
    this.canvas.classList.add('hidden');
    this.clear();
    this.effectCache.clear();
  }

  setMode(mode) { this.mode = mode; }
  setShape(shape) { this.shape = shape; this.updateCursorMode(); }
  setStrength(strength) { this.strength = strength; }
  setFeather(feather) { this.feather = Boolean(feather); }

  setSize(sizePx) {
    this.size = sizePx;
    if (this.cursorRing && !this.cursorRing.classList.contains('hidden')) this._syncRingSize();
  }

  undo() {
    if (this.items.length === 0) return;
    this.redoItems.push(this.items.pop());
    this.redraw();
    this.onModified?.(this.items.length > 0);
    this._notifyHistory();
  }

  redo() {
    if (this.redoItems.length === 0) return;
    this.items.push(this.redoItems.pop());
    this.redraw();
    this.onModified?.(true);
    this._notifyHistory();
  }

  clear() {
    this.items = [];
    this.redoItems = [];
    this.redraw();
    this.onModified?.(false);
    this._notifyHistory();
  }

  _notifyHistory() {
    this.onHistoryChange?.({ canUndo: this.items.length > 0, canRedo: this.redoItems.length > 0 });
  }

  redraw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.active || !this.viewer.img || this.items.length === 0) return;

    this.ctx.save();
    const isVert = (this.viewer.rotation === 90 || this.viewer.rotation === 270);
    const imgW = (isVert ? this.viewer.img.height : this.viewer.img.width) * this.viewer.scale;
    const imgH = (isVert ? this.viewer.img.width : this.viewer.img.height) * this.viewer.scale;

    this.ctx.translate(this.viewer.panX + imgW / 2, this.viewer.panY + imgH / 2);
    this.ctx.scale(this.viewer.scale, this.viewer.scale);
    this.ctx.rotate((this.viewer.rotation * Math.PI) / 180);
    this.ctx.scale(this.viewer.flipH ? -1 : 1, this.viewer.flipV ? -1 : 1);
    this.ctx.translate(-this.viewer.img.width / 2, -this.viewer.img.height / 2);

    this.ctx.beginPath();
    this.ctx.rect(0, 0, this.viewer.img.width, this.viewer.img.height);
    this.ctx.clip();

    renderBlurItems(this.ctx, this.viewer.img, this.items, this.effectCache, this.scratchCanvas, this.currentItem);
    this.ctx.restore();
  }

  bakeToImage() {
    const baked = createBakedBlurImage(this.viewer.img, this.items, this.effectCache, this.scratchCanvas);
    if (baked) this.clear();
    return baked;
  }
}
