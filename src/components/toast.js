/**
 * Bukaake Toast Notification Component
 * Displays single translucent glass toast alert with debounced replacement
 */

export class ToastManager {
  constructor() {
    this.container = document.getElementById('toastContainer');
    this.currentToast = null;
    this.dismissTimer = null;
  }

  getContainer() {
    if (!this.container || !document.body.contains(this.container)) {
      this.container = document.getElementById('toastContainer');
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.id = 'toastContainer';
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);
      }
    }
    return this.container;
  }

  show(message, icon = 'ri-sparkles-fill', durationMs = 1800, type = 'info') {
    const container = this.getContainer();
    if (!container) return;

    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }

    if (this.currentToast) {
      this.currentToast.remove();
      this.currentToast = null;
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="${icon}"></i> <span>${message}</span>`;
    this.container.appendChild(toast);
    this.currentToast = toast;

    this.dismissTimer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-6px)';
      toast.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
      setTimeout(() => {
        if (this.currentToast === toast) {
          toast.remove();
          this.currentToast = null;
        }
      }, 220);
    }, durationMs);
  }

  warn(message, durationMs = 2600) {
    this.show(message, 'ri-error-warning-line', durationMs, 'warning');
  }

  info(message, durationMs = 1800) {
    this.show(message, 'ri-information-line', durationMs, 'info');
  }
}

export const toast = new ToastManager();
