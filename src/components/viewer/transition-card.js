/**
 * Bukaake Mode Transition Glass Shell
 * Stroke-free frosted card that smoothly materializes during Mode 2 -> Mode 1 exit morph (< 100 lines)
 */

export class TransitionCard {
  constructor() {
    this.el = document.getElementById('modeTransitionCard');
    this.filenameEl = document.getElementById('transitionCardFilename');
    this.sepEl = document.getElementById('transitionCardSep');
    this.dimEl = document.getElementById('transitionCardDimensions');
  }

  /**
   * Pre-stages the card at the exact screen-relative Mode 1 destination
   * and triggers a synchronized fade-in matching the canvas FLIP morph.
   */
  showExitTarget(targetWinRect, info = {}) {
    if (!this.el || !targetWinRect) return;

    const left = Math.round(targetWinRect.x - (window.screenX || 0));
    const top = Math.round(targetWinRect.y - (window.screenY || 0));
    const width = Math.round(targetWinRect.width);
    const height = Math.round(targetWinRect.height);

    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
    this.el.style.width = `${width}px`;
    this.el.style.height = `${height}px`;

    if (this.filenameEl && info.filename) {
      this.filenameEl.textContent = info.filename;
      this.filenameEl.classList.remove('hidden');
      this.sepEl?.classList.remove('hidden');
    } else {
      this.filenameEl?.classList.add('hidden');
      this.sepEl?.classList.add('hidden');
    }

    if (this.dimEl && info.dimensions) {
      this.dimEl.textContent = info.dimensions;
      this.dimEl.classList.remove('hidden');
    } else {
      this.dimEl?.classList.add('hidden');
    }

    this.el.classList.remove('hidden', 'visible');

    requestAnimationFrame(() => {
      if (!this.el) return;
      this.el.classList.add('visible');
    });
  }

  /**
   * Immediately resets and hides the transition shell once the native window is cloaked/committed.
   */
  hide() {
    if (!this.el) return;
    this.el.classList.remove('visible');
    this.el.classList.add('hidden');
    this.el.style.left = '';
    this.el.style.top = '';
    this.el.style.width = '';
    this.el.style.height = '';
    if (this.filenameEl) this.filenameEl.classList.add('hidden');
    if (this.sepEl) this.sepEl.classList.add('hidden');
    if (this.dimEl) this.dimEl.classList.add('hidden');
  }
}

export const transitionCard = new TransitionCard();
