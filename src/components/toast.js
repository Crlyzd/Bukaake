/**
 * Bukaake Toast Notification Component
 * Displays translucent glass toast alerts
 */

export class ToastManager {
  constructor() {
    this.container = document.getElementById('toastContainer');
  }

  show(message, icon = 'ri-sparkles-fill', durationMs = 2400) {
    if (!this.container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="${icon}"></i> <span>${message}</span>`;
    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, durationMs);
  }
}

export const toast = new ToastManager();
