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
