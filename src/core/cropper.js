/**
 * Bukaake Interactive Crop Engine
 * Overlay box with draggable handles and aspect ratio constraints
 */

export class CropperTool {
  constructor(overlayContainer, cropBox, dimensionsTag, canvasViewer) {
    this.container = overlayContainer;
    this.box = cropBox;
    this.tag = dimensionsTag;
    this.viewer = canvasViewer;

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
      const SNAP = 14;

      if (this.isDraggingBox) {
        left += dx;
        top += dy;
        if (img) {
          if (Math.abs(left - img.left) < SNAP) left = img.left;
          else if (Math.abs(left + width - img.right) < SNAP) left = img.right - width;
          if (Math.abs(top - img.top) < SNAP) top = img.top;
          else if (Math.abs(top + height - img.bottom) < SNAP) top = img.bottom - height;
        }
      } else if (this.activeHandle) {
        let right = left + width;
        let bottom = top + height;

        if (this.activeHandle.includes('e')) {
          right += dx;
          if (img && Math.abs(right - img.right) < SNAP) right = img.right;
          width = Math.max(30, right - left);
        }
        if (this.activeHandle.includes('w')) {
          left += dx;
          if (img && Math.abs(left - img.left) < SNAP) left = img.left;
          width = Math.max(30, right - left);
          left = right - width;
        }

        if (this.activeHandle.includes('s')) {
          bottom += dy;
          if (img && Math.abs(bottom - img.bottom) < SNAP) bottom = img.bottom;
          height = Math.max(30, bottom - top);
        }
        if (this.activeHandle.includes('n')) {
          top += dy;
          if (img && Math.abs(top - img.top) < SNAP) top = img.top;
          height = Math.max(30, bottom - top);
          top = bottom - height;
        }

        if (this.aspectRatio) {
          if (this.activeHandle === 'n' || this.activeHandle === 's') {
            const newW = height * this.aspectRatio;
            left += (width - newW) / 2;
            width = newW;
          } else {
            const newH = width / this.aspectRatio;
            if (this.activeHandle.includes('n')) top += (height - newH);
            height = newH;
          }
        }
      }

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
    });
  }

  getImageScreenBounds() {
    if (!this.viewer.img) return null;
    const isVert = (this.viewer.rotation === 90 || this.viewer.rotation === 270);
    const w = (isVert ? this.viewer.img.height : this.viewer.img.width) * this.viewer.scale;
    const h = (isVert ? this.viewer.img.width : this.viewer.img.height) * this.viewer.scale;
    return {
      left: this.viewer.panX,
      top: this.viewer.panY,
      right: this.viewer.panX + w,
      bottom: this.viewer.panY + h,
      width: w,
      height: h,
    };
  }

  setAspectRatio(ratioStr) {
    if (ratioStr === 'free') {
      this.aspectRatio = null;
    } else {
      const parts = ratioStr.split(':');
      this.aspectRatio = parseFloat(parts[0]) / parseFloat(parts[1]);
    }
    if (this.active) {
      this.fitCropToAspect();
    }
  }

  fitCropToAspect() {
    let width = this.box.offsetWidth;
    let height = this.box.offsetHeight;
    if (this.aspectRatio) {
      height = width / this.aspectRatio;
    }
    this.box.style.height = `${height}px`;
    this.updateDimensionsTag();
  }

  show() {
    if (!this.viewer.img) return;
    this.active = true;
    this.container.classList.remove('hidden');

    const img = this.getImageScreenBounds();
    let boxW = img ? img.width : this.container.clientWidth * 0.7;
    let boxH = img ? img.height : this.container.clientHeight * 0.7;

    if (this.aspectRatio) {
      if (boxW / boxH > this.aspectRatio) {
        boxW = boxH * this.aspectRatio;
      } else {
        boxH = boxW / this.aspectRatio;
      }
    }

    const left = img ? img.left + (img.width - boxW) / 2 : (this.container.clientWidth - boxW) / 2;
    const top = img ? img.top + (img.height - boxH) / 2 : (this.container.clientHeight - boxH) / 2;

    this.box.style.width = `${boxW}px`;
    this.box.style.height = `${boxH}px`;
    this.box.style.left = `${left}px`;
    this.box.style.top = `${top}px`;
    this.updateDimensionsTag();
  }

  hide() {
    this.active = false;
    this.container.classList.add('hidden');
  }

  updateDimensionsTag() {
    const cropRect = this.getCropImageRect();
    if (cropRect) {
      this.tag.textContent = `${cropRect.width} × ${cropRect.height} px`;
    }
  }

  getCropImageRect() {
    if (!this.viewer.img) return null;
    const boxLeft = this.box.offsetLeft;
    const boxTop = this.box.offsetTop;
    const boxW = this.box.offsetWidth;
    const boxH = this.box.offsetHeight;

    const imgTopLeft = this.viewer.screenToImageCoords(boxLeft, boxTop);
    const imgBottomRight = this.viewer.screenToImageCoords(boxLeft + boxW, boxTop + boxH);

    const x = Math.max(0, Math.min(this.viewer.img.width, imgTopLeft.x));
    const y = Math.max(0, Math.min(this.viewer.img.height, imgTopLeft.y));
    const width = Math.max(1, Math.min(this.viewer.img.width - x, imgBottomRight.x - x));
    const height = Math.max(1, Math.min(this.viewer.img.height - y, imgBottomRight.y - y));

    return { x, y, width, height };
  }
}
