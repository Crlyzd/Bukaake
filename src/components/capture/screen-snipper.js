/**
 * Bukaake Screen Snipper Component
 * Interactive drag-to-snip overlay with dimensions tag, OCR, and Color Picker submodules (< 240 lines)
 */

import { SnipperColorPicker } from './snipper-color-picker.js';
import { snipperOcr } from './snipper-ocr.js';

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
    this.colorPicker = new SnipperColorPicker();
    this.createDom();
  }

  createDom() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'screen-snipper-overlay hidden';
    this.overlay.innerHTML = `
      <img class="snipper-bg-img" alt="Screen Freeze" />
      <div class="snipper-mode-dock glass-panel">
        <div class="snipper-type-toggle">
          <button class="snipper-pill-btn active" id="btnTypeScreenshot" title="Screenshot Mode"><i class="ri-screenshot-line"></i></button>
          <button class="snipper-pill-btn" id="btnTypeRecord" title="Screen Record Mode"><i class="ri-video-on-line"></i></button>
        </div>
        <div class="snipper-dock-divider"></div>
        <div class="snipper-region-modes">
          <button class="snipper-pill-btn active" id="btnModeRegion" title="Region Snip"><i class="ri-screenshot-2-line"></i> <span>Region</span></button>
          <button class="snipper-pill-btn" id="btnModeWindow" title="Active Window"><i class="ri-window-line"></i> <span>Window</span></button>
          <button class="snipper-pill-btn" id="btnModeFullscreen" title="Full Screen"><i class="ri-aspect-ratio-line"></i> <span>Full Screen</span></button>
        </div>
        <div class="snipper-dock-divider"></div>
        <div class="snipper-tools-group">
          <button class="snipper-pill-btn" id="btnModeOcr" title="Read Text (OCR)"><i class="ri-character-recognition-line"></i></button>
          <button class="snipper-pill-btn" id="btnModeColorPicker" title="Color Picker (Eyedropper)"><i class="ri-sip-line"></i></button>
        </div>
        <div class="snipper-dock-divider"></div>
        <button class="snipper-pill-btn cancel" id="btnSnipperClose" title="Close (Esc)"><i class="ri-close-line"></i></button>
      </div>
      <div class="snipper-selection-box hidden"><div class="snipper-dim-tag">0 × 0</div></div>
      <div class="snipper-action-dock glass-panel hidden">
        <button class="snipper-btn confirm" id="btnSnipConfirm" title="Open in Bukaake (Enter)"><i class="ri-check-line"></i> <span id="snipConfirmLabel">Open</span></button>
        <button class="snipper-btn" id="btnSnipCopy" title="Copy to Clipboard (Ctrl+C)"><i class="ri-file-copy-line"></i> Copy</button>
        <button class="snipper-btn" id="btnSnipOcr" title="Read Text (OCR)"><i class="ri-character-recognition-line"></i></button>
        <button class="snipper-btn cancel" id="btnSnipCancel" title="Cancel (Esc)"><i class="ri-close-line"></i></button>
      </div>`;

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
    window.addEventListener('resize', () => this.handleResize());

    this.overlay.querySelector('#btnSnipConfirm')?.addEventListener('click', (e) => { e.stopPropagation(); this.confirmSnip(false); });
    this.overlay.querySelector('#btnSnipCopy')?.addEventListener('click', (e) => { e.stopPropagation(); this.confirmSnip(true); });
    this.overlay.querySelector('#btnSnipOcr')?.addEventListener('click', (e) => { e.stopPropagation(); this.confirmOcr(); });
    this.overlay.querySelector('#btnSnipCancel')?.addEventListener('click', (e) => { e.stopPropagation(); this.cancelSnip(); });

    this.modeDock.addEventListener('mousedown', (e) => e.stopPropagation());
    this.modeDock.addEventListener('click', (e) => e.stopPropagation());
    this.actionDock.addEventListener('mousedown', (e) => e.stopPropagation());

    const modeMap = { btnModeRegion: 'region', btnModeWindow: 'window', btnModeFullscreen: 'fullscreen', btnModeOcr: 'ocr', btnModeColorPicker: 'color' };
    Object.entries(modeMap).forEach(([id, m]) => this.modeDock.querySelector(`#${id}`)?.addEventListener('click', () => this.setMode(m)));
    this.modeDock.querySelector('#btnTypeScreenshot')?.addEventListener('click', () => this.setType('screenshot'));
    this.modeDock.querySelector('#btnTypeRecord')?.addEventListener('click', () => this.setType('record'));
    this.modeDock.querySelector('#btnSnipperClose')?.addEventListener('click', () => this.cancelSnip());
    this.box.addEventListener('dblclick', (e) => { e.stopPropagation(); this.confirmSnip(false); });

    window.addEventListener('keydown', (e) => {
      if (this.overlay.classList.contains('hidden')) return;
      if (e.key === 'Escape') { e.preventDefault(); this.cancelSnip(); }
      else if (e.key === 'Enter') { e.preventDefault(); this.confirmSnip(false); }
      else if (e.ctrlKey && e.key.toLowerCase() === 'c') { e.preventDefault(); this.confirmSnip(true); }
    });
  }

  handleResize() {
    if (!this.isActive || this.currentMode !== 'fullscreen') return;
    const physW = Math.round(window.innerWidth * this.screenDpr), physH = Math.round(window.innerHeight * this.screenDpr);
    this.currentRect = { x: 0, y: 0, width: physW, height: physH, cssX: 0, cssY: 0, cssWidth: window.innerWidth, cssHeight: window.innerHeight };
    Object.assign(this.box.style, { left: '0px', top: '0px', width: `${window.innerWidth}px`, height: `${window.innerHeight}px` });
    this.dimTag.textContent = `${window.innerWidth} × ${window.innerHeight} • Click anywhere to capture`;
  }

  get isActive() { return this.overlay && !this.overlay.classList.contains('hidden'); }

  setType(type) {
    this.currentType = type;
    this.modeDock.querySelector('#btnTypeScreenshot')?.classList.toggle('active', type === 'screenshot');
    this.modeDock.querySelector('#btnTypeRecord')?.classList.toggle('active', type === 'record');
    const isRec = type === 'record';
    const confirmLabel = this.actionDock.querySelector('#snipConfirmLabel');
    const confirmIcon = this.actionDock.querySelector('#btnSnipConfirm i');
    if (confirmLabel) confirmLabel.textContent = isRec ? 'Record' : 'Open';
    if (confirmIcon) confirmIcon.className = isRec ? 'ri-video-on-line' : 'ri-check-line';
    this.actionDock.querySelector('#btnSnipCopy')?.classList.toggle('hidden', isRec);
    this.actionDock.querySelector('#btnSnipOcr')?.classList.toggle('hidden', isRec);
    localStorage.setItem('bukaake-capture-type', type);
  }

  setMode(mode) {
    this.currentMode = mode;
    this.modeDock.querySelectorAll('.snipper-pill-btn').forEach((b) => {
      if (b.id !== 'btnTypeScreenshot' && b.id !== 'btnTypeRecord') b.classList.remove('active');
    });
    this.actionDock.classList.add('hidden');
    this.colorPicker.deactivate();
    this.overlay.classList.toggle('mode-color-picker', mode === 'color');
    this.overlay.classList.toggle('mode-window', mode === 'window');
    this.overlay.classList.toggle('mode-fullscreen', mode === 'fullscreen');

    if (mode === 'color') {
      this.modeDock.querySelector('#btnModeColorPicker')?.classList.add('active');
      this.box.classList.add('hidden');
      this.currentRect = null;
      this.colorPicker.activate(this.bgImg, this.screenDpr, () => this.cancelSnip());
      return;
    }

    if (mode === 'fullscreen') {
      this.modeDock.querySelector('#btnModeFullscreen')?.classList.add('active');
      const physW = Math.round(window.innerWidth * this.screenDpr), physH = Math.round(window.innerHeight * this.screenDpr);
      this.currentRect = { x: 0, y: 0, width: physW, height: physH, cssX: 0, cssY: 0, cssWidth: window.innerWidth, cssHeight: window.innerHeight };
      Object.assign(this.box.style, { left: '0px', top: '0px', width: `${window.innerWidth}px`, height: `${window.innerHeight}px` });
      this.dimTag.textContent = `${window.innerWidth} × ${window.innerHeight} • Click anywhere to capture`;
      this.box.classList.remove('hidden');
    } else {
      this.modeDock.querySelector(mode === 'ocr' ? '#btnModeOcr' : (mode === 'window' ? '#btnModeWindow' : '#btnModeRegion'))?.classList.add('active');
      this.box.classList.add('hidden');
      this.currentRect = null;
    }
  }

  async startSnip(captureDataUrl, onComplete, onCancel, options = {}) {
    this.currentDataUrl = captureDataUrl;
    this.onComplete = onComplete;
    this.onCancel = onCancel;
    this.currentRect = null;

    const isStale = !window.innerWidth || window.innerWidth <= 680;
    const fallbackRatio = (!isStale && options.screenWidth) ? (options.screenWidth / window.innerWidth) : null;
    this.screenDpr = options.scaleFactor || window.devicePixelRatio || fallbackRatio || 1;

    this.detectedWindows = (options.windows || []).map((w) => ({
      ...w,
      cssX: w.x / this.screenDpr, cssY: w.y / this.screenDpr,
      cssWidth: w.width / this.screenDpr, cssHeight: w.height / this.screenDpr,
    }));

    this.bgImg.src = captureDataUrl;
    if (this.bgImg.decode) await this.bgImg.decode().catch(() => {});

    this.box.classList.add('hidden');
    this.actionDock.classList.add('hidden');
    this.overlay.classList.remove('hidden');

    const defaultType = options.type || localStorage.getItem('bukaake-capture-type') || 'screenshot';
    const defaultMode = options.mode || 'region';
    this.setType(defaultType);
    this.setMode(defaultMode === 'color' ? 'region' : defaultMode);
  }

  onMouseDown(e) {
    if (this.currentMode === 'color') return;
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
    this.startX = e.clientX; this.startY = e.clientY;
    this.actionDock.classList.add('hidden');
    this.updateBox(this.startX, this.startY, 0, 0);
    this.box.classList.remove('hidden');
  }

  onMouseMove(e) {
    if (this.currentMode === 'fullscreen' || this.currentMode === 'color') return;

    if (this.currentMode === 'window' && !this.overlay.classList.contains('hidden')) {
      const curX = e.clientX, curY = e.clientY;
      const win = this.detectedWindows.find((w) => curX >= w.cssX && curX <= (w.cssX + w.cssWidth) && curY >= w.cssY && curY <= (w.cssY + w.cssHeight));
      if (win) {
        this.updateBox(win.cssX, win.cssY, win.cssWidth, win.cssHeight);
        const name = win.title ? `${win.title.slice(0, 18)} • ` : '';
        this.dimTag.textContent = `${name}${Math.round(win.cssWidth)} × ${Math.round(win.cssHeight)} • Click to select`;
        this.box.classList.remove('hidden');
      }
      return;
    }

    if (!this.isDragging) return;
    const curX = e.clientX, curY = e.clientY;
    this.updateBox(Math.min(this.startX, curX), Math.min(this.startY, curY), Math.abs(curX - this.startX), Math.abs(curY - this.startY));
  }

  onMouseUp() {
    if (!this.isDragging) return;
    this.isDragging = false;
    if (this.currentRect && (this.currentRect.width < 10 || this.currentRect.height < 10)) {
      this.box.classList.add('hidden');
      this.actionDock.classList.add('hidden');
      this.currentRect = null;
    } else if (this.currentMode === 'ocr' && this.currentRect) {
      this.confirmOcr();
    } else if (this.currentMode === 'region' && this.currentRect) {
      this.actionDock.classList.remove('hidden');
      this.positionActionDock();
    }
  }

  positionActionDock() {
    if (!this.currentRect) return;
    const rect = this.currentRect, dockH = 44, dockW = this.actionDock.offsetWidth || 180, halfW = dockW / 2;
    const spaceBelow = window.innerHeight - (rect.cssY + rect.cssHeight);
    const top = spaceBelow > dockH + 12 ? (rect.cssY + rect.cssHeight + 8) : Math.max(12, rect.cssY - dockH - 8);
    const centerX = rect.cssX + (rect.cssWidth / 2);
    const left = Math.min(Math.max(halfW + 12, centerX), window.innerWidth - halfW - 12);
    Object.assign(this.actionDock.style, { left: `${left}px`, top: `${top}px` });
  }

  updateBox(cssX, cssY, cssW, cssH) {
    const dpr = this.screenDpr;
    this.currentRect = { x: Math.round(cssX * dpr), y: Math.round(cssY * dpr), width: Math.round(cssW * dpr), height: Math.round(cssH * dpr), cssX, cssY, cssWidth: cssW, cssHeight: cssH };
    Object.assign(this.box.style, { left: `${cssX}px`, top: `${cssY}px`, width: `${cssW}px`, height: `${cssH}px` });
    this.dimTag.textContent = `${Math.round(cssW)} × ${Math.round(cssH)}`;
    if (this.currentMode !== 'region' || this.isDragging) this.actionDock.classList.add('hidden');
  }

  async confirmOcr() {
    if (!this.currentRect || this.currentRect.width <= 5 || this.currentRect.height <= 5) return this.cancelSnip();
    const rect = { ...this.currentRect, screenDpr: this.screenDpr };
    await snipperOcr.runOcr({
      dataUrl: this.currentDataUrl, rect, sourceImg: this.bgImg,
      boxEl: this.box, actionDockEl: this.actionDock, onFinish: () => this.cancelSnip(),
    });
  }

  async confirmSnip(copyOnly = false) {
    if (!this.currentRect || this.currentRect.width <= 5 || this.currentRect.height <= 5) return this.cancelSnip();
    const rect = { ...this.currentRect, mode: this.currentMode, isWindow: this.currentMode === 'window', isFullscreen: this.currentMode === 'fullscreen', screenDpr: this.screenDpr };
    const dataUrl = this.currentDataUrl, sourceImg = this.bgImg, isRecord = this.currentType === 'record';
    localStorage.setItem('bukaake-last-region', JSON.stringify({ x: rect.x, y: rect.y, width: rect.width, height: rect.height }));
    this.hideVisuals();
    try { await this.onComplete?.({ rect, dataUrl, sourceImg, copyOnly, isRecord, mode: this.currentMode }); }
    finally { this.cleanup(); }
  }

  cancelSnip() { this.hide(); this.onCancel?.(); }
  hideVisuals() {
    this.colorPicker.deactivate();
    this.overlay.classList.remove('mode-color-picker', 'mode-window', 'mode-fullscreen');
    this.box.classList.remove('loading-ocr');
    this.overlay.classList.add('hidden');
    this.box.classList.add('hidden');
    this.actionDock.classList.add('hidden');
  }
  cleanup() {
    this.hideVisuals();
    this.bgImg.src = '';
    this.currentDataUrl = null;
    this.currentRect = null;
  }
  hide() { this.cleanup(); }
}
