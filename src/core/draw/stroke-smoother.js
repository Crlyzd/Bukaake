/**
 * Bukaake Stroke Smoothing & Coordinate Constraint Engine
 * Pure math, jitter reduction, Chaikin B-Spline subdivision, and calligraphic tapered ribbon renderer (< 260 lines).
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
 * Downsamples dense mouse samples along chord length, stripping away micro-tremor
 * and keeping structural guide anchors for painterly curves.
 */
export function decimateStrokePoints(points, stride = 24.0) {
  if (!points || points.length <= 3) return points ? [...points] : [];
  const result = [points[0]];
  let accumDist = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    accumDist += Math.hypot(curr.x - prev.x, curr.y - prev.y);
    if (accumDist >= stride) {
      result.push(curr);
      accumDist = 0;
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

/**
 * Chaikin corner-cutting subdivision algorithm.
 * Replaces each segment with 2 interior points at 25% and 75%, converging to a quadratic B-spline.
 */
export function chaikinSmooth(points, iterations = 3) {
  if (!points || points.length <= 2) return points ? [...points] : [];
  let pts = points;
  for (let it = 0; it < iterations; it++) {
    const next = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i], p1 = pts[i + 1];
      next.push({ x: 0.75 * p0.x + 0.25 * p1.x, y: 0.75 * p0.y + 0.25 * p1.y });
      next.push({ x: 0.25 * p0.x + 0.75 * p1.x, y: 0.25 * p0.y + 0.75 * p1.y });
    }
    next.push(pts[pts.length - 1]);
    pts = next;
  }
  return pts;
}

/**
 * Applies smoothing pipeline based on smoothLevel:
 * - Level 1: Natural subtle 2-pass Laplacian (handwriting fidelity).
 * - Level 2: Galaxy painterly (24px macro-stride decimation + 3-pass Chaikin B-Spline subdivision).
 */
export function smoothStrokePoints(points, smoothLevel = 1) {
  if (!points || points.length <= 2) return points ? [...points] : [];
  if (smoothLevel === 2) {
    const decimated = decimateStrokePoints(points, 24.0);
    return chaikinSmooth(decimated, 3);
  }

  // Level 1: Natural Laplacian
  const filtered = filterJitterPoints(points, 2.0);
  let pts = filtered.map((p) => ({ x: p.x, y: p.y }));
  for (let iter = 0; iter < 2; iter++) {
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
 * Renders a calligraphic vector ribbon with soft, rounded tapered caps (never sharp needle points).
 * Constructs left and right perpendicular normal contours with circular dome caps.
 */
export function renderTaperedRibbon(ctx, points, baseWidth, color) {
  if (!points || points.length === 0) return;
  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, Math.max(1, baseWidth / 2), 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // 1. Calculate cumulative arc length along spine
  const dists = [0];
  let totalLength = 0;
  for (let i = 1; i < points.length; i++) {
    totalLength += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    dists.push(totalLength);
  }
  if (totalLength <= 0) return;

  // 2. Compute left and right normal offsets with soft rounded taper (55% tip floor)
  const leftPts = [], rightPts = [];
  const taperFraction = 0.16; // First & last 16% gently tapers
  const minTipScale = 0.55;   // Soft organic taper floor (never needle-sharp)
  const halfBase = baseWidth / 2;

  const tangents = [];
  const halfWidths = [];

  for (let i = 0; i < points.length; i++) {
    const t = dists[i] / totalLength;
    let taper = 1.0;
    if (t < taperFraction) {
      taper = Math.sin((t / taperFraction) * (Math.PI / 2));
    } else if (t > 1.0 - taperFraction) {
      taper = Math.sin(((1.0 - t) / taperFraction) * (Math.PI / 2));
    }
    const hw = Math.max(1.0, halfBase * (minTipScale + (1.0 - minTipScale) * Math.pow(taper, 1.2)));
    halfWidths.push(hw);

    // Tangent vector
    let tx = 0, ty = 0;
    if (i === 0) {
      tx = points[1].x - points[0].x;
      ty = points[1].y - points[0].y;
    } else if (i === points.length - 1) {
      tx = points[i].x - points[i - 1].x;
      ty = points[i].y - points[i - 1].y;
    } else {
      tx = points[i + 1].x - points[i - 1].x;
      ty = points[i + 1].y - points[i - 1].y;
    }
    const len = Math.hypot(tx, ty) || 1;
    tangents.push({ tx: tx / len, ty: ty / len });

    const nx = -ty / len, ny = tx / len;
    leftPts.push({ x: points[i].x + nx * hw, y: points[i].y + ny * hw });
    rightPts.push({ x: points[i].x - nx * hw, y: points[i].y - ny * hw });
  }

  // 3. Draw closed ribbon polygon with rounded dome caps
  const p0 = points[0], pn = points[points.length - 1];
  const r0 = halfWidths[0], rn = halfWidths[halfWidths.length - 1];
  const t0 = tangents[0], tn = tangents[tangents.length - 1];
  const angle0 = Math.atan2(t0.ty, t0.tx);
  const anglen = Math.atan2(tn.ty, tn.tx);

  ctx.beginPath();
  // Start with rounded dome cap at beginning
  ctx.arc(p0.x, p0.y, r0, angle0 + Math.PI / 2, angle0 + (3 * Math.PI) / 2, false);

  // Left contour
  for (let i = 0; i < leftPts.length - 1; i++) {
    const midX = (leftPts[i].x + leftPts[i + 1].x) / 2;
    const midY = (leftPts[i].y + leftPts[i + 1].y) / 2;
    ctx.quadraticCurveTo(leftPts[i].x, leftPts[i].y, midX, midY);
  }
  ctx.lineTo(leftPts[leftPts.length - 1].x, leftPts[leftPts.length - 1].y);

  // Rounded dome cap at end
  ctx.arc(pn.x, pn.y, rn, anglen - Math.PI / 2, anglen + Math.PI / 2, false);

  // Right contour back to start
  for (let i = rightPts.length - 1; i > 0; i--) {
    const midX = (rightPts[i].x + rightPts[i - 1].x) / 2;
    const midY = (rightPts[i].y + rightPts[i - 1].y) / 2;
    ctx.quadraticCurveTo(rightPts[i].x, rightPts[i].y, midX, midY);
  }
  ctx.lineTo(rightPts[0].x, rightPts[0].y);

  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * Renders a path to the 2D context using midpoint quadratic Bezier splines
 * when smooth is true/non-zero, or linear lineTo when false.
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
  const smooth = stroke.smoothed !== undefined ? stroke.smoothed : (isSmooth ? 1 : 0);

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

  // Galaxy Mode (Level 2): Calligraphic Tapered Ribbon
  if (smooth === 2 && stroke.points?.length > 1) {
    renderTaperedRibbon(ctx, stroke.points, stroke.size, stroke.color);
  } else {
    renderStrokePath(ctx, stroke.points, Boolean(smooth));
  }
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
