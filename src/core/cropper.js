/**
 * Bukaake Interactive Crop Engine
 * Overlay box with draggable handles and aspect ratio constraints
 */

import { CropSnapper } from './crop-snapping.js';

export class CropperTool {
  constructor(overlayContainer, cropBox, dimensionsTag, canvasViewer) {
    this.container = overlayContainer;
    this.box = cropBox;
    this.tag = dimensionsTag;
    this.viewer = canvasViewer;
    this.snapper = new CropSnapper(overlayContainer);

    this.active = false;
    this.aspectRatio = null;

    this.isDraggingBox = false;
    this.activeHandle = null;
    this.startMouseX = 0;
    this.startMouseY = 0;
    this.startBoxState = { left: 0, top: 0, width: 0, height: 0 };

    this.initEvents();
  }

  initEvents() {
    this.box.addEventListener('mousedown', (e) => {
      if (!this.active) return;
      e.stopPropagation();

      const handle = e.target.getAttribute('data-handle');
      if (handle) {
        this.activeHandle = handle;
      } else {
        this.isDraggingBox = true;
      }

      this.startMouseX = e.clientX;
      this.startMouseY = e.clientY;
      this.startBoxState = {
        left: this.box.offsetLeft,
        top: this.box.offsetTop,
        width: this.box.offsetWidth,
        height: this.box.offsetHeight,
      };
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.active) return;
      if (!this.isDraggingBox && !this.activeHandle) return;

      const dx = e.clientX - this.startMouseX;
      const dy = e.clientY - this.startMouseY;
      let { left, top, width, height } = this.startBoxState;
      const img = this.getImageScreenBounds();
      let snappedX = false, snappedY = false;

      if (this.isDraggingBox) {
        const res = this.snapper.snapBoxDrag(this.startBoxState, dx, dy, img, e.shiftKey);
        left = res.left;
        top = res.top;
        width = res.width;
        height = res.height;
        snappedX = res.snappedX;
        snappedY = res.snappedY;
      } else if (this.activeHandle) {
        const res = this.snapper.snapHandleResize(
          this.activeHandle, this.startBoxState, dx, dy, img, e.shiftKey, this.aspectRatio
        );
        left = res.left;
        top = res.top;
        width = res.width;
        height = res.height;
        snappedX = res.snappedX;
        snappedY = res.snappedY;
      }

      this.snapper.updateGuides(img, snappedX, snappedY);

      const maxW = this.container.clientWidth;
      const maxH = this.container.clientHeight;
      left = Math.max(0, Math.min(left, maxW - width));
      top = Math.max(0, Math.min(top, maxH - height));

      this.box.style.left = `${left}px`;
      this.box.style.top = `${top}px`;
      this.box.style.width = `${width}px`;
      this.box.style.height = `${height}px`;

      this.updateDimensionsTag();
    });

    window.addEventListener('mouseup', () => {
      this.isDraggingBox = false;
      this.activeHandle = null;
      this.snapper.clearGuides();
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') this.snapper.clearGuides();
    });

