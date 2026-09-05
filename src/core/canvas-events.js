/**
 * Bukaake Canvas Event Handlers (Wheel, Pan, Resize, Inertia)
 */

export function attachCanvasInteractions(viewer) {
  const { canvas } = viewer;

  window.addEventListener('resize', () => viewer.resizeCanvas());
  if (window.ResizeObserver && viewer.container) {
    viewer.resizeObserver = new ResizeObserver(() => viewer.resizeCanvas());
    viewer.resizeObserver.observe(viewer.container);
  }

  canvas.addEventListener('wheel', (e) => {
    if (!viewer.img) return;
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.16 : 0.86;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const nextScale = Math.max(0.05, Math.min(viewer.targetScale * zoomFactor, 50.0));

    viewer.targetPanX = mx - (mx - viewer.targetPanX) * (nextScale / viewer.targetScale);
    viewer.targetPanY = my - (my - viewer.targetPanY) * (nextScale / viewer.targetScale);
    viewer.targetScale = nextScale;
    viewer.startSmoothAnimation();
  }, { passive: false });

  let mouseDownX = 0;
  let mouseDownY = 0;

  canvas.addEventListener('mousedown', (e) => {
    if (!viewer.img || e.button !== 0) return;
    mouseDownX = e.clientX;
    mouseDownY = e.clientY;
    viewer.isPanning = true;
    viewer.startX = e.clientX - viewer.panX;
    viewer.startY = e.clientY - viewer.panY;
    viewer.targetPanX = viewer.panX;
    viewer.targetPanY = viewer.panY;
    viewer.velocityX = 0;
    viewer.velocityY = 0;
    viewer.lastMouseX = e.clientX;
    viewer.lastMouseY = e.clientY;
    viewer.lastMouseTime = performance.now();
    canvas.classList.add('panning');
  });

  window.addEventListener('mousemove', (e) => {
    if (!viewer.isPanning) return;
    const now = performance.now();
    const dt = Math.max(1, now - viewer.lastMouseTime);
    const vx = ((e.clientX - viewer.lastMouseX) / dt) * 16;
    const vy = ((e.clientY - viewer.lastMouseY) / dt) * 16;

    viewer.velocityX = viewer.velocityX * 0.3 + vx * 0.7;
    viewer.velocityY = viewer.velocityY * 0.3 + vy * 0.7;
    viewer.lastMouseX = e.clientX;
    viewer.lastMouseY = e.clientY;
    viewer.lastMouseTime = now;

    viewer.panX = e.clientX - viewer.startX;
    viewer.panY = e.clientY - viewer.startY;
    viewer.targetPanX = viewer.panX;
    viewer.targetPanY = viewer.panY;
    viewer.render();
    viewer.onTransformChange?.();
  });

  window.addEventListener('mouseup', (e) => {
    if (viewer.isPanning) {
      viewer.isPanning = false;
      canvas.classList.remove('panning');
      if (Math.hypot(viewer.velocityX, viewer.velocityY) > 0.5) {
        viewer.startSmoothAnimation();
      }

      // Check if mouse released without drag (clean single click)
      const dist = Math.hypot(e.clientX - mouseDownX, e.clientY - mouseDownY);
      if (dist < 5) {
        const isInside = viewer.isPointInsideImage(e.clientX, e.clientY);
        if (!isInside && viewer.onOutsideClick) {
          viewer.onOutsideClick(e);
        }
      }
    }
  });

  canvas.addEventListener('dblclick', (e) => {
    if (!viewer.img) return;
    if (viewer.onToggleMode) {
      viewer.onToggleMode();
      return;
    }
    const fit = viewer.calculateFitScale();
    if (Math.abs(viewer.targetScale - fit) < 0.05) {
      viewer.zoomTo(1.0);
    } else {
      viewer.fitToScreen();
    }
  });
}
