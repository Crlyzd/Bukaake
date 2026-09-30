/**
 * Bukaake Shortcuts Modal Component
 * Displays keyboard shortcuts overlay
 */

export class ShortcutsModal {
  constructor() {
    this.container = document.getElementById('helpModal');
    this.init();
  }

  init() {
    document.getElementById('btnCloseHelp')?.addEventListener('click', () => {
      this.hide();
    });

    this.container?.addEventListener('click', (e) => {
      if (e.target === this.container) {
        this.hide();
      }
    });
  }

  toggle() {
    if (this.container) {
      const isHidden = this.container.classList.toggle('hidden');
      return !isHidden;
    }
    return false;
  }

  show() {
    this.container?.classList.remove('hidden');
  }

  hide() {
    this.container?.classList.add('hidden');
  }

  isOpen() {
    return this.container && !this.container.classList.contains('hidden');
  }
}
