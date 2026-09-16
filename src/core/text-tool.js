/**
 * Bukaake Interactive Typography Engine
 * Text item lifecycle, overlay box, corner-resize font-sync, multi-tier magnetic snap, undo/redo (< 300 lines).
 */

import { renderVectorTextItem, applyStylesToTextInput, autoSizeTextarea, measureTextDimensions, hitTestTextItems, bakeTextToCanvas } from './text-renderer.js';
import { TextSnapper } from './text-snapping.js';

export class TextTool {
  constructor(canvasElement, canvasViewer, options = {}) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.viewer = canvasViewer;
    this.overlayContainer = document.getElementById('textOverlayContainer');
    this.onModified = options.onModified || null;
    this.onHistoryChange = options.onHistoryChange || null;
    this.onActiveChange = options.onActiveChange || null;

    this.active = false;
    this.items = [];
    this.activeItem = null;
    this.undoStack = [];
    this.redoStack = [];

    // Typography presets
    this.currentFont = 'Inter, sans-serif'; this.currentSize = 36; this.currentColor = '#ffffff';
    this.currentBold = false; this.currentItalic = false; this.currentUnderline = false; this.currentStrike = false;
    this.currentShadow = { enabled: false, blur: 8, opacity: 0.85, offsetX: 2, offsetY: 4, color: '#000000' };
    this.currentBg = { enabled: false, color: '#0e121b', opacity: 0.85, roundness: 8, borderSize: 0, borderColor: '#ffffff' };
    this.snapper = this.overlayContainer ? new TextSnapper(this.overlayContainer) : null;
    this.initEvents();
  }

  initEvents() {
    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.active || !this.viewer.img || e.button !== 0) return;
      const rect = this.canvas.getBoundingClientRect();
      const pt = this.viewer.screenToImageCoords(e.clientX - rect.left, e.clientY - rect.top);
      if (pt.x < 0 || pt.x > this.viewer.img.width || pt.y < 0 || pt.y > this.viewer.img.height) return;

      const hit = hitTestTextItems(this.items, pt.x, pt.y);
      if (hit) this.selectItem(hit);
      else this.commitActiveInput();
    });

    window.addEventListener('resize', () => { if (this.active) { this.syncCanvasSize(); this.updateOverlayBox(); } });
  }

  show() {
    if (!this.viewer.img) return;
    this.active = true;
    this.canvas.classList.remove('hidden');
    this.overlayContainer?.classList.remove('hidden');
    this.syncCanvasSize();
    if (this.items.length === 0) {
      this.createItemAt(Math.round(this.viewer.img.width / 2), Math.round(this.viewer.img.height / 2));
    } else {
      this.selectItem(this.items[this.items.length - 1], false);
    }
  }

  hide() {
    this.commitActiveInput();
    this.active = false; this.activeItem = null;
    this.canvas.classList.add('hidden');
    this.overlayContainer?.classList.add('hidden');
    this.overlayContainer?.querySelectorAll('.canvas-text-box').forEach((el) => el.remove());
    this.snapper?.clearGuides();
    this.clear();
  }

  createItemAt(cx, cy) {
    this._pushHistory();
    const size = Math.max(16, Math.min(200, Math.round(Math.min(this.viewer.img.width, this.viewer.img.height) * 0.10)));
    const dims = measureTextDimensions(this.ctx, 'Type text...', this.currentFont, size, this.currentBold, this.currentItalic, 1);
    const item = {
      id: `txt_${Date.now()}`, text: 'Type text...', font: this.currentFont, size,
      x: Math.round(cx - dims.width / 2), y: Math.round(cy - dims.height / 2),
      color: this.currentColor, bold: this.currentBold, italic: this.currentItalic,
      underline: this.currentUnderline, strike: this.currentStrike,
      shadow: { ...this.currentShadow }, bg: { ...this.currentBg }
    };
    this.items.push(item);
    this.selectItem(item, true);
    this.redraw();
    this.onModified?.(true);
  }

  selectItem(item, selectAll = false) {
    this.commitActiveInput();
    this.activeItem = item;
    this.onActiveChange?.(item);
    this.renderOverlayInput(item, selectAll);
    this.redraw();
  }

  renderOverlayInput(item, selectAll = false) {
    if (!this.overlayContainer) return;
    this.overlayContainer.querySelectorAll('.canvas-text-box').forEach((el) => el.remove());
    if (!item) return;

    const box = document.createElement('div');
    box.className = 'canvas-text-box';
    box.id = 'activeTextBox';

    const ta = document.createElement('textarea');
    ta.className = 'text-input-field';
    ta.value = item.text;
    ta.rows = 1;
    ta.spellcheck = false;

    applyStylesToTextInput(box, ta, item, this.viewer.scale || 1);
    box.appendChild(ta);

    // Canva-style corner handles, side pills & top/bottom dots
    for (const dir of ['nw', 'ne', 'sw', 'se', 'ml', 'mr', 'tc', 'bc']) {
      const h = document.createElement('div');
      h.className = `text-handle text-handle-${dir}`;
      h.dataset.handle = dir;
      box.appendChild(h);
    }

    let isDragging = false, startMx = 0, startMy = 0, startX = item.x, startY = item.y;

    box.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const handle = e.target.closest('[data-handle]')?.dataset?.handle;
      if (handle) {
        // Center-anchored resize: scales symmetrically around box center
        e.preventDefault(); e.stopPropagation();
        const boxRect = box.getBoundingClientRect();
        const cx = boxRect.left + boxRect.width / 2, cy = boxRect.top + boxRect.height / 2;
        const initDims = measureTextDimensions(this.ctx, item.text, item.font, item.size, item.bold, item.italic, 1);
        const imgCx = item.x + initDims.width / 2, imgCy = item.y + initDims.height / 2;
        const isH = (handle === 'ml' || handle === 'mr'), isV = (handle === 'tc' || handle === 'bc');
        const startDist = isH ? Math.max(10, Math.abs(e.clientX - cx)) : isV ? Math.max(10, Math.abs(e.clientY - cy)) : Math.max(10, Math.hypot(e.clientX - cx, e.clientY - cy));
        const startSize = item.size;
        const onRM = (ev) => {
          const curDist = isH ? Math.abs(ev.clientX - cx) : isV ? Math.abs(ev.clientY - cy) : Math.hypot(ev.clientX - cx, ev.clientY - cy);
          item.size = Math.max(12, Math.min(200, Math.round(startSize * (curDist / startDist))));
          this.currentSize = item.size;
          applyStylesToTextInput(box, ta, item, this.viewer.scale || 1);
          this._autoSizeTextarea(ta, item);
          const newDims = measureTextDimensions(this.ctx, item.text, item.font, item.size, item.bold, item.italic, 1);
          item.x = Math.round(imgCx - newDims.width / 2);
          item.y = Math.round(imgCy - newDims.height / 2);
          this.updateOverlayBox();
          this.redraw();
          const badge = document.getElementById('textSizeBadge');
          if (badge) badge.textContent = `${item.size}px`;
        };
        window.addEventListener('mousemove', onRM);
        window.addEventListener('mouseup', () => {
          window.removeEventListener('mousemove', onRM);
          this.currentSize = item.size;
          this._pushHistory();
        }, { once: true });
        return;
      }
      if (!box.classList.contains('editing') || e.target !== ta) {
        e.preventDefault(); e.stopPropagation();
        isDragging = true; startMx = e.clientX; startMy = e.clientY;
        startX = item.x; startY = item.y;
      }
    });

    box.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      box.classList.add('editing');
      ta.focus();
      ta.select();
    });

    ta.addEventListener('blur', () => {
      box.classList.remove('editing');
      item.text = ta.value.trim() || 'Text';
      this.redraw();
    });

    const onMove = (e) => {
      if (!isDragging) return;
      const rawX = Math.round(startX + (e.clientX - startMx) / this.viewer.scale);
      const rawY = Math.round(startY + (e.clientY - startMy) / this.viewer.scale);
      const bRect = box.getBoundingClientRect();
      const snap = this.snapper?.computeSnap(this.viewer, rawX, rawY, bRect.width, bRect.height) ?? { x: rawX, y: rawY, snapH: null, snapV: null };
      item.x = snap.x; item.y = snap.y;
      this.snapper?.updateGuides(this.viewer, snap.snapH, snap.snapV);
      this.updateOverlayBox(); this.redraw();
    };
    const onUp = () => { if (isDragging) { isDragging = false; this.snapper?.clearGuides(); this._pushHistory(); } };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    ta.addEventListener('input', () => {
      item.text = ta.value;
      this._autoSizeTextarea(ta, item);
      this.updateOverlayBox();
      this.redraw();
      this.onModified?.(true);
    });

    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); box.classList.remove('editing'); ta.blur(); }
    });

    this.overlayContainer.appendChild(box);
    this._autoSizeTextarea(ta, item);
    this.updateOverlayBox();
    setTimeout(() => {
      this._autoSizeTextarea(ta, item);
      if (selectAll) { box.classList.add('editing'); ta.focus(); ta.select(); }
    }, 10);
  }

  _autoSizeTextarea(ta, item) {
    autoSizeTextarea(this.ctx, ta, item || this.activeItem, this.viewer.scale || 1);
  }

  updateOverlayBox() {
    const box = document.getElementById('activeTextBox');
    if (!box || !this.activeItem) return;
    const pt = this.viewer.imageToScreenCoords(this.activeItem.x, this.activeItem.y);
    const s = this.viewer.scale || 1;
    const offX = this.activeItem.bg?.enabled ? Math.round(8 * s) + 2 : 4;
    const offY = this.activeItem.bg?.enabled ? Math.round(4 * s) + 2 : 2;
    box.style.left = `${Math.round(pt.x) - offX}px`;
    box.style.top = `${Math.round(pt.y) - offY}px`;
  }

  commitActiveInput() {
    if (!this.activeItem) return;
    const ta = this.overlayContainer?.querySelector('textarea');
    if (ta) this.activeItem.text = ta.value.trim() || 'Text';
    this.activeItem = null;
    this.overlayContainer?.querySelectorAll('.canvas-text-box').forEach((el) => el.remove());
    this.onActiveChange?.(null);
    this.redraw();
  }

  _pushHistory() {
    this.undoStack.push(JSON.parse(JSON.stringify(this.items)));
    this.redoStack = [];
    this._notifyHistory();
  }

  _applyHistoryStep(from, to, modifiedState) {
    if (from.length === 0) return;
    to.push(JSON.parse(JSON.stringify(this.items)));
    this.items = from.pop() || [];
    this.activeItem = null;
    this.overlayContainer?.querySelectorAll('.canvas-text-box').forEach((el) => el.remove());
    this.redraw();
    this.onModified?.(modifiedState ?? this.items.length > 0);
    this._notifyHistory();
  }

  undo() { this._applyHistoryStep(this.undoStack, this.redoStack, null); }
  redo() { this._applyHistoryStep(this.redoStack, this.undoStack, true); }
  clear() {
    this.items = []; this.undoStack = []; this.redoStack = []; this.activeItem = null;
    this.overlayContainer?.querySelectorAll('.canvas-text-box').forEach((el) => el.remove());
    this.redraw(); this.onModified?.(false); this._notifyHistory();
  }
  _notifyHistory() { this.onHistoryChange?.({ canUndo: this.undoStack.length > 0, canRedo: this.redoStack.length > 0 }); }

  syncCanvasSize() {
    const t = this.viewer.canvas || this.viewer.container;
    if (!t) return;
    const w = t.width || t.clientWidth, h = t.height || t.clientHeight;
    if (w > 0 && h > 0 && (this.canvas.width !== w || this.canvas.height !== h)) { this.canvas.width = w; this.canvas.height = h; }
    this.redraw();
  }

  redraw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.active || !this.viewer.img) return;
    this.ctx.save();
    const isVert = (this.viewer.rotation === 90 || this.viewer.rotation === 270);
    const imgW = (isVert ? this.viewer.img.height : this.viewer.img.width) * this.viewer.scale;
    const imgH = (isVert ? this.viewer.img.width : this.viewer.img.height) * this.viewer.scale;
    this.ctx.translate(this.viewer.panX + imgW / 2, this.viewer.panY + imgH / 2);
    this.ctx.scale(this.viewer.scale, this.viewer.scale);
    this.ctx.rotate((this.viewer.rotation * Math.PI) / 180);
    this.ctx.scale(this.viewer.flipH ? -1 : 1, this.viewer.flipV ? -1 : 1);
    this.ctx.translate(-this.viewer.img.width / 2, -this.viewer.img.height / 2);
    for (const item of this.items) {
      if (item !== this.activeItem) renderVectorTextItem(this.ctx, item);
    }
    this.ctx.restore();
    this.updateOverlayBox();
  }

  bakeToImage() {
    this.commitActiveInput();
    const b = bakeTextToCanvas(this.viewer, this.items);
    if (b) this.clear(); return b;
  }
}
