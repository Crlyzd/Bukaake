/**
 * Bukaake Frosted Glass Loading Indicator Component
 * Provides smooth debounced visual feedback for heavy file loading and decoding.
 * Debounce threshold of 80ms avoids flicker on instant local cached images.
 */

export class LoadingIndicator {
  constructor(pillElementId = 'loadingPill') {
    this.element = document.getElementById(pillElementId);
    this.timer = null;
    this.isVisible = false;
  }

  getElement() {
    if (!this.element || !document.body.contains(this.element)) {
      this.element = document.getElementById('loadingPill');
    }
    return this.element;
  }

  show(message = 'Loading image...') {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const el = this.getElement();
      if (!el) return;
      const textEl = el.querySelector('.loading-text');
      if (textEl) textEl.textContent = message;
      el.classList.remove('hidden');
      requestAnimationFrame(() => {
        el.classList.add('visible');
        this.isVisible = true;
      });
    }, 80);
  }

  hide() {
    clearTimeout(this.timer);
    this.timer = null;
    if (!this.isVisible) {
      const el = this.getElement();
      el?.classList.add('hidden');
      el?.classList.remove('visible');
      return;
    }
    const el = this.getElement();
    if (!el) return;
    el.classList.remove('visible');
    setTimeout(() => {
      el.classList.add('hidden');
      this.isVisible = false;
    }, 180);
  }
}

export const loadingIndicator = new LoadingIndicator();
