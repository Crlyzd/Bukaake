/**
 * Bukaake Delete Confirmation Modal Component
 * Stroke-free frosted glass modal confirming file deletion or move to Recycle Bin (< 90 lines).
 */

export class DeleteModal {
  constructor(containerId = 'deleteModalOverlay') {
    this.overlay = document.getElementById(containerId);
    this.titleEl = document.getElementById('deleteModalTitle');
    this.descEl = document.getElementById('deleteModalDesc');
    this.fileNameTag = document.getElementById('deleteModalFileName');
    this.btnConfirm = document.getElementById('btnDeleteConfirm');
    this.btnCancel = document.getElementById('btnDeleteCancel');

    this.pendingConfirm = null;
    this.initEvents();
  }

  initEvents() {
    this.btnConfirm?.addEventListener('click', async () => {
      const action = this.pendingConfirm;
      this.hide();
      if (typeof action === 'function') {
        await action();
      }
    });

    this.btnCancel?.addEventListener('click', () => {
      this.hide();
    });

    // Dismiss on clicking outside card
    this.overlay?.addEventListener('mousedown', (e) => {
      if (e.target === this.overlay) {
        this.hide();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (!this.isOpen()) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        this.hide();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.btnConfirm?.click();
      }
    });
  }

  show() {
    if (this.overlay) {
      this.overlay.classList.remove('hidden');
      // Always focus cancel button by default for safety against accidental deletion
      requestAnimationFrame(() => this.btnCancel?.focus());
    }
  }

  hide() {
    if (this.overlay) {
      this.overlay.classList.add('hidden');
    }
    this.pendingConfirm = null;
  }

  isOpen() {
    return Boolean(this.overlay && !this.overlay.classList.contains('hidden'));
  }

  prompt({ fileName, isPermanent = false, onConfirm }) {
    this.pendingConfirm = onConfirm;

    if (this.titleEl) {
      this.titleEl.textContent = isPermanent ? 'Delete File Permanently?' : 'Move to Recycle Bin?';
    }
    if (this.descEl) {
      this.descEl.textContent = isPermanent
        ? 'This image will be permanently deleted from disk. This action cannot be undone.'
        : 'Are you sure you want to move this file to the Windows Recycle Bin?';
    }
    if (this.fileNameTag) {
      this.fileNameTag.textContent = fileName || 'Untitled';
    }
    if (this.btnConfirm) {
      this.btnConfirm.textContent = isPermanent ? 'Delete Permanently' : 'Move to Recycle Bin';
    }

    this.show();
  }
}
