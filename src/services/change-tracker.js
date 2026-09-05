/**
 * Bukaake Change Tracker Service
 * Tracks unsaved user modifications: Crop, Color Adjustments, and Drawing.
 * Explicitly ignores rotation and flipping per Pillar guidelines (< 90 lines).
 */

export class ChangeTracker {
  constructor() {
    this.cropModified = false;
    this.colorModified = false;
    this.drawModified = false;
    this.listeners = [];
  }

  onChange(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
    }
  }

  notify() {
    const dirty = this.hasUnsavedChanges();
    for (const cb of this.listeners) {
      try { cb(dirty); } catch (e) { console.error(e); }
    }
  }

  markCrop(isDirty = true) {
    this.cropModified = isDirty;
    this.notify();
  }

  markColor(isDirty = true) {
    this.colorModified = isDirty;
    this.notify();
  }

  markDraw(isDirty = true) {
    this.drawModified = isDirty;
    this.notify();
  }

  hasUnsavedChanges() {
    return this.cropModified || this.colorModified || this.drawModified;
  }

  markSaved() {
    this.cropModified = false;
    this.colorModified = false;
    this.drawModified = false;
    this.notify();
  }

  reset() {
    this.markSaved();
  }
}

export const changeTracker = new ChangeTracker();
