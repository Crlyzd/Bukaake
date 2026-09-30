/**
 * Bukaake Screen Snipper Component
 * Interactive drag-to-snip overlay with dimensions tag, OCR, and Color Picker submodules (< 260 lines)
 */

import { SnipperActionDock } from './snipper-action-dock.js';
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
    this.detectedWindows = []; this.screenDpr = 1; this.isWindowLocked = false;
    this.onComplete = null; this.onCancel = null;
    this.colorPicker = new SnipperColorPicker();
    this.createDom();
  }

  createDom() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'screen-snipper-overlay hidden';
    this.overlay.innerHTML = `<img class="snipper-bg-img" alt="Screen Freeze" /><div class="snipper-mode-dock glass-panel">` +
      `<div class="snipper-type-toggle"><button class="snipper-pill-btn active" id="btnTypeScreenshot" title="Screenshot Mode"><i class="ri-screenshot-line"></i></button>` +
      `<button class="snipper-pill-btn" id="btnTypeRecord" title="Screen Record Mode"><i class="ri-video-on-line"></i></button></div>` +
      `<div class="snipper-dock-divider"></div><div class="snipper-region-modes">` +
      `<button class="snipper-pill-btn active" id="btnModeRegion" title="Region Snip"><i class="ri-screenshot-2-line"></i> <span>Region</span></button>` +
      `<button class="snipper-pill-btn" id="btnModeWindow" title="Active Window"><i class="ri-window-line"></i> <span>Window</span></button>` +
      `<button class="snipper-pill-btn" id="btnModeFullscreen" title="Full Screen"><i class="ri-aspect-ratio-line"></i> <span>Full Screen</span></button></div>` +
      `<div class="snipper-dock-divider"></div><div class="snipper-tools-group">` +
      `<button class="snipper-pill-btn" id="btnModeOcr" title="Read Text (OCR)"><i class="ri-character-recognition-line"></i></button>` +
      `<button class="snipper-pill-btn" id="btnModeColorPicker" title="Color Picker (Eyedropper)"><i class="ri-sip-line"></i></button></div>` +
      `<div class="snipper-dock-divider"></div><button class="snipper-pill-btn cancel" id="btnSnipperClose" title="Close (Esc)"><i class="ri-close-line"></i></button></div>` +
      `<div class="snipper-selection-box hidden"><div class="snipper-dim-tag">0 × 0</div></div>`;

    this.bgImg = this.overlay.querySelector('.snipper-bg-img');
    this.modeDock = this.overlay.querySelector('.snipper-mode-dock');
    this.box = this.overlay.querySelector('.snipper-selection-box');
    this.dimTag = this.overlay.querySelector('.snipper-dim-tag');

    this.actionDock = new SnipperActionDock(this.overlay, {
      onConfirm: () => this.confirmSnip(false),
      onCopy: () => this.confirmSnip(true),
      onOcr: () => this.confirmOcr(),
      onCancel: () => this.cancelSnip(),
    });

    this.container.appendChild(this.overlay);
    this.bindEvents();
  }

  bindEvents() {
    this.overlay.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', () => this.onMouseUp());
    window.addEventListener('resize', () => this.handleResize());
    this.modeDock.addEventListener('mousedown', (e) => e.stopPropagation());
    this.modeDock.addEventListener('click', (e) => e.stopPropagation());

    const modeMap = { btnModeRegion: 'region', btnModeWindow: 'window', btnModeFullscreen: 'fullscreen', btnModeOcr: 'ocr', btnModeColorPicker: 'color' };
    Object.entries(modeMap).forEach(([id, m]) => this.modeDock.querySelector(`#${id}`)?.addEventListener('click', () => this.setMode(m)));
    this.modeDock.querySelector('#btnTypeScreenshot')?.addEventListener('click', () => this.setType('screenshot'));
    this.modeDock.querySelector('#btnTypeRecord')?.addEventListener('click', () => this.setType('record'));
    this.modeDock.querySelector('#btnSnipperClose')?.addEventListener('click', () => this.cancelSnip());
    this.box.addEventListener('dblclick', (e) => { e.stopPropagation(); this.confirmSnip(false); });

    window.addEventListener('keydown', (e) => {
      if (this.overlay.classList.contains('hidden')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (this.isWindowLocked) { this.isWindowLocked = false; }
        else { this.cancelSnip(); }
      } else if (e.key === 'Enter') {
        e.preventDefault(); this.confirmSnip(false);
      } else if (e.ctrlKey && e.key.toLowerCase() === 'c') {
        e.preventDefault(); if (this.currentType === 'screenshot') this.confirmSnip(true);
      }
    });
  }

  handleResize() {
    if (!this.isActive) return;
    if (this.currentMode === 'fullscreen') {
      const physW = Math.round(window.innerWidth * this.screenDpr), physH = Math.round(window.innerHeight * this.screenDpr);
      this.currentRect = { x: 0, y: 0, width: physW, height: physH, cssX: 0, cssY: 0, cssWidth: window.innerWidth, cssHeight: window.innerHeight };
      Object.assign(this.box.style, { left: '0px', top: '0px', width: `${window.innerWidth}px`, height: `${window.innerHeight}px` });
      if (this.currentType === 'record') { this.dimTag.textContent = `${window.innerWidth} × ${window.innerHeight} • Full Screen`; this.actionDock.positionFullscreen(); }
    } else if (this.currentMode === 'window' && this.currentType === 'record') {
      this.actionDock.positionFullscreen();
    }
  }

  get isActive() { return this.overlay && !this.overlay.classList.contains('hidden'); }

  targetWindow(win) {
    this.updateBox(win.cssX, win.cssY, win.cssWidth, win.cssHeight);
    const prompt = this.currentType === 'record' ? 'Click window to lock' : 'Click to capture';
    this.dimTag.textContent = `${win.title ? win.title.slice(0, 18) + ' • ' : ''}${Math.round(win.cssWidth)} × ${Math.round(win.cssHeight)} • ${prompt}`;
    this.box.classList.remove('hidden');
  }

  setType(type) {
    this.currentType = type;
    this.modeDock.querySelector('#btnTypeScreenshot')?.classList.toggle('active', type === 'screenshot');
    this.modeDock.querySelector('#btnTypeRecord')?.classList.toggle('active', type === 'record');
    this.actionDock.setType(type);
    localStorage.setItem('bukaake-capture-type', type);

    if (this.currentMode === 'fullscreen' || this.currentMode === 'window') {
      if (type === 'record') {
        if (this.currentMode === 'fullscreen') this.dimTag.textContent = `${window.innerWidth} × ${window.innerHeight} • Full Screen`;
        else if (this.currentMode === 'window' && !this.currentRect && this.detectedWindows[0]) this.targetWindow(this.detectedWindows[0]);
        this.actionDock.positionFullscreen(); this.actionDock.show();
      } else {
        this.actionDock.hide(); this.isWindowLocked = false;
      }
    }
  }

  setMode(mode) {
    this.currentMode = mode; this.isWindowLocked = false;
    this.modeDock.querySelectorAll('.snipper-pill-btn').forEach((b) => {
      if (b.id !== 'btnTypeScreenshot' && b.id !== 'btnTypeRecord') b.classList.remove('active');
    });
    this.actionDock.hide(); this.colorPicker.deactivate();
    this.overlay.classList.toggle('mode-color-picker', mode === 'color');
    this.overlay.classList.toggle('mode-window', mode === 'window');
    this.overlay.classList.toggle('mode-fullscreen', mode === 'fullscreen');

    if (mode === 'color') {
      this.modeDock.querySelector('#btnModeColorPicker')?.classList.add('active');
      this.box.classList.add('hidden'); this.currentRect = null;
      this.colorPicker.activate(this.bgImg, this.screenDpr, () => this.cancelSnip());
      return;
    }

    if (mode === 'fullscreen') {
      this.modeDock.querySelector('#btnModeFullscreen')?.classList.add('active');
      const physW = Math.round(window.innerWidth * this.screenDpr), physH = Math.round(window.innerHeight * this.screenDpr);
      this.currentRect = { x: 0, y: 0, width: physW, height: physH, cssX: 0, cssY: 0, cssWidth: window.innerWidth, cssHeight: window.innerHeight };
      if (this.currentType === 'screenshot') { this.confirmSnip(false); return; }
      Object.assign(this.box.style, { left: '0px', top: '0px', width: `${window.innerWidth}px`, height: `${window.innerHeight}px` });
      this.dimTag.textContent = `${window.innerWidth} × ${window.innerHeight} • Full Screen`;
      this.box.classList.remove('hidden');
      this.actionDock.positionFullscreen(); this.actionDock.show();
      return;
    }

    if (mode === 'window') {
      this.modeDock.querySelector('#btnModeWindow')?.classList.add('active');
      if (this.detectedWindows[0]) this.targetWindow(this.detectedWindows[0]);
      else this.box.classList.add('hidden');
      if (this.currentType === 'record') { this.actionDock.positionFullscreen(); this.actionDock.show(); }
      return;
    }

    this.modeDock.querySelector(mode === 'ocr' ? '#btnModeOcr' : '#btnModeRegion')?.classList.add('active');
    this.box.classList.add('hidden'); this.currentRect = null;
  }

  async startSnip(captureDataUrl, onComplete, onCancel, options = {}) {
    this.currentDataUrl = captureDataUrl; this.onComplete = onComplete; this.onCancel = onCancel;
    this.currentRect = null; this.isWindowLocked = false;
    const isStale = !window.innerWidth || window.innerWidth <= 680;
    const fallbackRatio = (!isStale && options.screenWidth) ? (options.screenWidth / window.innerWidth) : null;
    this.screenDpr = options.scaleFactor || window.devicePixelRatio || fallbackRatio || 1;
    this.detectedWindows = (options.windows || []).map((w) => ({
      ...w, cssX: w.x / this.screenDpr, cssY: w.y / this.screenDpr, cssWidth: w.width / this.screenDpr, cssHeight: w.height / this.screenDpr,
    }));
    this.bgImg.src = captureDataUrl;
    if (this.bgImg.decode) await this.bgImg.decode().catch(() => {});
    this.box.classList.add('hidden'); this.actionDock.hide(); this.overlay.classList.remove('hidden');
    this.setType(options.type || localStorage.getItem('bukaake-capture-type') || 'screenshot');
    this.setMode(options.mode === 'color' ? 'region' : (options.mode || 'region'));
  }

  onMouseDown(e) {
    if (this.currentMode === 'color' || this.currentMode === 'fullscreen') return;
    if (e.target.closest('.snipper-action-dock') || e.target.closest('.snipper-mode-dock')) return;

    if (this.currentMode === 'window') {
      if (this.currentRect && this.currentRect.width > 20) {
        if (this.currentType === 'screenshot') this.confirmSnip(false);
        else { this.isWindowLocked = true; this.dimTag.textContent = `${Math.round(this.currentRect.cssWidth)} × ${Math.round(this.currentRect.cssHeight)} • Window locked`; }
      }
      return;
    }

    this.isDragging = true;
    this.startX = e.clientX; this.startY = e.clientY;
    this.actionDock.hide();
    this.updateBox(this.startX, this.startY, 0, 0);
    this.box.classList.remove('hidden');
  }

  onMouseMove(e) {
    if (this.currentMode === 'fullscreen' || this.currentMode === 'color') return;

    if (this.currentMode === 'window' && !this.overlay.classList.contains('hidden')) {
      if (this.isWindowLocked) return;
      const curX = e.clientX, curY = e.clientY;
      const win = this.detectedWindows.find((w) => curX >= w.cssX && curX <= (w.cssX + w.cssWidth) && curY >= w.cssY && curY <= (w.cssY + w.cssHeight));
      if (win) {
        this.targetWindow(win);
        if (this.currentType === 'record') { this.actionDock.positionFullscreen(); this.actionDock.show(); }
      }
      return;
    }

    if (!this.isDragging) return;
    this.updateBox(Math.min(this.startX, e.clientX), Math.min(this.startY, e.clientY), Math.abs(e.clientX - this.startX), Math.abs(e.clientY - this.startY));
  }

  onMouseUp() {
    if (!this.isDragging) return;
    this.isDragging = false;
    if (this.currentRect && (this.currentRect.width < 10 || this.currentRect.height < 10)) {
      this.box.classList.add('hidden'); this.actionDock.hide(); this.currentRect = null;
    } else if (this.currentMode === 'ocr' && this.currentRect) {
      this.confirmOcr();
    } else if (this.currentMode === 'region' && this.currentRect) {
      this.actionDock.positionNearRect(this.currentRect); this.actionDock.show();
    }
  }

  updateBox(cssX, cssY, cssW, cssH) {
    const dpr = this.screenDpr;
    this.currentRect = { x: Math.round(cssX * dpr), y: Math.round(cssY * dpr), width: Math.round(cssW * dpr), height: Math.round(cssH * dpr), cssX, cssY, cssWidth: cssW, cssHeight: cssH };
    Object.assign(this.box.style, { left: `${cssX}px`, top: `${cssY}px`, width: `${cssW}px`, height: `${cssH}px` });
    this.dimTag.textContent = `${Math.round(cssW)} × ${Math.round(cssH)}`;
    if (this.currentMode !== 'region' || this.isDragging) {
      if (this.currentMode !== 'fullscreen' && this.currentMode !== 'window') this.actionDock.hide();
    }
  }

  async confirmOcr() {
    if (!this.currentRect || this.currentRect.width <= 5 || this.currentRect.height <= 5) return this.cancelSnip();
    const rect = { ...this.currentRect, screenDpr: this.screenDpr };
    await snipperOcr.runOcr({
      dataUrl: this.currentDataUrl, rect, sourceImg: this.bgImg,
      boxEl: this.box, actionDockEl: this.actionDock.el, onFinish: () => this.cancelSnip(),
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
    this.actionDock.hide();
    this.isWindowLocked = false;
  }
  cleanup() { this.hideVisuals(); this.bgImg.src = ''; this.currentDataUrl = null; this.currentRect = null; }
  hide() { this.cleanup(); }
}
