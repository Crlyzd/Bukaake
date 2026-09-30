/**
 * Bukaake Crop Snapping & Guide Lines Engine
 * Handles edge snapping, center magnet alignment with Shift, and image-spanning guide lines (< 120 lines).
 */

export class CropSnapper {
  constructor(overlayContainer) {
    this.container = overlayContainer;
    this.snapH = overlayContainer?.querySelector('#cropSnapH') || document.getElementById('cropSnapH');
    this.snapV = overlayContainer?.querySelector('#cropSnapV') || document.getElementById('cropSnapV');
    this.SNAP_THRESHOLD = 14;
  }

  ensureElements() {
    if (!this.snapH) this.snapH = document.getElementById('cropSnapH');
    if (!this.snapV) this.snapV = document.getElementById('cropSnapV');
  }

  snapBoxDrag(startBoxState, dx, dy, img, isShift) {
    let left = startBoxState.left + dx;
    let top = startBoxState.top + dy;
    const width = startBoxState.width;
    const height = startBoxState.height;
    let snappedX = false;
    let snappedY = false;

    if (!img) return { left, top, width, height, snappedX, snappedY };

    const SNAP = this.SNAP_THRESHOLD;

    // Snap edges to image bounds
    if (Math.abs(left - img.left) < SNAP) {
      left = img.left;
    } else if (Math.abs(left + width - img.right) < SNAP) {
      left = img.right - width;
    }

    if (Math.abs(top - img.top) < SNAP) {
      top = img.top;
    } else if (Math.abs(top + height - img.bottom) < SNAP) {
      top = img.bottom - height;
    }

    // Shift magnet: snap crop box center to image center
    if (isShift) {
      const imgCenterX = img.left + img.width / 2;
      const imgCenterY = img.top + img.height / 2;
      const boxCenterX = left + width / 2;
      const boxCenterY = top + height / 2;

      if (Math.abs(boxCenterX - imgCenterX) < SNAP) {
        left = imgCenterX - width / 2;
        snappedX = true;
      }
      if (Math.abs(boxCenterY - imgCenterY) < SNAP) {
        top = imgCenterY - height / 2;
        snappedY = true;
      }
    }

    return { left, top, width, height, snappedX, snappedY };
  }

  snapHandleResize(activeHandle, startBoxState, dx, dy, img, isShift, aspectRatio) {
    let { left, top, width, height } = startBoxState;
    let right = left + width;
    let bottom = top + height;
    let snappedX = false;
    let snappedY = false;
    const SNAP = this.SNAP_THRESHOLD;

    if (activeHandle.includes('e')) {
      right += dx;
      if (img && Math.abs(right - img.right) < SNAP) right = img.right;
      if (isShift && img && Math.abs(right - (img.left + img.width / 2)) < SNAP) {
        right = img.left + img.width / 2;
        snappedX = true;
      }
      width = Math.max(30, right - left);
    }
    if (activeHandle.includes('w')) {
      left += dx;
      if (img && Math.abs(left - img.left) < SNAP) left = img.left;
      if (isShift && img && Math.abs(left - (img.left + img.width / 2)) < SNAP) {
        left = img.left + img.width / 2;
        snappedX = true;
      }
      width = Math.max(30, right - left);
      left = right - width;
    }

    if (activeHandle.includes('s')) {
      bottom += dy;
      if (img && Math.abs(bottom - img.bottom) < SNAP) bottom = img.bottom;
      if (isShift && img && Math.abs(bottom - (img.top + img.height / 2)) < SNAP) {
        bottom = img.top + img.height / 2;
        snappedY = true;
      }
      height = Math.max(30, bottom - top);
    }
    if (activeHandle.includes('n')) {
      top += dy;
      if (img && Math.abs(top - img.top) < SNAP) top = img.top;
      if (isShift && img && Math.abs(top - (img.top + img.height / 2)) < SNAP) {
        top = img.top + img.height / 2;
        snappedY = true;
      }
      height = Math.max(30, bottom - top);
      top = bottom - height;
    }

    if (aspectRatio) {
      if (activeHandle === 'n' || activeHandle === 's') {
        const newW = height * aspectRatio;
        left += (width - newW) / 2;
        width = newW;
      } else {
        const newH = width / aspectRatio;
        if (activeHandle.includes('n')) top += (height - newH);
        height = newH;
      }
    }

    return { left, top, width, height, snappedX, snappedY };
  }

  updateGuides(img, snappedX, snappedY) {
    this.ensureElements();
    if (!img) {
      this.clearGuides();
      return;
    }

    if (this.snapV) {
      if (snappedX) {
        const imgCenterX = Math.round(img.left + img.width / 2);
        this.snapV.style.left = `${imgCenterX}px`;
        this.snapV.style.top = `${Math.round(img.top)}px`;
        this.snapV.style.height = `${Math.round(img.height)}px`;
        this.snapV.classList.add('visible');
      } else {
        this.snapV.classList.remove('visible');
      }
    }

    if (this.snapH) {
      if (snappedY) {
        const imgCenterY = Math.round(img.top + img.height / 2);
        this.snapH.style.top = `${imgCenterY}px`;
        this.snapH.style.left = `${Math.round(img.left)}px`;
        this.snapH.style.width = `${Math.round(img.width)}px`;
        this.snapH.classList.add('visible');
      } else {
        this.snapH.classList.remove('visible');
      }
    }
  }

  clearGuides() {
    this.ensureElements();
    this.snapH?.classList.remove('visible');
    this.snapV?.classList.remove('visible');
  }
}
