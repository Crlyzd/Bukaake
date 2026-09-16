/**
 * Bukaake Text Vector Rendering & Styling Helper
 * Optical Canvas 2D & DOM layout, symmetrical padding and stroke-free rounded pathing (< 190 lines).
 */

const _measureCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
const _measureCtx = _measureCanvas?.getContext('2d') || null;

export function hexToRgba(hex, alpha = 1) {
  if (!hex || typeof hex !== 'string') return `rgba(255, 255, 255, ${alpha})`;
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

/** Robust geometric rounded rectangle path via arcTo; guarantees smooth corners across all WebView2 environments. */
export function drawRoundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r || 0, w / 2, h / 2));
  ctx.beginPath();
  if (radius <= 0) {
    ctx.rect(x, y, w, h);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.arcTo(x + w, y, x + w, y + radius, radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
    ctx.lineTo(x + radius, y + h);
    ctx.arcTo(x, y + h, x, y + h - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
  }
}

/** Single source of truth for optical text layout, dimensions, symmetrical paddings and corner roundness. */
export function computeTextLayout(ctx, item) {
  const c = ctx || _measureCtx;
  const lines = (item.text || '').split('\n');
  const fontSize = Math.max(10, Math.round(item.size || 36));
  const fontStr = `${item.italic ? 'italic ' : ''}${item.bold ? 'bold ' : 'normal '}${fontSize}px ${item.font || 'Inter, sans-serif'}`;

  let maxW = 0;
  const widths = [];
  let maxAscent = Math.round(fontSize * 0.78);
  let maxDescent = Math.round(fontSize * 0.22);

  if (c) {
    c.save();
    c.font = fontStr;
    for (const line of lines) {
      const m = c.measureText(line || ' ');
      const w = m.width;
      widths.push(w);
      if (w > maxW) maxW = w;
      if (m.actualBoundingBoxAscent) maxAscent = Math.max(maxAscent, Math.round(m.actualBoundingBoxAscent));
      if (m.actualBoundingBoxDescent) maxDescent = Math.max(maxDescent, Math.round(m.actualBoundingBoxDescent));
    }
    c.restore();
  } else {
    for (const line of lines) {
      const w = Math.max(16, (line.length || 1) * fontSize * 0.55);
      widths.push(w);
      if (w > maxW) maxW = w;
    }
  }

  const singleLineH = Math.round(maxAscent + maxDescent);
  const lh = Math.round(fontSize * 1.25);
  const textH = lines.length === 1 ? singleLineH : Math.round((lines.length - 1) * lh + singleLineH);

  const padX = item.bg?.enabled ? Math.max(8, Math.round(fontSize * 0.22)) : 4;
  const padY = item.bg?.enabled ? Math.max(6, Math.round(fontSize * 0.16)) : 2;

  const boxX = item.x - padX;
  const boxY = item.y - padY;
  const boxW = Math.max(20, Math.ceil(maxW)) + padX * 2;
  const boxH = textH + padY * 2;

  const roundness = item.bg?.enabled ? Math.round((item.bg.roundness ?? 8) * (fontSize / 36)) : 0;

  return { lines, fontSize, fontStr, widths, maxW, lh, maxAscent, maxDescent, textH, padX, padY, boxX, boxY, boxW, boxH, roundness };
}

export function applyStylesToTextInput(box, ta, item, scale = 1) {
  const l = computeTextLayout(null, item);
  box.style.background = 'transparent';
  box.style.boxShadow = 'none';
  box.style.border = '1.5px solid #8b5cf6';
  box.style.outline = 'none';
  box.style.padding = '0';
  box.style.borderRadius = `${Math.round(l.roundness * scale)}px`;

  if (ta) {
    const fs = Math.max(10, Math.round(item.size * scale));
    ta.style.fontFamily = item.font || 'Inter, sans-serif';
    ta.style.fontSize = `${fs}px`;
    ta.style.fontWeight = item.bold ? '700' : '400';
    ta.style.fontStyle = item.italic ? 'italic' : 'normal';
    ta.style.lineHeight = `${Math.round(l.lh * scale)}px`;
    ta.style.color = item.color;
    const dec = [item.underline && 'underline', item.strike && 'line-through'].filter(Boolean).join(' ');
    ta.style.textDecoration = dec || 'none';
    ta.style.paddingLeft = `${Math.round(l.padX * scale)}px`;
    ta.style.paddingRight = `${Math.round(l.padX * scale)}px`;
    ta.style.paddingTop = `${Math.round(l.padY * scale)}px`;
    ta.style.paddingBottom = `${Math.round(l.padY * scale)}px`;

    if (item.shadow?.enabled) {
      const s = item.shadow;
      const ox = Math.round(s.offsetX * scale), oy = Math.round(s.offsetY * scale), bl = Math.round(s.blur * scale);
      ta.style.textShadow = `${ox}px ${oy}px ${bl}px ${hexToRgba(s.color, s.opacity)}`;
    } else {
      ta.style.textShadow = 'none';
    }
  }
}

/** Returns { width, height, lines } for a text item at given scale */
export function measureTextDimensions(ctx, text, font, size, bold, italic, scale = 1) {
  const dummy = { text, font, size: Math.round(size * scale), bold, italic };
  const l = computeTextLayout(ctx, dummy);
  return { width: l.boxW, height: l.boxH, lines: l.lines };
}

export function autoSizeTextarea(ctx, ta, item, scale = 1) {
  if (!ta || !item) return;
  ta.rows = 1;
}

export function renderVectorTextBackground(ctx, item, layout) {
  if (!item.bg?.enabled) return;
  const l = layout || computeTextLayout(ctx, item);
  ctx.save();
  ctx.fillStyle = hexToRgba(item.bg.color, item.bg.opacity);
  drawRoundRectPath(ctx, l.boxX, l.boxY, l.boxW, l.boxH, l.roundness);
  ctx.fill();
  if (item.bg.borderSize > 0) {
    ctx.lineWidth = item.bg.borderSize;
    ctx.strokeStyle = item.bg.borderColor || '#ffffff';
    ctx.stroke();
  }
  ctx.restore();
}

export function renderVectorTextItem(ctx, it, layout = null, skipText = false) {
  const l = layout || computeTextLayout(ctx, it);
  renderVectorTextBackground(ctx, it, l);
  if (skipText) return;

  ctx.save();
  ctx.font = l.fontStr;
  ctx.textBaseline = 'alphabetic';

  if (it.shadow?.enabled) {
    ctx.shadowColor = hexToRgba(it.shadow.color, it.shadow.opacity);
    ctx.shadowBlur = it.shadow.blur;
    ctx.shadowOffsetX = it.shadow.offsetX;
    ctx.shadowOffsetY = it.shadow.offsetY;
  }

  ctx.fillStyle = it.color;
  l.lines.forEach((line, idx) => {
    const ly = it.y + l.maxAscent + (idx * l.lh);
    ctx.fillText(line, it.x, ly);
    const lw = l.widths[idx];
    const th = Math.max(1.5, it.size * 0.07);
    if (it.underline) ctx.fillRect(it.x, ly + 3, lw, th);
    if (it.strike) ctx.fillRect(it.x, ly - l.maxAscent * 0.4, lw, th);
  });
  ctx.restore();
}

/** Hit-test: returns the topmost item whose bounding rect contains (imgX, imgY). */
export function hitTestTextItems(items, imgX, imgY, ctx) {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    const l = computeTextLayout(ctx, it);
    if (imgX >= l.boxX && imgX <= l.boxX + l.boxW && imgY >= l.boxY && imgY <= l.boxY + l.boxH) return it;
  }
  return null;
}

/** Bake all text items onto the viewer image; returns a new Image (or null if nothing to bake). */
export function bakeTextToCanvas(viewer, items) {
  if (!viewer.img || items.length === 0) return null;
  const off = document.createElement('canvas');
  off.width = viewer.img.width;
  off.height = viewer.img.height;
  const octx = off.getContext('2d');
  octx.drawImage(viewer.img, 0, 0);
  for (const item of items) renderVectorTextItem(octx, item);
  const baked = new Image();
  baked.src = off.toDataURL('image/png');
  return baked;
}
