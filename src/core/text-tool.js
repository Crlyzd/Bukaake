/**
 * Bukaake Interactive Typography Engine
 * Text item lifecycle, overlay box, corner-resize font-sync, multi-tier magnetic snap, undo/redo (< 250 lines).
 */

import { renderVectorTextItem, applyStylesToTextInput, computeTextLayout, bakeTextToCanvas } from './text-renderer.js';
import { TextSnapper } from './text-snapping.js';
import { attachTextInteractions } from './text-events.js';

export class TextTool {
  constructor(canvasElement, canvasViewer, options = {}) {
    this.canvas = canvasElement; this.ctx = this.canvas.getContext('2d'); this.viewer = canvasViewer;
    this.overlayContainer = document.getElementById('textOverlayContainer');
    this.onModified = options.onModified || null; this.onHistoryChange = options.onHistoryChange || null;
    this.onActiveChange = options.onActiveChange || null; this.onReset = options.onReset || null;
    this.active = false; this.snapper = this.overlayContainer ? new TextSnapper(this.overlayContainer) : null;
    this.resetDefaults();
    attachTextInteractions(this);
  }

  resetDefaults() {
    this.items = []; this.undoStack = []; this.redoStack = []; this.activeItem = null; this.isEditing = false;
    this.currentFont = 'Inter, sans-serif'; this.currentColor = '#ffffff';
    this.currentBold = false; this.currentItalic = false; this.currentUnderline = false; this.currentStrike = false;
    this.currentShadow = { enabled: false, blur: 8, opacity: 0.85, offsetX: 2, offsetY: 4, color: '#000000' };
    this.currentBg = { enabled: false, color: '#0e121b', opacity: 0.85, roundness: 8, borderSize: 0, borderColor: '#ffffff' };
    this.currentSize = this.viewer?.img ? Math.max(16, Math.min(200, Math.round(Math.min(this.viewer.img.width, this.viewer.img.height) * 0.10))) : 36;
    this.overlayContainer?.querySelectorAll('.canvas-text-box').forEach((el) => el.remove());
    this.snapper?.clearGuides(); this.onActiveChange?.(null); this.onModified?.(false); this._notifyHistory(); this.onReset?.();
  }

  show() {
    if (!this.viewer.img) return;
    this.resetDefaults(); this.active = true;
    this.canvas.classList.remove('hidden'); this.overlayContainer?.classList.remove('hidden');
    this.syncCanvasSize(); this.createItemAt(Math.round(this.viewer.img.width / 2), Math.round(this.viewer.img.height / 2));
  }

  hide() {
    this.active = false; this.canvas.classList.add('hidden'); this.overlayContainer?.classList.add('hidden');
    this.resetDefaults(); this.redraw();
  }

  addNewTextBox() {
    if (!this.viewer.img) return;
    const cx = Math.round(this.viewer.canvas.width / 2);
    const cy = Math.round(this.viewer.canvas.height / 2);
    const pt = this.viewer.screenToImageCoords(cx, cy);
    const clampX = Math.max(0, Math.min(this.viewer.img.width, pt.x));
    const clampY = Math.max(0, Math.min(this.viewer.img.height, pt.y));
    this.createItemAt(clampX, clampY);
  }

  createItemAt(cx, cy) {
    this._pushHistory();
    const size = Math.max(16, Math.min(200, Math.round(Math.min(this.viewer.img.width, this.viewer.img.height) * 0.10)));
    const item = { id: `txt_${Date.now()}`, text: 'Type text...', font: this.currentFont, size, x: cx, y: cy,
      color: this.currentColor, bold: this.currentBold, italic: this.currentItalic, underline: this.currentUnderline,
      strike: this.currentStrike, shadow: { ...this.currentShadow }, bg: { ...this.currentBg } };
    const l = computeTextLayout(this.ctx, item);
    item.x = Math.round(cx - l.maxW / 2); item.y = Math.round(cy - l.textH / 2);
    this.items.push(item);
    this.selectItem(item, true);
    this.redraw(); this.onModified?.(true);
  }

  selectItem(item, selectAll = false, initialDragEvent = null) {
    this.commitActiveInput();
    this.activeItem = item; this.isEditing = selectAll;
    this.onActiveChange?.(item); this.renderOverlayInput(item, selectAll, initialDragEvent); this.redraw();
  }

