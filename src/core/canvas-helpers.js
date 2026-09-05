/**
 * Bukaake Canvas Math & Offscreen Rendering Helpers
 */

export function screenToImage(screenX, screenY, panX, panY, scale) {
  return {
    x: Math.round((screenX - panX) / scale),
    y: Math.round((screenY - panY) / scale),
  };
}

export function renderOffscreenCanvas(img, { rotation, flipH, flipV, pixelSmoothing, cropRect, filterCss }) {
  if (!img) return null;
  const off = document.createElement('canvas');
  const ctx = off.getContext('2d');

  const w = cropRect ? cropRect.width : img.width;
  const h = cropRect ? cropRect.height : img.height;
  const isRot = (rotation === 90 || rotation === 270);

  off.width = isRot ? h : w;
  off.height = isRot ? w : h;
  ctx.imageSmoothingEnabled = pixelSmoothing;
  if (filterCss) ctx.filter = filterCss;

  ctx.translate(off.width / 2, off.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

  const dx = cropRect ? -cropRect.x - cropRect.width / 2 : -img.width / 2;
  const dy = cropRect ? -cropRect.y - cropRect.height / 2 : -img.height / 2;
  ctx.drawImage(img, dx, dy);
  return off;
}

export function calculatePanBounds(canvas, img, scale, rotation, bottomInset = 0) {
  if (!img) return { minX: 0, maxX: 0, minY: 0, maxY: 0, centerX: 0, centerY: 0 };
  const isVert = (rotation === 90 || rotation === 270);
  const imgW = (isVert ? img.height : img.width) * scale;
  const imgH = (isVert ? img.width : img.height) * scale;
  const pad = 24;
  const centerX = (canvas.width - imgW) / 2;
  const centerY = (canvas.height - bottomInset - imgH) / 2;
  const availW = canvas.width - pad * 2;
  const availH = canvas.height - bottomInset - pad * 2;
  return {
    minX: imgW <= availW ? centerX : canvas.width - pad - imgW,
    maxX: imgW <= availW ? centerX : pad,
    minY: imgH <= availH ? centerY : canvas.height - bottomInset - pad - imgH,
    maxY: imgH <= availH ? centerY : pad,
    centerX, centerY, imgW, imgH, pad,
  };
}

export function computeRubberDamping(rawX, rawY, bounds) {
  const damp = (val, min, max) => {
    if (val < min) return min - Math.pow(min - val, 0.78) * 1.8;
    if (val > max) return max + Math.pow(val - max, 0.78) * 1.8;
    return val;
  };
  return { x: damp(rawX, bounds.minX, bounds.maxX), y: damp(rawY, bounds.minY, bounds.maxY) };
}
