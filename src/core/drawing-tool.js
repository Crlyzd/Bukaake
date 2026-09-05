/**
 * Bukaake Interactive Drawing & Highlighting Engine
 * Vector/canvas freehand drawing tool supporting pen, highlighter, undo, and image baking (< 240 lines).
 */

export class DrawingTool {
  constructor(canvasElement, canvasViewer, options = {}) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.viewer = canvasViewer;
    this.onModified = options.onModified || null;
    this.cursorRing = document.getElementById('drawCursorRing');

    this.active = false;
    this.mode = 'pen'; // 'pen' | 'highlighter'
    this.color = '#00f0ff';
    this.size = 24;
    this.isDrawing = false;
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;

    this.strokes = [];
    this.currentStroke = null;

    this.initEvents();
  }

  initEvents() {
    this.canvas.addEventListener('mousedown', (e) => {
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
      const imgPt = this.viewer.screenToImageCoords(e.clientX - rect.left, e.clientY - rect.top);
      if (imgPt.x < 0 || imgPt.x > this.viewer.img.width || imgPt.y < 0 || imgPt.y > this.viewer.img.height) return;

      e.stopPropagation();
      this.isDrawing = true;
      const isHighlighter = this.mode === 'highlighter';
      const strokeSize = isHighlighter ? (20 / (this.viewer.scale || 1)) : this.size;
      this.currentStroke = {
        mode: this.mode, color: this.color, size: strokeSize, points: [imgPt],
      };
      this.strokes.push(this.currentStroke);
      this.redraw();
      this.onModified?.(true);
    });

    window.addEventListener('mousemove', (e) => {
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
      if (!this.isDrawing || !this.currentStroke) return;
      const rect = this.canvas.getBoundingClientRect();
      const imgPt = this.viewer.screenToImageCoords(e.clientX - rect.left, e.clientY - rect.top);
      this.currentStroke.points.push(imgPt);
      this.redraw();
    });

    window.addEventListener('mouseup', (e) => {
      if (this.isPanning) {
        this.isPanning = false;
        this.canvas.classList.remove('is-panning');
        this.updateCursor(e);
        this.viewer.snapBackToBounds(true);
      }
      if (this.isDrawing) {
        this.isDrawing = false;
        this.currentStroke = null;
      }
    });

    this.canvas.addEventListener('wheel', (e) => {
      if (!this.active || !this.viewer.img) return;
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      this.viewer.zoomTo(this.viewer.targetScale * zoomFactor, false, mx, my);
      this.updateCursor(e);
    }, { passive: false });

    this.canvas.addEventListener('auxclick', (e) => {
      if (e.button === 1) e.preventDefault();
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.cursorRing?.classList.add('hidden');
    });

    this.canvas.addEventListener('mouseenter', (e) => {
      this.updateCursor(e);
    });

    window.addEventListener('resize', () => {
      if (this.active) this.syncCanvasSize();
    });
  }

  updateCursor(e) {
    if (!this.active || this.isPanning || !e) return;
    const hitEl = (e.clientX !== undefined && e.clientY !== undefined)
      ? document.elementFromPoint(e.clientX, e.clientY) || e.target
      : e.target;
    const isOverChrome = Boolean(
      e.clientY <= 44 ||
      hitEl?.closest?.('#appTitlebar, .app-titlebar, #floatingToolbar, .floating-toolbar, #drawToolbar, .draw-toolbar, .draw-popover, .context-menu, .modal-backdrop, .dialog-card')
    );

    const rect = this.canvas.getBoundingClientRect();
    const pt = this.viewer.screenToImageCoords(e.clientX - rect.left, e.clientY - rect.top);
    const isOutside = pt.x < 0 || pt.x > this.viewer.img.width || pt.y < 0 || pt.y > this.viewer.img.height;

    if (isOverChrome || isOutside) {
      this.cursorRing?.classList.add('hidden');
      this.canvas.classList.remove('cursor-highlighter');
      return;
    }
    if (this.mode === 'pen') {
      this.canvas.classList.remove('cursor-highlighter');
      if (this.cursorRing) {
        const diam = Math.max(4, Math.round(this.size * this.viewer.scale));
        this.cursorRing.style.width = `${diam}px`;
        this.cursorRing.style.height = `${diam}px`;
        this.cursorRing.style.left = `${e.clientX}px`;
        this.cursorRing.style.top = `${e.clientY}px`;
        this.cursorRing.classList.remove('hidden');
      }
    } else {
      this.cursorRing?.classList.add('hidden');
      this.canvas.classList.add('cursor-highlighter');
    }
  }

  updateCursorMode() {
    if (!this.active) return;
    if (this.mode === 'highlighter') {
      this.cursorRing?.classList.add('hidden');
      this.canvas.classList.add('cursor-highlighter');
    } else {
      this.canvas.classList.remove('cursor-highlighter');
    }
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
    this.cursorRing?.classList.add('hidden');
    this.canvas.classList.remove('cursor-highlighter', 'is-panning');
    this.canvas.classList.add('hidden');
    this.clear();
  }

  setMode(mode) { this.mode = mode; this.updateCursorMode(); }
  setColor(hexColor) { this.color = hexColor; }

  setSize(sizePx) {
    this.size = sizePx;
    if (this.cursorRing && !this.cursorRing.classList.contains('hidden')) {
      const diam = Math.max(4, Math.round(this.size * this.viewer.scale));
      this.cursorRing.style.width = `${diam}px`;
      this.cursorRing.style.height = `${diam}px`;
    }
  }

  undo() {
    if (this.strokes.length > 0) {
      this.strokes.pop();
      this.redraw();
      this.onModified?.(this.strokes.length > 0);
    }
  }

  clear() {
    this.strokes = [];
    this.redraw();
    this.onModified?.(false);
  }

  hasStrokes() { return this.strokes.length > 0; }

  redraw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.active || !this.viewer.img || this.strokes.length === 0) return;

    this.ctx.save();
    const isVert = (this.viewer.rotation === 90 || this.viewer.rotation === 270);
    const imgW = (isVert ? this.viewer.img.height : this.viewer.img.width) * this.viewer.scale;
    const imgH = (isVert ? this.viewer.img.width : this.viewer.img.height) * this.viewer.scale;

    this.ctx.translate(this.viewer.panX + imgW / 2, this.viewer.panY + imgH / 2);
    this.ctx.scale(this.viewer.scale, this.viewer.scale);
    this.ctx.rotate((this.viewer.rotation * Math.PI) / 180);
    this.ctx.scale(this.viewer.flipH ? -1 : 1, this.viewer.flipV ? -1 : 1);
    this.ctx.translate(-this.viewer.img.width / 2, -this.viewer.img.height / 2);

    // Strictly clip drawing strokes to the image boundaries
    this.ctx.beginPath();
    this.ctx.rect(0, 0, this.viewer.img.width, this.viewer.img.height);
    this.ctx.clip();

    for (const stroke of this.strokes) {
      if (stroke.points?.length > 0) this._renderStroke(this.ctx, stroke);
    }

    this.ctx.restore();
  }

  _renderStroke(ctx, stroke) {
    ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    if (stroke.mode === 'highlighter') {
      ctx.globalAlpha = 0.40; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'; ctx.lineWidth = stroke.size;
      if (stroke.points.length === 1) {
        const p = stroke.points[0], w = Math.max(2, stroke.size / 3);
        ctx.fillRect(p.x - w / 2, p.y - stroke.size / 2, w, stroke.size);
        ctx.restore();
        return;
      }
    } else {
      ctx.globalAlpha = 1.0; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = stroke.size;
    }
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    ctx.stroke();
    ctx.restore();
  }

  bakeToImage() {
    if (!this.viewer.img || this.strokes.length === 0) return null;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = this.viewer.img.width;
    offCanvas.height = this.viewer.img.height;
    const octx = offCanvas.getContext('2d');
    octx.drawImage(this.viewer.img, 0, 0);

    octx.save();
    octx.beginPath();
    octx.rect(0, 0, this.viewer.img.width, this.viewer.img.height);
    octx.clip();
    for (const stroke of this.strokes) {
      if (stroke.points?.length > 0) this._renderStroke(octx, stroke);
    }
    octx.restore();

    const bakedImg = new Image();
    bakedImg.src = offCanvas.toDataURL('image/png');
    this.clear();
    return bakedImg;
  }
}
