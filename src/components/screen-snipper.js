/**
 * Bukaake Screen Snipper Component
 * Interactive drag-to-snip overlay with dimensions tag, glowing blue box, and glass controls (< 270 lines)
 */

export class ScreenSnipper {
  constructor(containerEl = null) {
    this.container = containerEl || document.body;
    this.overlay = null; this.bgImg = null; this.box = null;
    this.dimTag = null; this.actionDock = null; this.modeDock = null;
    this.isDragging = false; this.startX = 0; this.startY = 0;
    this.currentRect = null; this.currentDataUrl = null;
    this.currentMode = 'region'; this.currentType = 'screenshot';
    this.detectedWindows = []; this.screenDpr = 1;
    this.onComplete = null; this.onCancel = null;
    this.createDom();
  }

  createDom() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'screen-snipper-overlay hidden';
    this.overlay.innerHTML = `
      <img class="snipper-bg-img" alt="Screen Freeze" />
      <div class="snipper-mode-dock glass-panel">
        <div class="snipper-type-toggle">
          <button class="snipper-pill-btn active" id="btnTypeScreenshot" title="Screenshot Mode"><i class="ri-screenshot-fill"></i></button>
          <button class="snipper-pill-btn" id="btnTypeRecord" title="Screen Record Mode"><i class="ri-video-on-line"></i></button>
        </div>
        <div class="snipper-dock-divider"></div>
        <div class="snipper-region-modes">
          <button class="snipper-pill-btn active" id="btnModeRegion" title="Snip Region"><i class="ri-screenshot-2-line"></i> <span>Region</span></button>
          <button class="snipper-pill-btn" id="btnModeWindow" title="Active Window"><i class="ri-window-line"></i> <span>Window</span></button>
          <button class="snipper-pill-btn" id="btnModeFullscreen" title="Full Screen"><i class="ri-aspect-ratio-line"></i> <span>Full Screen</span></button>
        </div>
        <div class="snipper-dock-divider"></div>
        <button class="snipper-pill-btn cancel" id="btnSnipperClose" title="Close (Esc)"><i class="ri-close-line"></i></button>
      </div>
      <div class="snipper-selection-box hidden">
        <div class="snipper-dim-tag">0 × 0</div>
      </div>
      <div class="snipper-action-dock glass-panel hidden">
        <button class="snipper-btn confirm" id="btnSnipConfirm" title="Open in Bukaake (Enter)"><i class="ri-check-line"></i> <span id="snipConfirmLabel">Open</span></button>
        <button class="snipper-btn" id="btnSnipCopy" title="Copy to Clipboard (Ctrl+C)"><i class="ri-clipboard-line"></i> Copy</button>
        <button class="snipper-btn cancel" id="btnSnipCancel" title="Cancel (Esc)"><i class="ri-close-line"></i></button>
      </div>
    `;

    this.bgImg = this.overlay.querySelector('.snipper-bg-img');
    this.modeDock = this.overlay.querySelector('.snipper-mode-dock');
    this.box = this.overlay.querySelector('.snipper-selection-box');
    this.dimTag = this.overlay.querySelector('.snipper-dim-tag');
    this.actionDock = this.overlay.querySelector('.snipper-action-dock');

