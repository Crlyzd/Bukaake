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

  const isRot  = (rotation === 90 || rotation === 270);
  const transW = isRot ? img.height : img.width;
  const transH = isRot ? img.width  : img.height;

  // Pass 1: Render the full rotated+flipped image onto a transW×transH intermediate canvas
  const tmp    = document.createElement('canvas');
  tmp.width    = transW;
  tmp.height   = transH;
  const tctx   = tmp.getContext('2d');
  tctx.imageSmoothingEnabled = pixelSmoothing;
  if (filterCss) tctx.filter = filterCss;
  tctx.translate(transW / 2, transH / 2);
  tctx.rotate((rotation * Math.PI) / 180);
  tctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  tctx.drawImage(img, -img.width / 2, -img.height / 2);

  // Pass 2: Copy the crop region (in transformed space) to the output canvas
  const cropX = cropRect ? cropRect.x : 0;
  const cropY = cropRect ? cropRect.y : 0;
  const cropW = cropRect ? cropRect.width  : transW;
  const cropH = cropRect ? cropRect.height : transH;

  const off   = document.createElement('canvas');
  off.width   = cropW;
  off.height  = cropH;
  const ctx   = off.getContext('2d');
  ctx.imageSmoothingEnabled = pixelSmoothing;
  ctx.drawImage(tmp, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
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
