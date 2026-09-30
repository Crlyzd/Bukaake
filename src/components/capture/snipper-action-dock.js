/**
 * Bukaake Screen Snipper Action Dock Submodule
 * Floating stroke-free frosted glass action bar for Open, Copy, OCR, and Recording (< 120 lines)
 */

export class SnipperActionDock {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.el = null;
    this.btnConfirm = null;
    this.confirmLabel = null;
    this.confirmIcon = null;
    this.btnCopy = null;
    this.btnOcr = null;
    this.btnCancel = null;
    this.createDom();
  }

  createDom() {
    this.el = document.createElement('div');
    this.el.className = 'snipper-action-dock glass-panel hidden';
    this.el.innerHTML = `
      <button class="snipper-btn confirm" id="btnSnipConfirm" title="Open in Bukaake (Enter)">
        <i class="ri-check-line"></i> <span id="snipConfirmLabel">Open</span>
      </button>
      <button class="snipper-btn" id="btnSnipCopy" title="Copy to Clipboard (Ctrl+C)">
        <i class="ri-file-copy-line"></i> <span>Copy</span>
      </button>
      <button class="snipper-btn" id="btnSnipOcr" title="Read Text (OCR)">
        <i class="ri-character-recognition-line"></i>
      </button>
      <button class="snipper-btn cancel" id="btnSnipCancel" title="Cancel (Esc)">
        <i class="ri-close-line"></i>
      </button>
    `;

    this.btnConfirm = this.el.querySelector('#btnSnipConfirm');
    this.confirmLabel = this.el.querySelector('#snipConfirmLabel');
    this.confirmIcon = this.btnConfirm.querySelector('i');
    this.btnCopy = this.el.querySelector('#btnSnipCopy');
    this.btnOcr = this.el.querySelector('#btnSnipOcr');
    this.btnCancel = this.el.querySelector('#btnSnipCancel');

    this.el.addEventListener('mousedown', (e) => e.stopPropagation());
    this.el.addEventListener('click', (e) => e.stopPropagation());

    this.btnConfirm.addEventListener('click', (e) => { e.stopPropagation(); this.callbacks.onConfirm?.(); });
    this.btnCopy.addEventListener('click', (e) => { e.stopPropagation(); this.callbacks.onCopy?.(); });
    this.btnOcr.addEventListener('click', (e) => { e.stopPropagation(); this.callbacks.onOcr?.(); });
    this.btnCancel.addEventListener('click', (e) => { e.stopPropagation(); this.callbacks.onCancel?.(); });

    this.container.appendChild(this.el);
  }

  setType(type) {
    const isRec = type === 'record';
    this.btnConfirm.classList.toggle('record', isRec);
    this.btnConfirm.title = isRec ? 'Start Screen Recording (Enter)' : 'Open in Bukaake (Enter)';
    if (this.confirmLabel) this.confirmLabel.textContent = isRec ? 'Start Recording' : 'Open';
    if (this.confirmIcon) this.confirmIcon.className = isRec ? 'ri-record-circle-line' : 'ri-check-line';
    this.btnCopy?.classList.toggle('hidden', isRec);
    this.btnOcr?.classList.toggle('hidden', isRec);
  }

  positionNearRect(rect) {
    if (!rect) return;
    const dockH = 44, dockW = this.el.offsetWidth || 180, halfW = dockW / 2;
    const spaceBelow = window.innerHeight - (rect.cssY + rect.cssHeight);
    const top = spaceBelow > dockH + 12 ? (rect.cssY + rect.cssHeight + 8) : Math.max(12, rect.cssY - dockH - 8);
    const centerX = rect.cssX + (rect.cssWidth / 2);
    const left = Math.min(Math.max(halfW + 12, centerX), window.innerWidth - halfW - 12);
    Object.assign(this.el.style, { left: `${left}px`, top: `${top}px` });
  }

  positionFullscreen() {
    Object.assign(this.el.style, { left: '50%', top: '76px' });
  }

  show() {
    this.el.classList.remove('hidden');
  }

  hide() {
    this.el.classList.add('hidden');
  }

  get isVisible() {
    return !this.el.classList.contains('hidden');
  }
}
