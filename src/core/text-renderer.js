/**
 * Bukaake Text Vector Rendering & Styling Helper
 * Handles Canvas 2D text layout, Underline/Strike vectors, Canva-style background & shadows (< 120 lines).
 */

export function hexToRgba(hex, alpha = 1) {
  if (!hex || typeof hex !== 'string') return `rgba(255, 255, 255, ${alpha})`;
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

export function applyStylesToTextInput(box, ta, item, scale = 1) {
  const fs = Math.max(10, Math.round(item.size * scale));
  ta.style.fontFamily = item.font;
  ta.style.fontSize = `${fs}px`;
  ta.style.color = item.color;
  ta.style.fontWeight = item.bold ? '700' : '400';
  ta.style.fontStyle = item.italic ? 'italic' : 'normal';
  const dec = [item.underline && 'underline', item.strike && 'line-through'].filter(Boolean).join(' ');
  ta.style.textDecoration = dec || 'none';

  if (item.shadow?.enabled) {
    const s = item.shadow;
    const ox = Math.round(s.offsetX * scale), oy = Math.round(s.offsetY * scale), bl = Math.round(s.blur * scale);
    ta.style.textShadow = `${ox}px ${oy}px ${bl}px ${hexToRgba(s.color, s.opacity)}`;
  } else {
    ta.style.textShadow = 'none';
  }

  box.style.boxShadow = 'none';
  if (item.bg?.enabled) {
    const b = item.bg;
    box.style.backgroundColor = hexToRgba(b.color, b.opacity);
    box.style.borderRadius = `${Math.round(b.roundness * scale)}px`;
    box.style.border = b.borderSize > 0 ? `${Math.max(1, Math.round(b.borderSize * scale))}px solid ${b.borderColor}` : 'none';
    box.style.outline = '1.5px solid #8b5cf6';
    box.style.padding = `${Math.round(4 * scale)}px ${Math.round(8 * scale)}px`;
  } else {
    box.style.backgroundColor = 'transparent';
    box.style.borderRadius = '2px';
    box.style.border = '1.5px solid #8b5cf6';
    box.style.outline = 'none';
    box.style.padding = '1px 2px';
  }
}

/** Returns { width, height, lines } for a text item at given scale */
export function measureTextDimensions(ctx, text, font, size, bold, italic, scale = 1) {
  const fs = Math.max(10, Math.round(size * scale));
  const lines = (text || '').split('\n');
  let maxW = 0;
  if (ctx) {
    ctx.save();
    ctx.font = `${italic ? 'italic ' : ''}${bold ? 'bold ' : 'normal '}${fs}px ${font}`;
    for (const line of lines) {
      const w = ctx.measureText(line || ' ').width;
      if (w > maxW) maxW = w;
    }
    ctx.restore();
  } else {
    maxW = Math.max(...lines.map((l) => (l.length || 1) * fs * 0.55));
  }
  const w = Math.max(16, Math.ceil(maxW) + 1);
  const lineH = Math.round(fs * 1.25);
  const h = Math.max(lineH, lines.length * lineH);
  return { width: w, height: h, lines };
}

/** Tightly sizes the textarea width and height to match its text content */
export function autoSizeTextarea(ctx, ta, item, scale = 1) {
  if (!ta || !item) return;
  ta.rows = 1;
  const dims = measureTextDimensions(ctx, ta.value || '', item.font, item.size, item.bold, item.italic, scale);
  ta.style.width = `${dims.width}px`;
  ta.style.height = `${dims.height}px`;
}

export function renderVectorTextItem(ctx, it) {
  const lines = (it.text || '').split('\n');
  const lh = it.size * 1.25;
  ctx.save();
  ctx.font = `${it.italic ? 'italic ' : ''}${it.bold ? 'bold ' : ''}${it.size}px ${it.font}`;
  ctx.textBaseline = 'top';

  let maxW = 0;
  const widths = lines.map((l) => { const w = ctx.measureText(l).width; if (w > maxW) maxW = w; return w; });
  const pad = it.bg?.enabled ? 8 : 0;
  const totalH = lines.length * lh;

  if (it.bg?.enabled) {
    ctx.save();
    ctx.fillStyle = hexToRgba(it.bg.color, it.bg.opacity);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(it.x - pad, it.y - pad, maxW + pad * 2, totalH + pad * 2, it.bg.roundness);
    else ctx.rect(it.x - pad, it.y - pad, maxW + pad * 2, totalH + pad * 2);
    ctx.fill();
    if (it.bg.borderSize > 0) {
      ctx.lineWidth = it.bg.borderSize;
      ctx.strokeStyle = it.bg.borderColor || '#ffffff';
      ctx.stroke();
    }
    ctx.restore();
  }

  if (it.shadow?.enabled) {
    ctx.shadowColor = hexToRgba(it.shadow.color, it.shadow.opacity);
    ctx.shadowBlur = it.shadow.blur;
    ctx.shadowOffsetX = it.shadow.offsetX;
    ctx.shadowOffsetY = it.shadow.offsetY;
  }

  ctx.fillStyle = it.color;
  lines.forEach((line, idx) => {
    const ly = it.y + idx * lh;
    ctx.fillText(line, it.x, ly);
    const lw = widths[idx];
    const th = Math.max(1.5, it.size * 0.07);
    if (it.underline) ctx.fillRect(it.x, ly + it.size * 1.05, lw, th);
    if (it.strike) ctx.fillRect(it.x, ly + it.size * 0.55, lw, th);
  });
  ctx.restore();
}

/** Hit-test: returns the topmost item whose bounding rect contains (imgX, imgY). */
export function hitTestTextItems(items, imgX, imgY) {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    const lines = (it.text || '').split('\n');
    const lh = it.size * 1.25, h = lines.length * lh;
    const maxW = Math.max(...lines.map((l) => (l.length || 1) * it.size * 0.65));
    const pad = it.bg?.enabled ? 8 : 4;
    if (imgX >= it.x - pad && imgX <= it.x + maxW + pad && imgY >= it.y - pad && imgY <= it.y + h + pad) return it;
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

