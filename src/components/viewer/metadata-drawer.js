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
      this.metadataInspector.update(meta, img);
    }
  }

  toggle() {
    if (this.container) {
      const isHidden = this.container.classList.toggle('hidden');
      document.body.classList.toggle('metadata-drawer-open', !isHidden);
      return !isHidden;
    }
    return false;
  }

  show() {
    this.container?.classList.remove('hidden');
    document.body.classList.add('metadata-drawer-open');
  }

  hide() {
    this.container?.classList.add('hidden');
    document.body.classList.remove('metadata-drawer-open');
  }

  isOpen() {
    return this.container && !this.container.classList.contains('hidden');
  }
}
