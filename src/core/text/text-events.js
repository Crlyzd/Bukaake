/**
 * Bukaake Text Tool Interaction & Event Dispatcher
 * Middle-click pan, canvas hit-testing, wheel zoom, and viewport sync (< 120 lines).
 */

import { hitTestTextItems } from './text-renderer.js';

export function attachTextInteractions(tool) {
  const { canvas, overlayContainer, viewer } = tool;
  let isPanning = false;
  let panStartX = 0;
  let panStartY = 0;

  const startMiddlePan = (e) => {
    if (!tool.active || !viewer.img || e.button !== 1) return;
    e.preventDefault();
    e.stopPropagation();
    isPanning = true;
    panStartX = e.clientX - viewer.panX;
    panStartY = e.clientY - viewer.panY;
    canvas.classList.add('is-panning');
    document.body.classList.add('text-panning');
  };

  canvas.addEventListener('mousedown', (e) => {
    if (!tool.active || !viewer.img) return;
    if (e.button === 1) return startMiddlePan(e);
    if (e.button !== 0) return;

    const rect = canvas.getBoundingClientRect();
    const pt = viewer.screenToImageCoords(e.clientX - rect.left, e.clientY - rect.top);
    if (pt.x < 0 || pt.x > viewer.img.width || pt.y < 0 || pt.y > viewer.img.height) return;

    const hit = hitTestTextItems(tool.items, pt.x, pt.y, tool.ctx);
    if (hit) tool.selectItem(hit, false, e);
    else tool.commitActiveInput();
  });

  overlayContainer?.addEventListener('mousedown', (e) => {
    if (e.button === 1) startMiddlePan(e);
  });

  window.addEventListener('mousemove', (e) => {
    if (!tool.active || !isPanning) return;
    viewer.panX = e.clientX - panStartX;
    viewer.panY = e.clientY - panStartY;
    viewer.targetPanX = viewer.panX;
    viewer.targetPanY = viewer.panY;
    viewer.render();
    viewer.onTransformChange?.();
  });

  window.addEventListener('mouseup', (e) => {
    if (!isPanning) return;
    isPanning = false;
    canvas.classList.remove('is-panning');
    document.body.classList.remove('text-panning');
    viewer.snapBackToBounds(true);
  });

  canvas.addEventListener('wheel', (e) => {
    if (!tool.active || !viewer.img) return;
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const rect = canvas.getBoundingClientRect();
    viewer.zoomTo(viewer.targetScale * zoomFactor, false, e.clientX - rect.left, e.clientY - rect.top);
  }, { passive: false });

  const preventMiddleAux = (e) => { if (e.button === 1) e.preventDefault(); };
  canvas.addEventListener('auxclick', preventMiddleAux);
  overlayContainer?.addEventListener('auxclick', preventMiddleAux);

  window.addEventListener('resize', () => {
    if (tool.active) {
      tool.syncCanvasSize();
      tool.updateOverlayBox();
    }
  });
}
