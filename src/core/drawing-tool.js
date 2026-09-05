/**
 * Bukaake Interactive Drawing & Highlighting Engine
 * Vector/canvas freehand drawing tool supporting pen, highlighter, undo, and image baking (< 220 lines).
 */

export class DrawingTool {
  constructor(canvasElement, canvasViewer, options = {}) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.viewer = canvasViewer;
    this.onModified = options.onModified || null;

    this.active = false;
    this.mode = 'pen'; // 'pen' | 'highlighter'
    this.color = '#00f0ff';
    this.size = 6;
    this.isDrawing = false;

    this.strokes = [];
    this.currentStroke = null;

    this.initEvents();
  }

  initEvents() {
    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.active || !this.viewer.img || e.button !== 0) return;
      e.stopPropagation();
      this.isDrawing = true;
      const imgPt = this.viewer.screenToImageCoords(e.clientX, e.clientY);
      this.currentStroke = {
        mode: this.mode,
        color: this.color,
        size: this.size,
        points: [imgPt],
      };
      this.strokes.push(this.currentStroke);
      this.redraw();
      this.onModified?.(true);
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.active || !this.isDrawing || !this.currentStroke) return;
      const imgPt = this.viewer.screenToImageCoords(e.clientX, e.clientY);
      this.currentStroke.points.push(imgPt);
      this.redraw();
    });

    window.addEventListener('mouseup', () => {
      if (this.isDrawing) {
        this.isDrawing = false;
        this.currentStroke = null;
      }
    });

    window.addEventListener('resize', () => {
      if (this.active) this.syncCanvasSize();
    });
  }

  syncCanvasSize() {
    if (!this.viewer.container) return;
    const w = this.viewer.container.clientWidth;
    const h = this.viewer.container.clientHeight;
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
  }

  hide() {
    this.active = false;
    this.isDrawing = false;
    this.canvas.classList.add('hidden');
  }

  setMode(mode) {
    this.mode = mode;
  }

  setColor(hexColor) {
    this.color = hexColor;
  }

  setSize(sizePx) {
    this.size = sizePx;
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

  hasStrokes() {
    return this.strokes.length > 0;
  }

  redraw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.active || !this.viewer.img || this.strokes.length === 0) return;

    this.ctx.save();
    this.ctx.translate(this.viewer.panX, this.viewer.panY);
    this.ctx.scale(this.viewer.scale, this.viewer.scale);

    const cx = this.viewer.img.width / 2;
    const cy = this.viewer.img.height / 2;
    this.ctx.translate(cx, cy);
    this.ctx.rotate((this.viewer.rotation * Math.PI) / 180);
    this.ctx.scale(this.viewer.flipH ? -1 : 1, this.viewer.flipV ? -1 : 1);
    this.ctx.translate(-cx, -cy);

    for (const stroke of this.strokes) {
      if (!stroke.points || stroke.points.length === 0) continue;
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.strokeStyle = stroke.color;

      if (stroke.mode === 'highlighter') {
        this.ctx.globalAlpha = 0.38;
        this.ctx.lineWidth = stroke.size * 2.6;
      } else {
        this.ctx.globalAlpha = 1.0;
        this.ctx.lineWidth = stroke.size;
      }

      this.ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        this.ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      this.ctx.stroke();
      this.ctx.restore();
    }

    this.ctx.restore();
  }

  bakeToImage() {
    if (!this.viewer.img || this.strokes.length === 0) return null;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = this.viewer.img.width;
    offCanvas.height = this.viewer.img.height;
    const octx = offCanvas.getContext('2d');

    octx.drawImage(this.viewer.img, 0, 0);

    for (const stroke of this.strokes) {
      if (!stroke.points || stroke.points.length === 0) continue;
      octx.save();
      octx.beginPath();
      octx.lineCap = 'round';
      octx.lineJoin = 'round';
      octx.strokeStyle = stroke.color;

      if (stroke.mode === 'highlighter') {
        octx.globalAlpha = 0.38;
        octx.lineWidth = stroke.size * 2.6;
      } else {
        octx.globalAlpha = 1.0;
        octx.lineWidth = stroke.size;
      }

      octx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        octx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      octx.stroke();
      octx.restore();
    }

    const bakedImg = new Image();
    bakedImg.src = offCanvas.toDataURL('image/png');
    this.clear();
    return bakedImg;
  }
}
