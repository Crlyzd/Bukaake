/**
 * Bukaake Titlebar Capture Popover Menu
 * Stroke-free floating glass dropdown for capture actions (< 130 lines)
 */

export class CaptureMenu {
  constructor(options = {}) {
    this.anchorBtn = options.anchorBtn || null;
    this.onCaptureFullscreen = options.onCaptureFullscreen || null;
    this.onCaptureSnip = options.onCaptureSnip || null;
    this.onToggleRecord = options.onToggleRecord || null;

    this.menu = null;
    this.isOpen = false;
    this.createDom();
  }

  createDom() {
    this.menu = document.createElement('div');
    this.menu.className = 'capture-popover-menu glass-panel hidden';
    this.menu.innerHTML = `
      <button class="capture-menu-item" id="menuItemSnip">
        <i class="ri-screenshot-2-line"></i>
        <div class="menu-item-text">
          <span>Snip Region</span>
          <kbd>Ctrl+Alt+S</kbd>
        </div>
      </button>
      <button class="capture-menu-item" id="menuItemFullscreen">
        <i class="ri-aspect-ratio-line"></i>
        <div class="menu-item-text">
          <span>Full Screen</span>
          <kbd>PrtScn</kbd>
        </div>
      </button>
      <div class="capture-menu-divider"></div>
      <button class="capture-menu-item record" id="menuItemRecord">
        <i class="ri-video-record-line"></i>
        <div class="menu-item-text">
          <span>Record Screen</span>
          <kbd>Ctrl+Alt+R</kbd>
        </div>
      </button>
    `;

    document.body.appendChild(this.menu);
    this.bindEvents();
  }

  bindEvents() {
    this.anchorBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    this.menu.querySelector('#menuItemSnip')?.addEventListener('click', () => {
      this.close();
      this.onCaptureSnip?.();
    });

    this.menu.querySelector('#menuItemFullscreen')?.addEventListener('click', () => {
      this.close();
      this.onCaptureFullscreen?.();
    });

    this.menu.querySelector('#menuItemRecord')?.addEventListener('click', () => {
      this.close();
      this.onToggleRecord?.();
    });

    window.addEventListener('click', (e) => {
      if (this.isOpen && !this.menu.contains(e.target) && e.target !== this.anchorBtn) {
        this.close();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (this.isOpen && e.key === 'Escape') {
        this.close();
      }
    });
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    if (!this.anchorBtn) return;
    const rect = this.anchorBtn.getBoundingClientRect();
    this.menu.style.top = `${rect.bottom + 8}px`;
    this.menu.style.right = `${window.innerWidth - rect.right}px`;
    this.menu.classList.remove('hidden');
    this.isOpen = true;
  }

  close() {
    this.menu.classList.add('hidden');
    this.isOpen = false;
  }
}
