/**
 * Bukaake Text Tool Snap Engine
 * Multi-tier magnetic snap: Center → 80% Safe Zone → Image Edges with laser guide lines (< 110 lines).
 */

const SNAP_T = 14; // snap threshold in canvas-pixel (screen) space

/** Returns image bounding rect in canvas-pixel coordinates. */
function getImgRect(viewer) {
  if (!viewer.img) return null;
  const isVert = viewer.rotation === 90 || viewer.rotation === 270;
  const w = (isVert ? viewer.img.height : viewer.img.width) * viewer.scale;
  const h = (isVert ? viewer.img.width : viewer.img.height) * viewer.scale;
  return { left: viewer.panX, top: viewer.panY, right: viewer.panX + w, bottom: viewer.panY + h, width: w, height: h };
}

export class TextSnapper {
  constructor(overlayContainer) {
    this.container = overlayContainer;
    this._guideH = null;
    this._guideV = null;
  }

  _ensure() {
    if (!this.container) return;
    if (!this._guideH) {
      this._guideH = document.createElement('div');
      this._guideH.className = 'text-snap-guide text-snap-h';
      this.container.appendChild(this._guideH);
    }
    if (!this._guideV) {
      this._guideV = document.createElement('div');
      this._guideV.className = 'text-snap-guide text-snap-v';
      this.container.appendChild(this._guideV);
    }
  }

  /**
   * Compute snapped image-space position for a text item being dragged.
   * Snaps box center to image center, and box edges to 80% safe lines and image boundaries.
   * @param {object} viewer CanvasViewer instance
   * @param {number} imgX  item.x in image-pixel space
   * @param {number} imgY  item.y in image-pixel space
   * @param {number} [boxW=0] box width in screen px
   * @param {number} [boxH=0] box height in screen px
   * @returns {{ x, y, snapH, snapV }}
   */
  computeSnap(viewer, imgX, imgY, boxW = 0, boxH = 0, offX = 0, offY = 0) {
    const img = getImgRect(viewer);
    if (!img) return { x: imgX, y: imgY, snapH: null, snapV: null };

    const sc = viewer.imageToScreenCoords(imgX, imgY);
    let sx = sc.x, sy = sc.y;
    const boxLeft = sc.x - offX;
    const boxTop = sc.y - offY;
    let snapV = null, snapH = null;

    // X Axis snap targets: [target, isCenter, isRightEdge]
    const xTargets = [
      [img.left + img.width * 0.5, true, false],
      [img.left + img.width * 0.1, false, false],
      [img.left + img.width * 0.9, false, true],
      [img.left, false, false],
      [img.right, false, true],
    ];

    for (const [t, isCenter, isRight] of xTargets) {
      const boxEdge = isCenter ? boxLeft + boxW * 0.5 : isRight ? boxLeft + boxW : boxLeft;
      if (Math.abs(boxEdge - t) < SNAP_T) {
        const newBoxLeft = isCenter ? t - boxW * 0.5 : isRight ? t - boxW : t;
        sx = newBoxLeft + offX;
        snapV = t;
        break;
      }
    }

    // Y Axis snap targets: [target, isCenter, isBottomEdge]
    const yTargets = [
      [img.top + img.height * 0.5, true, false],
      [img.top + img.height * 0.1, false, false],
      [img.top + img.height * 0.9, false, true],
      [img.top, false, false],
      [img.bottom, false, true],
    ];

    for (const [t, isCenter, isBottom] of yTargets) {
      const boxEdge = isCenter ? boxTop + boxH * 0.5 : isBottom ? boxTop + boxH : boxTop;
      if (Math.abs(boxEdge - t) < SNAP_T) {
        const newBoxTop = isCenter ? t - boxH * 0.5 : isBottom ? t - boxH : t;
        sy = newBoxTop + offY;
        snapH = t;
        break;
      }
    }

    const snapped = viewer.screenToImageCoords(sx, sy);
    return { x: snapped.x, y: snapped.y, snapH, snapV };
  }

  /** Show/position guide lines at the snapped canvas-px coordinates. */
  updateGuides(viewer, snapH, snapV) {
    this._ensure();
    const img = getImgRect(viewer);
    if (!img) { this.clearGuides(); return; }

    if (this._guideV) {
      if (snapV !== null) {
        this._guideV.style.left = `${Math.round(snapV)}px`;
        this._guideV.style.top = `${Math.round(img.top)}px`;
        this._guideV.style.height = `${Math.round(img.height)}px`;
        this._guideV.classList.add('visible');
      } else { this._guideV.classList.remove('visible'); }
    }
    if (this._guideH) {
      if (snapH !== null) {
        this._guideH.style.top = `${Math.round(snapH)}px`;
        this._guideH.style.left = `${Math.round(img.left)}px`;
        this._guideH.style.width = `${Math.round(img.width)}px`;
        this._guideH.classList.add('visible');
      } else { this._guideH.classList.remove('visible'); }
    }
  }

  clearGuides() {
    this._guideH?.classList.remove('visible');
    this._guideV?.classList.remove('visible');
  }
}