    // Forward wheel events on the crop box to the viewer so zoom works while cropping
    this.box.addEventListener('wheel', (e) => {
      if (!this.active || !this.viewer.img) return;
      e.preventDefault();
      e.stopPropagation();
      const zoomFactor = e.deltaY < 0 ? 1.16 : 0.86;
      const rect = this.viewer.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      this.viewer.cursorX = mx;
      this.viewer.cursorY = my;
      const nextScale = Math.max(0.05, Math.min(this.viewer.targetScale * zoomFactor, 50.0));
      this.viewer.targetPanX = mx - (mx - this.viewer.targetPanX) * (nextScale / this.viewer.targetScale);
      this.viewer.targetPanY = my - (my - this.viewer.targetPanY) * (nextScale / this.viewer.targetScale);
      this.viewer.targetScale = nextScale;
      this.viewer.snapBackToBounds();
    }, { passive: false });
  }

  getImageScreenBounds() {
    if (!this.viewer.img) return null;
    const isVert = (this.viewer.rotation === 90 || this.viewer.rotation === 270);
    const w = (isVert ? this.viewer.img.height : this.viewer.img.width) * this.viewer.scale;
    const h = (isVert ? this.viewer.img.width : this.viewer.img.height) * this.viewer.scale;
    const { panX, panY } = this.viewer;
    return { left: panX, top: panY, right: panX + w, bottom: panY + h, width: w, height: h };
  }

  setAspectRatio(ratioStr) {
    if (ratioStr === 'free') { this.aspectRatio = null; this.resetCropBoxToImage(); return; }
    const parts = ratioStr.split(':');
    if (parts.length === 2) this.aspectRatio = parseFloat(parts[0]) / parseFloat(parts[1]);
    if (this.active) this.fitCropToAspect();
  }

  resetCropBoxToImage() {
    const img = this.getImageScreenBounds();
    const boxW = img ? Math.max(40, img.width * 0.9) : this.container.clientWidth * 0.7;
    const boxH = img ? Math.max(40, img.height * 0.9) : this.container.clientHeight * 0.7;
    const left = img ? img.left + (img.width - boxW) / 2 : (this.container.clientWidth - boxW) / 2;
    const top  = img ? img.top + (img.height - boxH) / 2 : (this.container.clientHeight - boxH) / 2;
    this.box.style.width = `${Math.round(boxW)}px`; this.box.style.height = `${Math.round(boxH)}px`;
    this.box.style.left  = `${Math.round(left)}px`; this.box.style.top    = `${Math.round(top)}px`;
    this.updateDimensionsTag();
  }

  fitCropToAspect() {
    const img = this.getImageScreenBounds();
    if (!img) return;

    let boxW = img.width * 0.9;
    let boxH = this.aspectRatio ? boxW / this.aspectRatio : img.height * 0.9;

    if (boxH > img.height * 0.9) {
      boxH = img.height * 0.9;
      boxW = this.aspectRatio ? boxH * this.aspectRatio : img.width * 0.9;
    }

    const left = img.left + (img.width - boxW) / 2;
    const top = img.top + (img.height - boxH) / 2;

    this.box.style.width = `${Math.round(boxW)}px`;
    this.box.style.height = `${Math.round(boxH)}px`;
    this.box.style.left = `${Math.round(left)}px`;
    this.box.style.top = `${Math.round(top)}px`;
    this.updateDimensionsTag();
  }

  show() {
    if (!this.viewer.img) return;
    this.active = true;
    this.container.classList.remove('hidden');
    if (this.aspectRatio) this.fitCropToAspect(); else this.resetCropBoxToImage();
  }

  hide() {
    this.active = false;
    this.snapper.clearGuides();
    this.box.classList.remove('snapped-center-x', 'snapped-center-y');
    this.container.classList.add('hidden');
  }

  updateDimensionsTag() {
    const r = this.getCropTransformedRect();
    if (r) this.tag.textContent = `${r.width} × ${r.height} px`;
  }

  getCropImageRect() {
    if (!this.viewer.img) return null;
    const boxLeft = this.box.offsetLeft, boxTop = this.box.offsetTop;
    const boxW = this.box.offsetWidth, boxH = this.box.offsetHeight;
    const imgTopLeft = this.viewer.screenToImageCoords(boxLeft, boxTop);
    const imgBottomRight = this.viewer.screenToImageCoords(boxLeft + boxW, boxTop + boxH);
    const x = Math.max(0, Math.min(this.viewer.img.width, imgTopLeft.x));
    const y = Math.max(0, Math.min(this.viewer.img.height, imgTopLeft.y));
    const width = Math.max(1, Math.min(this.viewer.img.width - x, imgBottomRight.x - x));
    const height = Math.max(1, Math.min(this.viewer.img.height - y, imgBottomRight.y - y));

    return { x, y, width, height };
  }

  getCropTransformedRect() {
    if (!this.viewer.img) return null;
    const isVert = (this.viewer.rotation === 90 || this.viewer.rotation === 270);
    const transW = isVert ? this.viewer.img.height : this.viewer.img.width;
    const transH = isVert ? this.viewer.img.width  : this.viewer.img.height;
    const scale  = this.viewer.scale;

    const rawX = (this.box.offsetLeft - this.viewer.panX) / scale;
    const rawY = (this.box.offsetTop  - this.viewer.panY) / scale;
    const rawW = this.box.offsetWidth  / scale;
    const rawH = this.box.offsetHeight / scale;

    // Mirror coordinates when image is flipped so crop maps to the correct pixel region
    const relX = this.viewer.flipH ? transW - rawX - rawW : rawX;
    const relY = this.viewer.flipV ? transH - rawY - rawH : rawY;

    const x      = Math.max(0, Math.min(transW,     Math.round(relX)));
    const y      = Math.max(0, Math.min(transH,     Math.round(relY)));
    const width  = Math.max(1, Math.min(transW - x, Math.round(rawW)));
    const height = Math.max(1, Math.min(transH - y, Math.round(rawH)));

    return { x, y, width, height, transW, transH };
  }

  onTransform() {
    if (!this.active) return;
    if (this.aspectRatio) this.fitCropToAspect(); else this.resetCropBoxToImage();
  }
}
