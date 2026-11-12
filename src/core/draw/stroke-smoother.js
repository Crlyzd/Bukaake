/**
 * Bukaake Stroke Smoothing & Coordinate Constraint Engine
 * Pure math, jitter reduction, Laplacian coordinate relaxation, and spline path renderers (< 130 lines).
 */

/**
 * Constrains a coordinate to horizontal (Shift) or vertical (Ctrl) axis relative to origin.
 * Active strictly when Auto-Smooth is OFF.
 */
export function constrainAxis(rawPt, originPt, shiftKey, ctrlKey) {
  if (!originPt) return rawPt;
  if (shiftKey) return { x: rawPt.x, y: originPt.y };
  if (ctrlKey) return { x: originPt.x, y: rawPt.y };
  return rawPt;
}

/**
 * Filters out consecutive samples closer than minDistance in image space.
 */
export function filterJitterPoints(points, minDistance = 2.0) {
  if (!points || points.length <= 2) return points ? [...points] : [];
  const filtered = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = filtered[filtered.length - 1];
    const dx = points[i].x - prev.x;
    const dy = points[i].y - prev.y;
    if (Math.hypot(dx, dy) >= minDistance || i === points.length - 1) {
      filtered.push(points[i]);
    }
  }
  return filtered;
}

/**
 * Multi-pass Laplacian weighted coordinate relaxation with pinned endpoints.
 * P[i] = 0.25 * P[i-1] + 0.5 * P[i] + 0.25 * P[i+1]
 */
export function smoothStrokePoints(points, iterations = 2) {
  if (!points || points.length <= 2) return points ? [...points] : [];
  let pts = points.map((p) => ({ x: p.x, y: p.y }));
  for (let iter = 0; iter < iterations; iter++) {
    const next = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      next.push({
        x: 0.25 * pts[i - 1].x + 0.5 * pts[i].x + 0.25 * pts[i + 1].x,
        y: 0.25 * pts[i - 1].y + 0.5 * pts[i].y + 0.25 * pts[i + 1].y,
      });
    }
    next.push(pts[pts.length - 1]);
    pts = next;
  }
  return pts;
}

/**
 * Renders a path to the 2D context using midpoint quadratic Bezier splines
 * when smooth is true, or linear lineTo when smooth is false.
 */
export function renderStrokePath(ctx, points, isSmooth = false) {
  if (!points || points.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  if (!isSmooth || points.length <= 2) {
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    return;
  }

  // Midpoint Quadratic Bezier Spline
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.stroke();
}

/**
 * Applies styles and renders an individual stroke to a 2D canvas context.
 */
export function renderSingleStroke(ctx, stroke, isSmooth = false) {
  ctx.save();
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  const smooth = stroke.smoothed ?? isSmooth;
  if (stroke.mode === 'highlighter') {
    ctx.globalAlpha = 0.40;
    ctx.lineCap = smooth ? 'round' : 'butt';
    ctx.lineJoin = smooth ? 'round' : 'miter';
    ctx.lineWidth = stroke.size;
    if (stroke.points.length === 1) {
      const p = stroke.points[0], w = Math.max(2, stroke.size / 3);
      ctx.fillRect(p.x - w / 2, p.y - stroke.size / 2, w, stroke.size);
      ctx.restore();
      return;
    }
  } else {
    ctx.globalAlpha = 1.0;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = stroke.size;
  }
  renderStrokePath(ctx, stroke.points, smooth);
  ctx.restore();
}

/**
 * Bakes an array of strokes permanently onto an underlying image.
 */
export function createBakedImage(img, strokes, isSmooth = false) {
  if (!img || !strokes || strokes.length === 0) return null;
  const offCanvas = document.createElement('canvas');
  offCanvas.width = img.width;
  offCanvas.height = img.height;
  const octx = offCanvas.getContext('2d');
  octx.drawImage(img, 0, 0);

  octx.save();
  octx.beginPath();
  octx.rect(0, 0, img.width, img.height);
  octx.clip();
  for (const stroke of strokes) {
    if (stroke.points?.length > 0) renderSingleStroke(octx, stroke, isSmooth);
  }
  octx.restore();

  const bakedImg = new Image();
  bakedImg.src = offCanvas.toDataURL('image/png');
  return bakedImg;
}
