/**
 * Bukaake Canvas Viewer Engine
 * 60 FPS HTML5 Canvas pan, zoom, rotations, flips, and LERP physics
 */

import { screenToImage, renderOffscreenCanvas, calculatePanBounds, computeRubberDamping } from './canvas-helpers.js';
import { attachCanvasInteractions } from './canvas-events.js';

export class CanvasViewer {
  constructor(canvasElement, viewportContainer) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.container = viewportContainer;

    this.img = null;
    this.scale = 1.0; this.targetScale = 1.0;
    this.panX = 0; this.panY = 0;
    this.targetPanX = 0; this.targetPanY = 0;
    this.isAnimating = false; this.animFrameId = null;

    this.velocityX = 0; this.velocityY = 0;
    this.lastMouseX = 0; this.lastMouseY = 0; this.lastMouseTime = 0;

    this.rotation = 0; this.flipH = false; this.flipV = false;
    this.pixelSmoothing = true; this.isPanning = false;
    this.startX = 0; this.startY = 0; this.currentFilterCss = '';
    this.bottomInset = 0;
    this.onTransformChange = null;
    attachCanvasInteractions(this);
    this.resizeCanvas();
  }

  resizeCanvas() {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;

    if (w > 0 && h > 0 && (this.canvas.width !== w || this.canvas.height !== h)) {
      const oldW = this.canvas.width;
      const oldH = this.canvas.height;
      this.canvas.width = w;
      this.canvas.height = h;

      if (oldW > 0 && oldH > 0 && this.img) {
        const dx = (w - oldW) / 2;
        const dy = (h - oldH) / 2;
        this.panX += dx;
        this.targetPanX += dx;
        this.panY += dy;
        this.targetPanY += dy;
      }
      this.render();
      this.onTransformChange?.();
    }
  }

  startSmoothAnimation() {
    if (this.isAnimating) return;
    this.isAnimating = true;

    const animateStep = () => {
      const lerp = 0.16;
      const friction = 0.94;

      if (Math.hypot(this.velocityX, this.velocityY) > 0.05) {
        this.targetPanX += this.velocityX;
        this.targetPanY += this.velocityY;
        this.velocityX *= friction;
        this.velocityY *= friction;
      } else {
        this.velocityX = 0;
        this.velocityY = 0;
      }

      const ds = this.targetScale - this.scale;
      const dx = this.targetPanX - this.panX;
      const dy = this.targetPanY - this.panY;

      if (Math.abs(ds) < 0.0001 && Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05 && Math.hypot(this.velocityX, this.velocityY) < 0.05) {
        this.scale = this.targetScale;
        this.panX = this.targetPanX;
        this.panY = this.targetPanY;
        this.isAnimating = false;
        this.animFrameId = null;
        this.render();
        this.onTransformChange?.();
        return;
      }

      this.scale += ds * lerp;
      this.panX += dx * lerp;
      this.panY += dy * lerp;

      this.render();
      this.onTransformChange?.();
      this.animFrameId = requestAnimationFrame(animateStep);
    };

    this.animFrameId = requestAnimationFrame(animateStep);
  }

  setImage(img) {
    this.img = img;
    this.rotation = 0;
    this.flipH = false;
    this.flipV = false;
    this.currentFilterCss = '';
    this.fitToScreen(true);
  }

  calculateFitScale(bottomInset = this.bottomInset) {
    if (!this.img) return 1.0;
    const isVert = (this.rotation === 90 || this.rotation === 270);
    const w = isVert ? this.img.height : this.img.width;
    const h = isVert ? this.img.width : this.img.height;
    const isViewer = document.body.classList.contains('mode-viewer');
    const availW = isViewer ? (this.canvas.width * 0.75) : Math.max(100, this.canvas.width - 48);
    const availH = isViewer ? (this.canvas.height * 0.75) : Math.max(100, this.canvas.height - 48 - bottomInset);
    return Math.min(availW / w, availH / h, 1.0);
  }

  fitToScreen(instant = false) {
    if (!this.img) return;
    const fitScale = this.calculateFitScale(this.bottomInset);
    const isVert = (this.rotation === 90 || this.rotation === 270);
    const imgW = (isVert ? this.img.height : this.img.width) * fitScale;
    const imgH = (isVert ? this.img.width : this.img.height) * fitScale;

    this.velocityX = 0;
    this.velocityY = 0;
    this.targetScale = fitScale;
    this.targetPanX = (this.canvas.width - imgW) / 2;
    this.targetPanY = (this.canvas.height - this.bottomInset - imgH) / 2;

    if (instant) {
      this.scale = this.targetScale;
      this.panX = this.targetPanX;
      this.panY = this.targetPanY;
      this.render();
      this.onTransformChange?.();
    } else {
      this.startSmoothAnimation();
    }
  }

  zoomTo(targetScale, instant = false, anchorX = null, anchorY = null) {
    if (!this.img) return;
    const cx = anchorX !== null ? anchorX : (this.canvas.width / 2);
    const cy = anchorY !== null ? anchorY : (this.canvas.height / 2);
    const newScale = Math.max(0.05, Math.min(targetScale, 50.0));

    this.targetPanX = cx - (cx - this.targetPanX) * (newScale / this.targetScale);
    this.targetPanY = cy - (cy - this.targetPanY) * (newScale / this.targetScale);
    this.targetScale = newScale;
    this.snapBackToBounds(false);

    if (instant) {
      this.scale = this.targetScale;
      this.panX = this.targetPanX;
      this.panY = this.targetPanY;
      this.render();
      this.onTransformChange?.();
    }
  }

  centerImage(instant = false) {
    if (!this.img) return;
    const isVert = (this.rotation === 90 || this.rotation === 270);
    const imgW = (isVert ? this.img.height : this.img.width) * this.targetScale;
    const imgH = (isVert ? this.img.width : this.img.height) * this.targetScale;

    this.velocityX = 0;
    this.velocityY = 0;
    this.targetPanX = (this.canvas.width - imgW) / 2;
    this.targetPanY = (this.canvas.height - this.bottomInset - imgH) / 2;

    if (instant) {
      this.panX = this.targetPanX;
      this.panY = this.targetPanY;
      this.render();
      this.onTransformChange?.();
    } else {
      this.startSmoothAnimation();
    }
  }

  setBottomInset(pixels, animated = true) {
    this.bottomInset = pixels;
    this.fitToScreen(!animated);
  }

  getPanBounds(scale = this.scale) {
    return calculatePanBounds(this.canvas, this.img, scale, this.rotation, this.bottomInset);
  }

  applyRubberDamping(rawX, rawY) {
    return computeRubberDamping(rawX, rawY, this.getPanBounds(this.scale));
  }

  snapBackToBounds(withInertia = false) {
    if (!this.img) return;
    const bounds = this.getPanBounds(this.targetScale);
    const baseX = withInertia ? (this.panX + this.velocityX * 2) : this.targetPanX;
    const baseY = withInertia ? (this.panY + this.velocityY * 2) : this.targetPanY;
    this.targetPanX = Math.max(bounds.minX, Math.min(bounds.maxX, baseX));
    this.targetPanY = Math.max(bounds.minY, Math.min(bounds.maxY, baseY));
    this.velocityX = 0;
    this.velocityY = 0;
    this.startSmoothAnimation();
  }

  rotate(deg) {
    if (!this.img) return;
    this.rotation = (this.rotation + deg + 360) % 360;
    this.fitToScreen(false);
  }

  toggleFlipH() { this.flipH = !this.flipH; this.render(); }
  toggleFlipV() { this.flipV = !this.flipV; this.render(); }

  togglePixelSmoothing() {
    this.pixelSmoothing = !this.pixelSmoothing;
    this.render();
    return this.pixelSmoothing;
  }

  render(filterCss = null) {
    if (filterCss !== null) this.currentFilterCss = filterCss;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.img) return;

    this.ctx.save();
    this.ctx.imageSmoothingEnabled = this.pixelSmoothing;
    if (this.currentFilterCss) this.ctx.filter = this.currentFilterCss;

    const isVert = (this.rotation === 90 || this.rotation === 270);
    const imgW = (isVert ? this.img.height : this.img.width) * this.scale;
    const imgH = (isVert ? this.img.width : this.img.height) * this.scale;

    this.ctx.translate(this.panX + imgW / 2, this.panY + imgH / 2);
    this.ctx.scale(this.scale, this.scale);
    this.ctx.rotate((this.rotation * Math.PI) / 180);
    this.ctx.scale(this.flipH ? -1 : 1, this.flipV ? -1 : 1);

    this.ctx.drawImage(this.img, -this.img.width / 2, -this.img.height / 2);
    this.ctx.restore();
  }

  isPointInsideImage(screenX, screenY) {
    if (!this.img) return false;
    const isVert = (this.rotation === 90 || this.rotation === 270);
    const w = (isVert ? this.img.height : this.img.width) * this.scale;
    const h = (isVert ? this.img.width : this.img.height) * this.scale;
    return (
      screenX >= this.panX &&
      screenX <= this.panX + w &&
      screenY >= this.panY &&
      screenY <= this.panY + h
    );
  }

  screenToImageCoords(sx, sy) {
    if (!this.img) return { x: 0, y: 0 };
    const isVert = (this.rotation === 90 || this.rotation === 270);
    const imgW = (isVert ? this.img.height : this.img.width) * this.scale;
    const imgH = (isVert ? this.img.width : this.img.height) * this.scale;
    const cx = this.panX + imgW / 2;
    const cy = this.panY + imgH / 2;
    const dx = (sx - cx) / this.scale;
    const dy = (sy - cy) / this.scale;
    const rad = (-this.rotation * Math.PI) / 180;
    const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
    const fx = this.flipH ? -rx : rx;
    const fy = this.flipV ? -ry : ry;
    return {
      x: Math.round(fx + this.img.width / 2),
      y: Math.round(fy + this.img.height / 2),
    };
  }

  getProcessedCanvas(cropRect = null, filterCss = '') {
    return renderOffscreenCanvas(this.img, {
      rotation: this.rotation,
      flipH: this.flipH,
      flipV: this.flipV,
      pixelSmoothing: this.pixelSmoothing,
      cropRect,
      filterCss,
    });
  }
}
