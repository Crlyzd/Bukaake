/**
 * Bukaake Canvas FLIP Morph Helpers
 * Screen-space image rect capture/apply and a time-based ease-out tween used by
 * Mode 1 <-> Mode 2 morphs. Never alters fit math or locks the viewer (< 140 lines).
 */

const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);

function baseSize(viewer) {
  const isVert = viewer.rotation === 90 || viewer.rotation === 270;
  return {
    w: isVert ? viewer.img.height : viewer.img.width,
    h: isVert ? viewer.img.width : viewer.img.height,
  };
}

function stopMotion(viewer) {
  if (viewer.animFrameId) cancelAnimationFrame(viewer.animFrameId);
  if (viewer.flipFrameId) cancelAnimationFrame(viewer.flipFrameId);
  viewer.animFrameId = null;
  viewer.flipFrameId = null;
  viewer.isAnimating = false;
  viewer.velocityX = 0;
  viewer.velocityY = 0;
}

function commitState(viewer, s) {
  viewer.scale = viewer.targetScale = s.scale;
  viewer.panX = viewer.targetPanX = s.panX;
  viewer.panY = viewer.targetPanY = s.panY;
  viewer.render();
  viewer.onTransformChange?.();
}

/** Image rect in window client coordinates (CSS px) */
export function captureClientRect(viewer) {
  if (!viewer?.img) return null;
  const r = viewer.canvas.getBoundingClientRect();
  const b = baseSize(viewer);
  return { x: r.left + viewer.panX, y: r.top + viewer.panY, w: b.w * viewer.scale, h: b.h * viewer.scale };
}

/** Viewer state that places the image exactly at a client-space rect */
export function stateForClientRect(viewer, rect) {
  const r = viewer.canvas.getBoundingClientRect();
  const b = baseSize(viewer);
  return { scale: rect.w / b.w, panX: rect.x - r.left, panY: rect.y - r.top };
}

/** Instantly pins the image to a client-space rect (FLIP "invert" step) */
export function applyClientRect(viewer, rect) {
  if (!viewer?.img || !rect) return;
  stopMotion(viewer);
  commitState(viewer, stateForClientRect(viewer, rect));
}

/** Fit target for the current canvas (mirrors fitToScreen without side effects) */
export function computeFitState(viewer) {
  const scale = viewer.calculateFitScale(viewer.bottomInset);
  const b = baseSize(viewer);
  return {
    scale,
    panX: (viewer.canvas.width - b.w * scale) / 2,
    panY: (viewer.canvas.height - viewer.bottomInset - b.h * scale) / 2,
  };
}

/** Entrance pose: slightly smaller than fit, centered on the same point */
export function applyEntrance(viewer, fit, factor = 0.92) {
  if (!viewer?.img) return;
  const b = baseSize(viewer);
  const scale = fit.scale * factor;
  const cx = fit.panX + (b.w * fit.scale) / 2;
  const cy = fit.panY + (b.h * fit.scale) / 2;
  stopMotion(viewer);
  commitState(viewer, { scale, panX: cx - (b.w * scale) / 2, panY: cy - (b.h * scale) / 2 });
}

/**
 * Screen rect the image will occupy once the window becomes a Mode 1 window at `winRect`.
 * Mirrors the regular-mode branch of calculateFitScale (48px gutter, docked titlebar).
 */
export function regularFitScreenRect(viewer, winRect) {
  const css = getComputedStyle(document.documentElement);
  const titlebar = parseFloat(css.getPropertyValue('--titlebar-height')) || 42;
  const W = winRect.width;
  const H = winRect.height - titlebar;
  const b = baseSize(viewer);
  const inset = viewer.bottomInset || 0;
  const fit = Math.min(Math.max(100, W - 48) / b.w, Math.max(100, H - 48 - inset) / b.h, 1.0);
  const w = b.w * fit;
  const h = b.h * fit;
  return {
    x: winRect.x + (W - w) / 2,
    y: winRect.y + titlebar + (H - inset - h) / 2,
    w,
    h,
    scale: fit,
  };
}

/**
 * Time-based ease-out tween to a target state. Resolves true when complete.
 * If anything else retargets the viewer mid-flight (wheel, keys, resize), the tween yields
 * and hands control back to the standard LERP engine instead of fighting it.
 */
export function animateTo(viewer, target, ms = 260) {
  if (!viewer?.img) return Promise.resolve(false);
  stopMotion(viewer);
  const from = { scale: viewer.scale, panX: viewer.panX, panY: viewer.panY };
  viewer.targetScale = target.scale;
  viewer.targetPanX = target.panX;
  viewer.targetPanY = target.panY;
  const t0 = performance.now();

  return new Promise((resolve) => {
    const step = (now) => {
      const hijacked = viewer.targetScale !== target.scale ||
        viewer.targetPanX !== target.panX || viewer.targetPanY !== target.panY;
      if (hijacked || !viewer.img) {
        viewer.flipFrameId = null;
        if (viewer.img) viewer.startSmoothAnimation();
        return resolve(false);
      }
      const t = Math.min(1, (now - t0) / ms);
      const k = easeOutQuint(t);
      viewer.scale = from.scale + (target.scale - from.scale) * k;
      viewer.panX = from.panX + (target.panX - from.panX) * k;
      viewer.panY = from.panY + (target.panY - from.panY) * k;
      viewer.render();
      viewer.onTransformChange?.();
      if (t < 1) {
        viewer.flipFrameId = requestAnimationFrame(step);
      } else {
        viewer.flipFrameId = null;
        resolve(true);
      }
    };
    viewer.flipFrameId = requestAnimationFrame(step);
  });
}
