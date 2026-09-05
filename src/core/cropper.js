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

      if (this.isDraggingBox) {
        left += dx;
        top += dy;
      } else if (this.activeHandle) {
        switch (this.activeHandle) {
          case 'se':
            width = Math.max(30, width + dx);
            height = this.aspectRatio ? width / this.aspectRatio : Math.max(30, height + dy);
            break;
          case 'sw':
            const newW_sw = Math.max(30, width - dx);
            left += (width - newW_sw);
            width = newW_sw;
            height = this.aspectRatio ? width / this.aspectRatio : Math.max(30, height + dy);
            break;
          case 'ne':
            width = Math.max(30, width + dx);
            const newH_ne = this.aspectRatio ? width / this.aspectRatio : Math.max(30, height - dy);
            top += (height - newH_ne);
            height = newH_ne;
            break;
          case 'nw':
            const newW_nw = Math.max(30, width - dx);
            left += (width - newW_nw);
            width = newW_nw;
            const newH_nw = this.aspectRatio ? width / this.aspectRatio : Math.max(30, height - dy);
            top += (height - newH_nw);
            height = newH_nw;
            break;
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

    const cW = this.container.clientWidth;
    const cH = this.container.clientHeight;
    const boxW = cW * 0.7;
    const boxH = this.aspectRatio ? boxW / this.aspectRatio : cH * 0.7;

    this.box.style.width = `${boxW}px`;
    this.box.style.height = `${boxH}px`;
    this.box.style.left = `${(cW - boxW) / 2}px`;
    this.box.style.top = `${(cH - boxH) / 2}px`;
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
