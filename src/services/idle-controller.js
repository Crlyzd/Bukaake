import { tauriBridge } from './tauri-bridge.js';

export class IdleController {
  constructor(options = {}) {
    this.titlebarEl = options.titlebar || document.getElementById('appTitlebar');
    this.toolbarEl = options.toolbar || document.getElementById('floatingToolbar');

    this.topThreshold = options.topThreshold || 55;
    this.bottomThreshold = options.bottomThreshold || 140;

    this.isBlocked = options.isBlocked || (() => false);
    this.hasImage = options.hasImage || (() => false);

    this.isOverTitlebar = false;
    this.isOverToolbar = false;
    this.mouseY = -1;

    this.titlebarTimer = null;
    this.toolbarTimer = null;
    this.deepIdleTimer = null;

    this.init();
  }

  init() {
    window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    window.addEventListener('blur', () => {
      setTimeout(() => tauriBridge.trimMemoryWorkingSet(), 3000);
    });
    this.resetDeepIdleTimer();

    this.titlebarEl?.addEventListener('mouseenter', () => {
      this.isOverTitlebar = true;
      this.showTitlebar(true);
    });
    this.titlebarEl?.addEventListener('mouseleave', () => {
      this.isOverTitlebar = false;
      this.scheduleTitlebarHide();
    });

    this.toolbarEl?.addEventListener('mouseenter', () => {
      this.isOverToolbar = true;
      this.showToolbar(true);
    });
    this.toolbarEl?.addEventListener('mouseleave', () => {
      this.isOverToolbar = false;
      this.scheduleToolbarHide();
    });
  }

  handleMouseMove(e) {
    this.mouseY = e.clientY;
    this.resetDeepIdleTimer();

    if (!this.hasImage()) {
      this.showTitlebar(true);
      return;
    }

    if (this.isBlocked()) {
      this.showTitlebar(true);
      this.showToolbar(true);
      return;
    }

    const isNearTop = e.clientY <= this.topThreshold;
    if (isNearTop || this.isOverTitlebar) {
      this.showTitlebar(true);
    } else {
      this.scheduleTitlebarHide();
    }

    const distFromBottom = window.innerHeight - e.clientY;
    const isNearBottom = distFromBottom <= this.bottomThreshold;
    if (isNearBottom || this.isOverToolbar) {
      this.showToolbar(true);
    } else {
      this.scheduleToolbarHide();
    }
  }

  showTitlebar(visible) {
    clearTimeout(this.titlebarTimer);
    if (visible) {
      this.titlebarEl?.classList.add('visible');
    } else {
      if (!this.isOverTitlebar && !this.isBlocked() && this.hasImage()) {
        this.titlebarEl?.classList.remove('visible');
      }
    }
  }

  scheduleTitlebarHide() {
    clearTimeout(this.titlebarTimer);
    this.titlebarTimer = setTimeout(() => {
      this.showTitlebar(false);
    }, 280);
  }

  showToolbar(visible) {
    clearTimeout(this.toolbarTimer);
    if (visible) {
      this.toolbarEl?.classList.add('visible');
    } else {
      if (!this.isOverToolbar && !this.isBlocked() && this.hasImage()) {
        this.toolbarEl?.classList.remove('visible');
      }
    }
  }

  scheduleToolbarHide() {
    clearTimeout(this.toolbarTimer);
    this.toolbarTimer = setTimeout(() => {
      this.showToolbar(false);
    }, 280);
  }

  refreshState() {
    if (!this.hasImage()) {
      this.showTitlebar(true);
      this.showToolbar(false);
    } else {
      this.scheduleTitlebarHide();
      this.scheduleToolbarHide();
    }
  }

  resetDeepIdleTimer() {
    clearTimeout(this.deepIdleTimer);
    this.deepIdleTimer = setTimeout(() => {
      tauriBridge.trimMemoryWorkingSet();
    }, 30000);
  }
}
