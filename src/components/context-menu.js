/**
 * Bukaake Frosted Glass Context Menu Component
 * Stroke-free glass right-click menu for image canvas & viewer actions
 */

import { tauriBridge } from '../services/tauri-bridge.js';
import { toast } from './toast.js';

export class ContextMenu {
  constructor(options = {}) {
    this.container = options.container || document.getElementById('viewportContainer');
    this.getFilePath = options.getFilePath || (() => null);
    this.hasImage = options.hasImage || (() => false);
    this.isCropActive = options.isCropActive || (() => false);
    this.isEditing = options.isEditing || (() => false);
    this.isRaw = options.isRaw || (() => false);
    this.actions = options.actions || {};

    this.menuEl = null;
    this.isOpen = false;
    this.isDev = Boolean(import.meta.env?.DEV);

    this.initDOM();
    this.bindEvents();
  }

  initDOM() {
    this.menuEl = document.createElement('div');
    this.menuEl.className = 'glass-context-menu hidden';
    this.menuEl.setAttribute('role', 'menu');
    document.body.appendChild(this.menuEl);
  }

  bindEvents() {
    // Disable default browser context menu in production builds
    window.addEventListener('contextmenu', (e) => {
      if (!this.isDev) {
        e.preventDefault();
      }
    });

    // Right-click on viewport / canvas
    this.container?.addEventListener('contextmenu', (e) => {
      if (!this.hasImage()) return;
      if (this.isEditing()) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // In dev mode, Shift + Right-Click opens native browser context menu
      if (this.isDev && e.shiftKey) return;

      e.preventDefault();
      e.stopPropagation();
      this.open(e.clientX, e.clientY);
    });

    // Dismiss on click outside or escape key
    document.addEventListener('pointerdown', (e) => {
      if (this.isOpen && !this.menuEl.contains(e.target)) {
        this.close();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (this.isOpen && e.key === 'Escape') {
        this.close();
      }
    });

    window.addEventListener('resize', () => {
      if (this.isOpen) this.close();
    });
  }

  open(x, y) {
    this.renderMenu();
    this.menuEl.classList.remove('hidden');
    this.isOpen = true;

    // Viewport overflow bounds check
    requestAnimationFrame(() => {
      const rect = this.menuEl.getBoundingClientRect();
      const pad = 10;
      let posX = x;
      let posY = y;

      if (posX + rect.width > window.innerWidth - pad) {
        posX = window.innerWidth - rect.width - pad;
      }
      if (posY + rect.height > window.innerHeight - pad) {
        posY = window.innerHeight - rect.height - pad;
      }

      this.menuEl.style.left = `${Math.max(pad, posX)}px`;
      this.menuEl.style.top = `${Math.max(pad, posY)}px`;
    });
  }

  close() {
    if (!this.isOpen) return;
    this.menuEl.classList.add('hidden');
    this.isOpen = false;
  }

  renderMenu() {
    const filePath = this.getFilePath();
    const canOpenFileLocation = Boolean(filePath);

    const items = [
      {
        id: 'open-location',
        label: 'Open File Location',
        icon: 'ri-folder-open-line',
        disabled: !canOpenFileLocation,
        action: () => {
          if (filePath) {
            tauriBridge.showInFolder(filePath);
          } else {
            toast.show('No local file path available');
          }
        },
      },
      {
        id: 'copy-image',
        label: 'Copy Image',
        icon: 'ri-file-copy-line',
        action: () => this.actions.onCopyImage?.(),
      },
      {
        id: 'save-image',
        label: 'Save Image As...',
        icon: 'ri-download-2-line',
        shortcut: 'Ctrl+S',
        disabled: !this.hasImage() || this.isCropActive(),
        action: () => {
          if (this.isCropActive()) {
            toast.show('Please apply or cancel crop before exporting');
            return;
          }
          this.actions.onSaveImage?.();
        },
      },
      { type: 'divider' },
      {
        id: 'rotate-cw',
        label: 'Rotate 90° CW',
        icon: 'ri-clockwise-2-line',
        shortcut: 'R',
        action: () => this.actions.onRotateRight?.(),
      },
      {
        id: 'flip-h',
        label: 'Flip Horizontal',
        icon: 'ri-flip-horizontal-line',
        shortcut: 'H',
        action: () => this.actions.onFlipH?.(),
      },
      {
        id: 'fit-screen',
        label: 'Fit to Screen',
        icon: 'ri-aspect-ratio-line',
        shortcut: 'F',
        action: () => this.actions.onFitScreen?.(),
      },
      ...(this.isRaw() ? [{
        id: 'raw-full-sensor',
        label: 'Load Full Sensor Decode',
        icon: 'ri-focus-2-fill',
        shortcut: 'Q',
        action: () => this.actions.onLoadFullRaw?.(),
      }] : []),
      {
        id: 'crop',
        label: 'Crop Image',
        icon: 'ri-crop-line',
        shortcut: 'C',
        action: () => this.actions.onCrop?.(),
      },
      { type: 'divider' },
      {
        id: 'image-info',
        label: 'Image Properties',
        icon: 'ri-information-line',
        shortcut: 'I',
        action: () => this.actions.onToggleMetadata?.(),
      },
      { type: 'divider' },
      {
        id: 'delete-file',
        label: 'Move to Recycle Bin',
        icon: 'ri-delete-bin-line',
        shortcut: 'Del',
        danger: true,
        disabled: !this.hasImage(),
        action: () => this.actions.onDeleteFile?.(),
      },
    ];

    if (this.isDev) {
      items.push(
        { type: 'divider' },
        {
          id: 'inspect-dev',
          label: 'Inspect (Dev Mode)',
          icon: 'ri-code-s-slash-line',
          action: () => {
            console.log('[DevMode] Press F12 or Ctrl+Shift+I to open DevTools');
            toast.show('DevTools shortcut: Ctrl+Shift+I / F12');
          },
        }
      );
    }

    this.menuEl.innerHTML = items
      .map((item) => {
        if (item.type === 'divider') return '<div class="context-menu-divider"></div>';
        const disabledClass = item.disabled ? 'disabled' : '';
        const dangerClass = item.danger ? 'danger' : '';
        const shortcutHtml = item.shortcut ? `<span class="context-menu-shortcut">${item.shortcut}</span>` : '';
        return `
          <div class="context-menu-item ${disabledClass} ${dangerClass}" data-action="${item.id}">
            <i class="${item.icon} context-menu-icon"></i>
            <span class="context-menu-label">${item.label}</span>
            ${shortcutHtml}
          </div>
        `;
      })
      .join('');

    this.menuEl.querySelectorAll('.context-menu-item:not(.disabled)').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const actionId = el.getAttribute('data-action');
        const found = items.find((it) => it.id === actionId);
        this.close();
        found?.action?.();
      });
    });
  }
}
