/**
 * Bukaake Blur & Pixelate Rendering Engine
 * Offscreen effect caching, shape/brush masking, edge feathering, and baking (< 180 lines).
 */

import { renderStrokePath } from '../draw/stroke-smoother.js';

const PIXEL_FACTORS = { low: 0.012, med: 0.024, high: 0.045 };
const BLUR_FACTORS = { low: 0.008, med: 0.018, high: 0.036 };

export class BlurEffectCache {
  constructor() {
    this.img = null;
    this.cache = new Map();
  }

  clear() {
    this.cache.clear();
    this.img = null;
  }

  getEffectCanvas(img, mode = 'blur', strength = 'med') {
    if (!img) return null;
    if (this.img !== img) {
      this.clear();
      this.img = img;
    }
    const key = `${mode}:${strength}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const w = img.width;
    const h = img.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const minDim = Math.max(64, Math.min(w, h));

    if (mode === 'pixelate') {
      const factor = PIXEL_FACTORS[strength] || PIXEL_FACTORS.med;
      const blockPx = Math.max(6, Math.min(96, Math.round(minDim * factor)));
      const smallW = Math.max(1, Math.round(w / blockPx));
      const smallH = Math.max(1, Math.round(h / blockPx));
      const small = document.createElement('canvas');
      small.width = smallW;
      small.height = smallH;
      const sctx = small.getContext('2d');
      sctx.imageSmoothingEnabled = true;
      sctx.drawImage(img, 0, 0, smallW, smallH);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(small, 0, 0, smallW, smallH, 0, 0, w, h);
    } else {
      const factor = BLUR_FACTORS[strength] || BLUR_FACTORS.med;
      const blurPx = Math.max(5, Math.min(72, Math.round(minDim * factor)));
      ctx.drawImage(img, 0, 0);
      ctx.filter = `blur(${blurPx}px)`;
      ctx.drawImage(img, 0, 0);
      ctx.filter = 'none';
    }

    this.cache.set(key, canvas);
    return canvas;
  }
}

export function drawBlurMaskItem(mctx, item) {
  mctx.fillStyle = '#ffffff';
  mctx.strokeStyle = '#ffffff';

  if (item.shape === 'rect') {
    const x = Math.min(item.start.x, item.end.x);
    const y = Math.min(item.start.y, item.end.y);
    const w = Math.abs(item.end.x - item.start.x);
    const h = Math.abs(item.end.y - item.start.y);
    if (w > 0 && h > 0) mctx.fillRect(x, y, w, h);
    return;
  }

  if (item.shape === 'circle') {
    const cx = (item.start.x + item.end.x) / 2;
    const cy = (item.start.y + item.end.y) / 2;
    const rx = Math.abs(item.end.x - item.start.x) / 2;
    const ry = Math.abs(item.end.y - item.start.y) / 2;
    if (rx > 0 && ry > 0) {
      mctx.beginPath();
      mctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      mctx.fill();
    }
    return;
  }

  if (!item.points || item.points.length === 0) return;
  mctx.lineCap = 'round';
  mctx.lineJoin = 'round';
  mctx.lineWidth = item.size;
  if (item.points.length === 1) {
    mctx.beginPath();
    mctx.arc(item.points[0].x, item.points[0].y, Math.max(1, item.size / 2), 0, Math.PI * 2);
    mctx.fill();
  } else {
    renderStrokePath(mctx, item.points, true);
  }
}

function groupConsecutiveItems(items) {
  const groups = [];
  for (const item of items) {
    const feather = Boolean(item.feather);
    const key = `${item.mode}:${item.strength}:${feather}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(item);
    } else {
      groups.push({ key, mode: item.mode, strength: item.strength, feather, items: [item] });
    }
  }
  return groups;
}

function drawDragGuideOutline(ctx, item) {
  const scale = item.viewScale || 1;
  ctx.save();
  ctx.lineWidth = Math.max(1.5, 1.5 / scale);
  ctx.setLineDash([6 / scale, 4 / scale]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.shadowColor = 'rgba(24, 27, 36, 0.75)';
  ctx.shadowBlur = 3;

  if (item.shape === 'rect') {
    const x = Math.min(item.start.x, item.end.x);
    const y = Math.min(item.start.y, item.end.y);
    const w = Math.abs(item.end.x - item.start.x);
    const h = Math.abs(item.end.y - item.start.y);
    if (w > 0 && h > 0) ctx.strokeRect(x, y, w, h);
  } else if (item.shape === 'circle') {
    const cx = (item.start.x + item.end.x) / 2;
    const cy = (item.start.y + item.end.y) / 2;
    const rx = Math.abs(item.end.x - item.start.x) / 2;
    const ry = Math.abs(item.end.y - item.start.y) / 2;
    if (rx > 0 && ry > 0) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function renderBlurItems(ctx, img, items, effectCache, scratchCanvas, activeDragItem = null) {
  if (!img || !items || items.length === 0) return;
  if (scratchCanvas.width !== img.width || scratchCanvas.height !== img.height) {
    scratchCanvas.width = img.width;
    scratchCanvas.height = img.height;
  }
  const sctx = scratchCanvas.getContext('2d');
  const featherPx = Math.max(6, Math.min(48, Math.round(Math.min(img.width, img.height) * 0.015)));
  const groups = groupConsecutiveItems(items);

  for (const group of groups) {
    sctx.clearRect(0, 0, img.width, img.height);
    sctx.save();
    if (group.feather) {
      sctx.filter = `blur(${featherPx}px)`;
    }
    for (const item of group.items) {
      drawBlurMaskItem(sctx, item);
    }
    sctx.filter = 'none';
    sctx.globalCompositeOperation = 'source-in';
    const effectCanvas = effectCache.getEffectCanvas(img, group.mode, group.strength);
    if (effectCanvas) {
      sctx.drawImage(effectCanvas, 0, 0);
    }
    sctx.restore();
    ctx.drawImage(scratchCanvas, 0, 0);
  }

  if (activeDragItem && (activeDragItem.shape === 'rect' || activeDragItem.shape === 'circle')) {
    drawDragGuideOutline(ctx, activeDragItem);
  }
}

export function clampToImage(img, pt) {
  return {
    x: Math.max(0, Math.min(img.width, pt.x)),
    y: Math.max(0, Math.min(img.height, pt.y)),
  };
}

export function constrainShapePoint(img, start, rawPt, shiftKey) {
  const pt = clampToImage(img, rawPt);
  if (!shiftKey) return pt;
  const dx = pt.x - start.x;
  const dy = pt.y - start.y;
  const side = Math.max(Math.abs(dx), Math.abs(dy));
  return clampToImage(img, {
    x: start.x + (dx >= 0 ? side : -side),
    y: start.y + (dy >= 0 ? side : -side),
  });
}

export function createBakedBlurImage(img, items, effectCache, scratchCanvas) {
  if (!img || !items || items.length === 0) return null;
  const offCanvas = document.createElement('canvas');
  offCanvas.width = img.width;
  offCanvas.height = img.height;
  const octx = offCanvas.getContext('2d');
  octx.drawImage(img, 0, 0);

  octx.save();
  octx.beginPath();
  octx.rect(0, 0, img.width, img.height);
  octx.clip();
  renderBlurItems(octx, img, items, effectCache, scratchCanvas, null);
  octx.restore();

  const bakedImg = new Image();
  bakedImg.src = offCanvas.toDataURL('image/png');
  return bakedImg;
}
