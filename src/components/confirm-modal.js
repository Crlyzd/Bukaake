/**
 * Bukaake Unsaved Changes Confirmation Modal
 * Frosted stroke-free glass modal for confirming save, discard, or cancel (< 100 lines).
 */

import { changeTracker } from '../services/change-tracker.js';

export class ConfirmModal {
  constructor(containerId = 'confirmModalOverlay') {
    this.overlay = document.getElementById(containerId);
    this.btnSave = document.getElementById('btnConfirmSave');
    this.btnDiscard = document.getElementById('btnConfirmDiscard');
    this.btnCancel = document.getElementById('btnConfirmCancel');

    this.pendingAction = null;
    this.saveAction = null;

    this.initEvents();
  }

  initEvents() {
    this.btnSave?.addEventListener('click', async () => {
      this.hide();
      if (this.saveAction) {
        const saved = await this.saveAction();
        if (saved !== false && this.pendingAction) {
          this.pendingAction();
        }
      }
      this.pendingAction = null;
      this.saveAction = null;
    });

    this.btnDiscard?.addEventListener('click', () => {
      this.hide();
      changeTracker.reset();
      if (this.pendingAction) {
        this.pendingAction();
      }
      this.pendingAction = null;
      this.saveAction = null;
    });

    this.btnCancel?.addEventListener('click', () => {
      this.hide();
      this.pendingAction = null;
      this.saveAction = null;
    });
  }

  show() {
    if (this.overlay) {
      this.overlay.classList.remove('hidden');
      requestAnimationFrame(() => this.btnSave?.focus());
    }
  }

  hide() {
    if (this.overlay) {
      this.overlay.classList.add('hidden');
    }
  }

  isOpen() {
    return Boolean(this.overlay && !this.overlay.classList.contains('hidden'));
  }

  promptIfDirty(onProceed, onSave = null) {
    if (!changeTracker.hasUnsavedChanges()) {
      if (typeof onProceed === 'function') onProceed();
      return;
    }

    this.pendingAction = onProceed;
    this.saveAction = onSave;
    this.show();
  }
}
