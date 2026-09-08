/**
 * Bukaake Screen Snipper Component
 * Interactive drag-to-snip overlay with dimensions tag and stroke-free glass controls (< 190 lines)
 */

export class ScreenSnipper {
  constructor(containerEl = null) {
    this.container = containerEl || document.body;
    this.overlay = null;
    this.bgImg = null;
    this.box = null;
    this.dimTag = null;
    this.actionDock = null;

    this.isDragging = false;
    this.startX = 0;
    this.startY = 0;
    this.currentRect = null;
    this.currentDataUrl = null;

    this.onComplete = null;
    this.onCancel = null;

    this.createDom();
  }

  createDom() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'screen-snipper-overlay hidden';

    this.bgImg = document.createElement('img');
    this.bgImg.className = 'snipper-bg-img';
    this.bgImg.alt = 'Screen Freeze';

    this.box = document.createElement('div');
    this.box.className = 'snipper-selection-box hidden';

    this.dimTag = document.createElement('div');
    this.dimTag.className = 'snipper-dim-tag';
    this.dimTag.textContent = '0 × 0';

    this.actionDock = document.createElement('div');
    this.actionDock.className = 'snipper-action-dock glass-panel';
    this.actionDock.innerHTML = `
      <button class="snipper-btn confirm" id="btnSnipConfirm" title="Open in Bukaake (Enter)">
        <i class="ri-check-line"></i> Open
      </button>
      <button class="snipper-btn" id="btnSnipCopy" title="Copy to Clipboard (Ctrl+C)">
        <i class="ri-clipboard-line"></i> Copy
      </button>
      <button class="snipper-btn cancel" id="btnSnipCancel" title="Cancel (Esc)">
        <i class="ri-close-line"></i>
      </button>
    `;

    this.box.appendChild(this.dimTag);
    this.box.appendChild(this.actionDock);
    this.overlay.appendChild(this.bgImg);
    this.overlay.appendChild(this.box);
    this.container.appendChild(this.overlay);

    this.bindEvents();
  }

  bindEvents() {
    this.overlay.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', () => this.onMouseUp());

    this.overlay.querySelector('#btnSnipConfirm')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.confirmSnip(false);
    });

    this.overlay.querySelector('#btnSnipCopy')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.confirmSnip(true);
    });

    this.overlay.querySelector('#btnSnipCancel')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.cancelSnip();
    });

    window.addEventListener('keydown', (e) => {
      if (this.overlay.classList.contains('hidden')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        this.cancelSnip();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.confirmSnip(false);
      }
    });
  }

  startSnip(captureDataUrl, onComplete, onCancel) {
    this.currentDataUrl = captureDataUrl;
    this.onComplete = onComplete;
    this.onCancel = onCancel;
    this.currentRect = null;

    this.bgImg.src = captureDataUrl;
    this.box.classList.add('hidden');
    this.overlay.classList.remove('hidden');
  }

  onMouseDown(e) {
    if (e.target.closest('.snipper-action-dock')) return;
    this.isDragging = true;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.updateBox(this.startX, this.startY, 0, 0);
    this.box.classList.remove('hidden');
  }

  onMouseMove(e) {
    if (!this.isDragging) return;
    const curX = e.clientX;
    const curY = e.clientY;

    const x = Math.min(this.startX, curX);
    const y = Math.min(this.startY, curY);
    const w = Math.abs(curX - this.startX);
    const h = Math.abs(curY - this.startY);

    this.updateBox(x, y, w, h);
  }

  onMouseUp() {
    if (!this.isDragging) return;
    this.isDragging = false;
    if (this.currentRect && (this.currentRect.width < 10 || this.currentRect.height < 10)) {
      this.box.classList.add('hidden');
      this.currentRect = null;
    }
  }

  updateBox(x, y, w, h) {
    this.currentRect = { x, y, width: w, height: h };
    this.box.style.left = `${x}px`;
    this.box.style.top = `${y}px`;
    this.box.style.width = `${w}px`;
    this.box.style.height = `${h}px`;
    this.dimTag.textContent = `${Math.round(w)} × ${Math.round(h)}`;
  }

  confirmSnip(copyOnly = false) {
    if (!this.currentRect || this.currentRect.width <= 5 || this.currentRect.height <= 5) {
      this.cancelSnip();
      return;
    }
    const rect = { ...this.currentRect };
    const dataUrl = this.currentDataUrl;
    this.hide();
    this.onComplete?.({ rect, dataUrl, copyOnly });
  }

  cancelSnip() {
    this.hide();
    this.onCancel?.();
  }

  hide() {
    this.overlay.classList.add('hidden');
    this.box.classList.add('hidden');
    this.bgImg.src = '';
    this.currentDataUrl = null;
    this.currentRect = null;
  }
}