    this.container.appendChild(this.overlay);
    this.bindEvents();
  }

  bindEvents() {
    this.overlay.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', () => this.onMouseUp());

    this.overlay.querySelector('#btnSnipConfirm')?.addEventListener('click', (e) => { e.stopPropagation(); this.confirmSnip(false); });
    this.overlay.querySelector('#btnSnipCopy')?.addEventListener('click', (e) => { e.stopPropagation(); this.confirmSnip(true); });
    this.overlay.querySelector('#btnSnipCancel')?.addEventListener('click', (e) => { e.stopPropagation(); this.cancelSnip(); });

    this.modeDock.addEventListener('mousedown', (e) => e.stopPropagation());
    this.modeDock.addEventListener('click', (e) => e.stopPropagation());
    this.actionDock.addEventListener('mousedown', (e) => e.stopPropagation());

    this.modeDock.querySelector('#btnTypeScreenshot')?.addEventListener('click', () => this.setType('screenshot'));
    this.modeDock.querySelector('#btnTypeRecord')?.addEventListener('click', () => this.setType('record'));
    this.modeDock.querySelector('#btnModeRegion')?.addEventListener('click', () => this.setMode('region'));
    this.modeDock.querySelector('#btnModeWindow')?.addEventListener('click', () => this.setMode('window'));
    this.modeDock.querySelector('#btnModeFullscreen')?.addEventListener('click', () => this.setMode('fullscreen'));
    this.modeDock.querySelector('#btnSnipperClose')?.addEventListener('click', () => this.cancelSnip());
    this.box.addEventListener('dblclick', (e) => { e.stopPropagation(); this.confirmSnip(false); });

    window.addEventListener('keydown', (e) => {
      if (this.overlay.classList.contains('hidden')) return;
      if (e.key === 'Escape') { e.preventDefault(); this.cancelSnip(); }
      else if (e.key === 'Enter') { e.preventDefault(); this.confirmSnip(false); }
      else if (e.ctrlKey && e.key.toLowerCase() === 'c') { e.preventDefault(); this.confirmSnip(true); }
    });
  }

  get isActive() {
    return this.overlay && !this.overlay.classList.contains('hidden');
  }

  setType(type) {
    this.currentType = type;
    this.modeDock.querySelector('#btnTypeScreenshot')?.classList.toggle('active', type === 'screenshot');
    this.modeDock.querySelector('#btnTypeRecord')?.classList.toggle('active', type === 'record');

    const confirmLabel = this.actionDock.querySelector('#snipConfirmLabel');
    const confirmIcon = this.actionDock.querySelector('#btnSnipConfirm i');
    const btnCopy = this.actionDock.querySelector('#btnSnipCopy');

    if (type === 'record') {
      if (confirmLabel) confirmLabel.textContent = 'Record';
      if (confirmIcon) confirmIcon.className = 'ri-video-on-line';
      btnCopy?.classList.add('hidden');
    } else {
      if (confirmLabel) confirmLabel.textContent = 'Open';
      if (confirmIcon) confirmIcon.className = 'ri-check-line';
      btnCopy?.classList.remove('hidden');
    }
    localStorage.setItem('bukaake-capture-type', type);
  }

  setMode(mode) {
    this.currentMode = mode;
    this.modeDock.querySelectorAll('.snipper-region-modes .snipper-pill-btn').forEach((btn) => {
      btn.classList.remove('active');
    });

    this.actionDock.classList.add('hidden');
    if (mode === 'fullscreen') {
      this.modeDock.querySelector('#btnModeFullscreen')?.classList.add('active');
      const physW = Math.round(window.innerWidth * this.screenDpr);
      const physH = Math.round(window.innerHeight * this.screenDpr);
      this.currentRect = { x: 0, y: 0, width: physW, height: physH, cssX: 0, cssY: 0, cssWidth: window.innerWidth, cssHeight: window.innerHeight };
      Object.assign(this.box.style, { left: '0px', top: '0px', width: `${window.innerWidth}px`, height: `${window.innerHeight}px` });
      this.dimTag.textContent = `${window.innerWidth} × ${window.innerHeight} • Click anywhere to capture`;
      this.box.classList.remove('hidden');
    } else {
      this.modeDock.querySelector(mode === 'window' ? '#btnModeWindow' : '#btnModeRegion')?.classList.add('active');
      this.box.classList.add('hidden');
      this.currentRect = null;
    }
    localStorage.setItem('bukaake-capture-mode', mode);
  }

  startSnip(captureDataUrl, onComplete, onCancel, options = {}) {
    this.currentDataUrl = captureDataUrl;
    this.onComplete = onComplete;
    this.onCancel = onCancel;
    this.currentRect = null;

    // Physical-to-CSS scale: GDI width (physical px) / WebView CSS width
    this.screenDpr = (options.screenWidth && window.innerWidth)
      ? (options.screenWidth / window.innerWidth)
      : (window.devicePixelRatio || 1);

    // Pre-compute CSS-space window rects for hit-testing on the overlay
    this.detectedWindows = (options.windows || []).map((w) => ({
      ...w,
      cssX: w.x / this.screenDpr,
      cssY: w.y / this.screenDpr,
      cssWidth: w.width / this.screenDpr,
      cssHeight: w.height / this.screenDpr,
    }));

    this.bgImg.src = captureDataUrl;
    this.box.classList.add('hidden');
    this.actionDock.classList.add('hidden');
    this.overlay.classList.remove('hidden');

    const defaultType = options.type || localStorage.getItem('bukaake-capture-type') || 'screenshot';
    const defaultMode = options.mode || localStorage.getItem('bukaake-capture-mode') || 'region';
    this.setType(defaultType);
    this.setMode(defaultMode);
  }

  onMouseDown(e) {
    if (e.target.closest('.snipper-action-dock') || e.target.closest('.snipper-mode-dock')) return;

    if (this.currentMode === 'fullscreen') {
      this.updateBox(0, 0, window.innerWidth, window.innerHeight);
      this.confirmSnip(false);
      return;
    }

    if (this.currentMode === 'window') {
      if (this.currentRect && this.currentRect.width > 20) this.confirmSnip(false);
      return;
    }

    this.isDragging = true;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.actionDock.classList.add('hidden');
    this.updateBox(this.startX, this.startY, 0, 0);
    this.box.classList.remove('hidden');
  }

  onMouseMove(e) {
    if (this.currentMode === 'fullscreen') return;

    if (this.currentMode === 'window' && !this.overlay.classList.contains('hidden')) {
      const curX = e.clientX;
      const curY = e.clientY;
      const win = this.detectedWindows.find((w) =>
        curX >= w.cssX && curX <= (w.cssX + w.cssWidth) &&
        curY >= w.cssY && curY <= (w.cssY + w.cssHeight)
      );
      if (win) {
        this.updateBox(win.cssX, win.cssY, win.cssWidth, win.cssHeight);
        const name = win.title ? `${win.title.slice(0, 18)} • ` : '';
        this.dimTag.textContent = `${name}${Math.round(win.cssWidth)} × ${Math.round(win.cssHeight)} • Click to select`;
        this.box.classList.remove('hidden');
      }
      return;
    }

    if (!this.isDragging) return;
    const curX = e.clientX;
    const curY = e.clientY;
    this.updateBox(
      Math.min(this.startX, curX),
      Math.min(this.startY, curY),
      Math.abs(curX - this.startX),
      Math.abs(curY - this.startY)
    );
  }

  onMouseUp() {
    if (!this.isDragging) return;
    this.isDragging = false;
    if (this.currentRect && (this.currentRect.width < 10 || this.currentRect.height < 10)) {
      this.box.classList.add('hidden');
      this.actionDock.classList.add('hidden');
      this.currentRect = null;
    } else if (this.currentMode === 'region' && this.currentRect) {
      this.actionDock.classList.remove('hidden');
      this.positionActionDock();
    }
  }

  positionActionDock() {
    if (!this.currentRect) return;
    const rect = this.currentRect;
    const dockH = 44;
    const dockW = this.actionDock.offsetWidth || 150;
    const halfW = dockW / 2;
    const spaceBelow = window.innerHeight - (rect.cssY + rect.cssHeight);
    const top = spaceBelow > dockH + 12 ? (rect.cssY + rect.cssHeight + 8) : Math.max(12, rect.cssY - dockH - 8);
    const centerX = rect.cssX + (rect.cssWidth / 2);
    const left = Math.min(Math.max(halfW + 12, centerX), window.innerWidth - halfW - 12);
    Object.assign(this.actionDock.style, { left: `${left}px`, top: `${top}px` });
  }

  updateBox(cssX, cssY, cssW, cssH) {
    this.currentRect = {
      x: Math.round(cssX * this.screenDpr),
      y: Math.round(cssY * this.screenDpr),
      width: Math.round(cssW * this.screenDpr),
      height: Math.round(cssH * this.screenDpr),
      cssX, cssY, cssWidth: cssW, cssHeight: cssH,
    };
    Object.assign(this.box.style, { left: `${cssX}px`, top: `${cssY}px`, width: `${cssW}px`, height: `${cssH}px` });
    this.dimTag.textContent = `${Math.round(cssW)} × ${Math.round(cssH)}`;
    if (this.currentMode !== 'region' || this.isDragging) {
      this.actionDock.classList.add('hidden');
    }
  }

  confirmSnip(copyOnly = false) {
    if (!this.currentRect || this.currentRect.width <= 5 || this.currentRect.height <= 5) {
      this.cancelSnip();
      return;
    }
    const rect = {
      ...this.currentRect,
      mode: this.currentMode,
      isWindow: this.currentMode === 'window',
      isFullscreen: this.currentMode === 'fullscreen',
      screenDpr: this.screenDpr,
    };
    const dataUrl = this.currentDataUrl;
    const isRecord = this.currentType === 'record';
    localStorage.setItem('bukaake-last-region', JSON.stringify({ x: rect.x, y: rect.y, width: rect.width, height: rect.height }));
    this.hide();
    this.onComplete?.({ rect, dataUrl, copyOnly, isRecord, mode: this.currentMode });
  }

  cancelSnip() {
    this.hide();
    this.onCancel?.();
  }

  hide() {
    this.overlay.classList.add('hidden');
    this.box.classList.add('hidden');
    this.actionDock.classList.add('hidden');
    this.bgImg.src = '';
    this.currentDataUrl = null;
    this.currentRect = null;
  }
}
