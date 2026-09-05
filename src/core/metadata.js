/**
 * Bukaake Metadata Inspector
 * Extracts and formats image metadata details from web files or Tauri IPC payloads
 */

export class MetadataInspector {
  constructor(metadataBodyElement) {
    this.container = metadataBodyElement;
  }

  update(meta, imgElement) {
    if (!this.container) return;

    if (!imgElement) {
      this.container.innerHTML = '<p class="text-muted">No image loaded.</p>';
      return;
    }

    const width = imgElement.naturalWidth || imgElement.width || meta?.dimensions?.[0] || 0;
    const height = imgElement.naturalHeight || imgElement.height || meta?.dimensions?.[1] || 0;
    const megapixels = width > 0 && height > 0 ? ((width * height) / 1000000).toFixed(2) : '0';
    const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
    const divisor = width > 0 && height > 0 ? gcd(width, height) : 1;
    const aspect = width > 0 && height > 0 ? `${width / divisor}:${height / divisor}` : 'N/A';

    const fileName = meta?.name || (meta?.fileObj ? meta.fileObj.name : 'Image');
    const sizeBytes = meta?.sizeBytes || (meta?.fileObj ? meta.fileObj.size : 0);
    const fileSize = sizeBytes > 0 ? this.formatBytes(sizeBytes) : 'N/A (In Memory)';
    const mimeType = meta?.fileObj?.type || 'image/png';
    const lastModified = meta?.fileObj ? new Date(meta.fileObj.lastModified).toLocaleString() : new Date().toLocaleString();

    this.container.innerHTML = `
      <table class="meta-table">
        <tbody>
          <tr><td class="meta-key">File Name</td><td class="meta-val">${fileName}</td></tr>
          <tr><td class="meta-key">File Size</td><td class="meta-val">${fileSize}</td></tr>
          <tr><td class="meta-key">Format / MIME</td><td class="meta-val">${mimeType}</td></tr>
          <tr><td class="meta-key">Dimensions</td><td class="meta-val">${width} × ${height} px</td></tr>
          <tr><td class="meta-key">Resolution</td><td class="meta-val">${megapixels} MP</td></tr>
          <tr><td class="meta-key">Aspect Ratio</td><td class="meta-val">${aspect}</td></tr>
          <tr><td class="meta-key">Orientation</td><td class="meta-val">${width >= height ? 'Landscape' : 'Portrait'}</td></tr>
          <tr><td class="meta-key">Modified</td><td class="meta-val">${lastModified}</td></tr>
        </tbody>
      </table>

      <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.08);">
        <span class="filter-section-title">Color Profile</span>
        <table class="meta-table" style="margin-top: 6px;">
          <tbody>
            <tr><td class="meta-key">Color Space</td><td class="meta-val">sRGB / Canvas2D</td></tr>
            <tr><td class="meta-key">Color Depth</td><td class="meta-val">32-bit RGBA</td></tr>
            <tr><td class="meta-key">Alpha Channel</td><td class="meta-val">Supported</td></tr>
          </tbody>
        </table>
      </div>
    `;
  }

  formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}
