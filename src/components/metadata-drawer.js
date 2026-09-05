/**
 * Bukaake Metadata Drawer Component
 * Manages the slide-out glass drawer displaying EXIF and image details
 */

export class MetadataDrawer {
  constructor(options = {}) {
    this.container = document.getElementById('metadataDrawer');
    this.bodyEl = document.getElementById('metadataBody');
    this.metadataInspector = options.metadataInspector;
    this.onClose = options.onClose || null;

    this.init();
  }

  init() {
    document.getElementById('btnCloseMetadata')?.addEventListener('click', () => {
      this.hide();
      this.onClose?.();
    });
  }

  update(meta, img) {
    if (this.metadataInspector) {
      this.metadataInspector.update(meta?.fileObj || null, img);
    }
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
