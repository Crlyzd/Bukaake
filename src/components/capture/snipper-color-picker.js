/**
 * Bukaake Screen Snipper Color Picker Submodule
 * Frosted glass magnified loupe with 9x9 zoomed pixel grid, HEX/RGB display, and instant copy (< 190 lines)
 */

import { toast } from '../viewer/toast.js';

export class SnipperColorPicker {
  constructor() {
    this.isActive = false;
    this.loupeEl = null;
    this.loupeCanvas = null;
    this.loupeCtx = null;
    this.infoCard = null;
    this.sampleCanvas = null;
    this.sampleCtx = null;
    this.sourceImg = null;
    this.screenDpr = 1;
    this.onComplete = null;
    this.currentHex = '#000000';
    this.currentRgb = 'rgb(0, 0, 0)';

    this.onMouseMove = this.handleMouseMove.bind(this);
    this.onClick = this.handleClick.bind(this);
  }

  activate(sourceImg, screenDpr, onComplete) {
    this.sourceImg = sourceImg;
    this.screenDpr = screenDpr || window.devicePixelRatio || 1;
    this.onComplete = onComplete;
    this.isActive = true;

    this.createDom();
    this.prepareSampleCanvas();

    window.addEventListener('mousemove', this.onMouseMove, { passive: true });
    window.addEventListener('mousedown', this.onClick, true);
  }

  deactivate() {
    if (!this.isActive) return;
    this.isActive = false;

    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onClick, true);

    if (this.loupeEl?.parentNode) this.loupeEl.parentNode.removeChild(this.loupeEl);
    if (this.infoCard?.parentNode) this.infoCard.parentNode.removeChild(this.infoCard);

    this.loupeEl = null;
    this.loupeCanvas = null;
    this.loupeCtx = null;
    this.infoCard = null;
    this.sampleCanvas = null;
    this.sampleCtx = null;
    this.sourceImg = null;
  }

  prepareSampleCanvas() {
    if (!this.sourceImg) return;
    const w = this.sourceImg.naturalWidth || window.innerWidth * this.screenDpr;
    const h = this.sourceImg.naturalHeight || window.innerHeight * this.screenDpr;

    this.sampleCanvas = document.createElement('canvas');
    this.sampleCanvas.width = w;
    this.sampleCanvas.height = h;
    this.sampleCtx = this.sampleCanvas.getContext('2d', { willReadFrequently: true });
    if (this.sampleCtx) {
      this.sampleCtx.drawImage(this.sourceImg, 0, 0, w, h);
    }
  }

  createDom() {
    // 1. Frosted Glass Loupe Container
    this.loupeEl = document.createElement('div');
    this.loupeEl.className = 'snipper-color-loupe';

    this.loupeCanvas = document.createElement('canvas');
    this.loupeCanvas.width = 90;
    this.loupeCanvas.height = 90;
    this.loupeCanvas.className = 'snipper-loupe-canvas';
    this.loupeCtx = this.loupeCanvas.getContext('2d');
    if (this.loupeCtx) this.loupeCtx.imageSmoothingEnabled = false;

    // Center targeting reticle
    const reticle = document.createElement('div');
    reticle.className = 'snipper-loupe-reticle';

    this.loupeEl.appendChild(this.loupeCanvas);
    this.loupeEl.appendChild(reticle);

    // 2. Info Card with Color Swatch, HEX, and RGB
    this.infoCard = document.createElement('div');
    this.infoCard.className = 'snipper-color-info-card glass-panel';
    this.infoCard.innerHTML = `
      <span class="color-swatch-dot" id="loupeSwatch"></span>
      <span class="color-hex-text" id="loupeHex">#000000</span>
      <span class="color-rgb-text" id="loupeRgb">rgb(0,0,0)</span>
    `;

    document.body.appendChild(this.loupeEl);
    document.body.appendChild(this.infoCard);
  }

  handleMouseMove(e) {
    if (!this.isActive || !this.sampleCtx) return;

    const curX = e.clientX;
    const curY = e.clientY;
    const physX = Math.round(curX * this.screenDpr);
    const physY = Math.round(curY * this.screenDpr);

    // Sample 9x9 pixels centered around cursor (x - 4 to x + 4)
    const gridSize = 9;
    const half = Math.floor(gridSize / 2);
    const startX = Math.max(0, physX - half);
    const startY = Math.max(0, physY - half);

    try {
      const imgData = this.sampleCtx.getImageData(startX, startY, gridSize, gridSize);
      this.renderGrid(imgData, physX - startX, physY - startY);

      // Center pixel color
      const centerPixel = this.sampleCtx.getImageData(physX, physY, 1, 1).data;
      const r = centerPixel[0];
      const g = centerPixel[1];
      const b = centerPixel[2];
      const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;

      this.currentHex = hex;
      this.currentRgb = `rgb(${r}, ${g}, ${b})`;

      // Update Info Card
      const swatch = this.infoCard.querySelector('#loupeSwatch');
      const hexEl = this.infoCard.querySelector('#loupeHex');
      const rgbEl = this.infoCard.querySelector('#loupeRgb');
      if (swatch) swatch.style.background = hex;
      if (hexEl) hexEl.textContent = hex;
      if (rgbEl) rgbEl.textContent = this.currentRgb;

      // Position Loupe and Info Card offset from cursor
      this.positionLoupe(curX, curY);
    } catch (_) {}
  }

  renderGrid(imgData, targetOffsetX, targetOffsetY) {
    if (!this.loupeCtx) return;
    const ctx = this.loupeCtx;
    const pixelSize = 10; // 9 * 10 = 90px

    ctx.clearRect(0, 0, 90, 90);
    const data = imgData.data;
    const w = imgData.width;
    const h = imgData.height;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
      }
    }
  }

  positionLoupe(x, y) {
    const loupeW = 90;
    const loupeH = 90;
    const gap = 20;

    let left = x + gap;
    let top = y + gap;

    if (left + loupeW > window.innerWidth - 12) {
      left = x - loupeW - gap;
    }
    if (top + loupeH + 40 > window.innerHeight - 12) {
      top = y - loupeH - gap - 34;
    }

    if (this.loupeEl) {
      Object.assign(this.loupeEl.style, {
        left: `${left}px`,
        top: `${top}px`,
      });
    }

    if (this.infoCard) {
      Object.assign(this.infoCard.style, {
        left: `${left + (loupeW / 2)}px`,
        top: `${top + loupeH + 8}px`,
      });
    }
  }

  async handleClick(e) {
    if (!this.isActive) return;
    e.preventDefault();
    e.stopPropagation();

    const hex = this.currentHex;
    try {
      await navigator.clipboard.writeText(hex);
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = hex;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }

    toast.show(`Copied ${hex} to clipboard`, 'info');
    const onDone = this.onComplete;
    this.deactivate();
    onDone?.();
  }
}