  renderOverlayInput(item, selectAll = false, initialDragEvent = null) {
    if (!this.overlayContainer) return;
    this.overlayContainer.querySelectorAll('.canvas-text-box').forEach((el) => el.remove());
    if (!item) return;

    const box = document.createElement('div');
    box.className = 'canvas-text-box'; box.id = 'activeTextBox';
    const ta = document.createElement('textarea');
    ta.className = 'text-input-field'; ta.value = item.text; ta.rows = 1; ta.spellcheck = false;
    applyStylesToTextInput(box, ta, item, this.viewer.scale || 1);
    box.appendChild(ta);

    for (const dir of ['nw', 'ne', 'sw', 'se', 'ml', 'mr', 'tc', 'bc']) {
      const h = document.createElement('div');
      h.className = `text-handle text-handle-${dir}`; h.dataset.handle = dir;
      box.appendChild(h);
    }
    let isDragging = false, startMx = 0, startMy = 0, startX = item.x, startY = item.y, preDragSnap = null;
    const startDrag = (mx, my) => {
      isDragging = true; startMx = mx; startMy = my; startX = item.x; startY = item.y;
      preDragSnap = JSON.parse(JSON.stringify(this.items));
      box.classList.add('is-dragging');
    };
    if (initialDragEvent && !selectAll) startDrag(initialDragEvent.clientX, initialDragEvent.clientY);

    box.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const handle = e.target.closest('[data-handle]')?.dataset?.handle;
      if (handle) {
        e.preventDefault(); e.stopPropagation();
        const preResizeSnap = JSON.parse(JSON.stringify(this.items));
        const boxRect = box.getBoundingClientRect();
        const cx = boxRect.left + boxRect.width / 2, cy = boxRect.top + boxRect.height / 2;
        const l = computeTextLayout(this.ctx, item);
        const imgCx = l.boxX + l.boxW / 2, imgCy = l.boxY + l.boxH / 2;
        const isH = (handle === 'ml' || handle === 'mr'), isV = (handle === 'tc' || handle === 'bc');
        const startDist = isH ? Math.max(10, Math.abs(e.clientX - cx)) : isV ? Math.max(10, Math.abs(e.clientY - cy)) : Math.max(10, Math.hypot(e.clientX - cx, e.clientY - cy));
        const startSize = item.size;
        const onRM = (ev) => {
          const curDist = isH ? Math.abs(ev.clientX - cx) : isV ? Math.abs(ev.clientY - cy) : Math.hypot(ev.clientX - cx, ev.clientY - cy);
          item.size = Math.max(12, Math.min(200, Math.round(startSize * (curDist / startDist))));
          this.currentSize = item.size;
          applyStylesToTextInput(box, ta, item, this.viewer.scale || 1);
          const nl = computeTextLayout(this.ctx, item);
          item.x = Math.round(imgCx - (nl.boxW / 2 - nl.padX));
          item.y = Math.round(imgCy - (nl.boxH / 2 - nl.padY));
          this.updateOverlayBox(); this.redraw(); this.onActiveChange?.(item);
        };
        window.addEventListener('mousemove', onRM);
        window.addEventListener('mouseup', () => {
          window.removeEventListener('mousemove', onRM);
          this.currentSize = item.size; this.onActiveChange?.(item);
          if (item.size !== startSize) { this.undoStack.push(preResizeSnap); this.redoStack = []; this._notifyHistory(); }
        }, { once: true });
        return;
      }
      if (!this.isEditing || e.target !== ta) {
        e.preventDefault(); e.stopPropagation();
        startDrag(e.clientX, e.clientY);
      }
    });

    let preEditSnap = null;
    box.addEventListener('dblclick', (e) => {
      e.stopPropagation(); this.isEditing = true; box.classList.add('editing'); this.redraw();
      preEditSnap = JSON.parse(JSON.stringify(this.items));
      ta.focus();
      const len = ta.value.length;
      ta.setSelectionRange(len, len);
    });

    ta.addEventListener('blur', () => {
      this.isEditing = false; box.classList.remove('editing');
      const val = ta.value.trim() || 'Text';
      if (preEditSnap && item.text !== val) {
        this.undoStack.push(preEditSnap); this.redoStack = []; this._notifyHistory();
      }
      item.text = val; preEditSnap = null;
      this.updateOverlayBox(); this.redraw();
    });

    const onMove = (e) => {
      if (!isDragging) return;
      box.classList.add('is-dragging');
      const rawX = Math.round(startX + (e.clientX - startMx) / this.viewer.scale);
      const rawY = Math.round(startY + (e.clientY - startMy) / this.viewer.scale);
      const s = this.viewer.scale || 1, l = computeTextLayout(this.ctx, item);
      const offX = Math.round(l.padX * s), offY = Math.round(l.padY * s);
      const snap = this.snapper?.computeSnap(this.viewer, rawX, rawY, l.boxW * s, l.boxH * s, offX, offY) ?? { x: rawX, y: rawY, snapH: null, snapV: null };
      item.x = snap.x; item.y = snap.y;
      this.snapper?.updateGuides(this.viewer, snap.snapH, snap.snapV);
      this.updateOverlayBox(); this.redraw();
    };
    const onUp = () => {
      if (!isDragging) return;
      isDragging = false; box.classList.remove('is-dragging'); this.snapper?.clearGuides();
      if (preDragSnap && (item.x !== startX || item.y !== startY)) {
        this.undoStack.push(preDragSnap); this.redoStack = []; this._notifyHistory();
      }
      preDragSnap = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    ta.addEventListener('input', () => {
      item.text = ta.value;
      applyStylesToTextInput(box, ta, item, this.viewer.scale || 1);
      this.updateOverlayBox(); this.redraw(); this.onModified?.(true);
    });
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); ta.blur(); }
    });

    this.overlayContainer.appendChild(box);
    this.updateOverlayBox();
    if (selectAll) {
      this.isEditing = true; box.classList.add('editing'); this.redraw();
      preEditSnap = JSON.parse(JSON.stringify(this.items));
      setTimeout(() => { ta.focus(); ta.select(); }, 10);
    }
  }

  updateActiveItem(mutations, pushHistory = false) {
    if (!this.activeItem) return;
    if (typeof mutations === 'function') mutations(this.activeItem);
    else {
      for (const [k, v] of Object.entries(mutations)) {
        if (v && typeof v === 'object' && !Array.isArray(v) && this.activeItem[k]) Object.assign(this.activeItem[k], v);
        else this.activeItem[k] = v;
      }
    }
    const box = document.getElementById('activeTextBox'), ta = box?.querySelector('textarea');
    if (box) applyStylesToTextInput(box, ta, this.activeItem, this.viewer.scale || 1);
    this.updateOverlayBox(); this.redraw(); this.onModified?.(true);
    if (pushHistory) this._pushHistory();
  }

  updateOverlayBox() {
    const box = document.getElementById('activeTextBox');
    if (!box || !this.activeItem) return;
    const l = computeTextLayout(this.ctx, this.activeItem), pt = this.viewer.imageToScreenCoords(l.boxX, l.boxY), s = this.viewer.scale || 1;
    box.style.left = `${Math.round(pt.x)}px`; box.style.top = `${Math.round(pt.y)}px`;
    box.style.width = `${Math.round(l.boxW * s)}px`; box.style.height = `${Math.round(l.boxH * s)}px`;
    box.style.borderRadius = `${Math.round(l.roundness * s)}px`;
    const ta = box.querySelector('textarea');
    if (ta) applyStylesToTextInput(box, ta, this.activeItem, s);
  }

  commitActiveInput() {
    if (!this.activeItem) return;
    const ta = this.overlayContainer?.querySelector('textarea');
    if (ta) this.activeItem.text = ta.value.trim() || 'Text';
    this.activeItem = null; this.isEditing = false;
    this.overlayContainer?.querySelectorAll('.canvas-text-box').forEach((el) => el.remove());
    this.onActiveChange?.(null); this.redraw();
  }

  deleteActiveItem() {
    if (!this.activeItem) return;
    this._pushHistory();
    this.items = this.items.filter((it) => it !== this.activeItem);
    this.activeItem = null; this.isEditing = false;
    this.overlayContainer?.querySelectorAll('.canvas-text-box').forEach((el) => el.remove());
    this.onActiveChange?.(null); this.redraw(); this.onModified?.(this.items.length > 0);
  }

  _pushHistory() { this.undoStack.push(JSON.parse(JSON.stringify(this.items))); this.redoStack = []; this._notifyHistory(); }
  _applyHistoryStep(from, to, modifiedState) {
    if (from.length === 0) return;
    to.push(JSON.parse(JSON.stringify(this.items)));
    this.items = from.pop() || [];
    this.activeItem = null; this.isEditing = false;
    this.overlayContainer?.querySelectorAll('.canvas-text-box').forEach((el) => el.remove());
    this.onActiveChange?.(null); this.redraw(); this.onModified?.(modifiedState ?? this.items.length > 0); this._notifyHistory();
  }
  undo() { this._applyHistoryStep(this.undoStack, this.redoStack, null); } redo() { this._applyHistoryStep(this.redoStack, this.undoStack, true); }
  clear() { this.resetDefaults(); this.redraw(); }
  _notifyHistory() { this.onHistoryChange?.({ canUndo: this.undoStack.length > 0, canRedo: this.redoStack.length > 0 }); }

  syncCanvasSize() {
    const t = this.viewer.canvas || this.viewer.container;
    if (!t) return;
    const w = t.width || t.clientWidth, h = t.height || t.clientHeight;
    if (w > 0 && h > 0 && (this.canvas.width !== w || this.canvas.height !== h)) { this.canvas.width = w; this.canvas.height = h; }
    this.redraw();
  }

  redraw() {
    if (this.viewer.canvas && (this.canvas.width !== this.viewer.canvas.width || this.canvas.height !== this.viewer.canvas.height)) {
      this.canvas.width = this.viewer.canvas.width;
      this.canvas.height = this.viewer.canvas.height;
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.active || !this.viewer.img) return;
    this.ctx.save();
    const isVert = (this.viewer.rotation === 90 || this.viewer.rotation === 270);
    const imgW = (isVert ? this.viewer.img.height : this.viewer.img.width) * this.viewer.scale;
    const imgH = (isVert ? this.viewer.img.width : this.viewer.img.height) * this.viewer.scale;
    this.ctx.translate(this.viewer.panX + imgW / 2, this.viewer.panY + imgH / 2);
    this.ctx.scale(this.viewer.scale * (this.viewer.flipH ? -1 : 1), this.viewer.scale * (this.viewer.flipV ? -1 : 1));
    this.ctx.rotate((this.viewer.rotation * Math.PI) / 180);
    this.ctx.translate(-this.viewer.img.width / 2, -this.viewer.img.height / 2);
    for (const item of this.items) {
      const isEditing = (item === this.activeItem && this.isEditing);
      renderVectorTextItem(this.ctx, item, null, isEditing);
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
