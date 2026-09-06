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

    const rawFileName = meta?.name || meta?.fileObj?.name || 'Image';
    const fileName = this.escapeHtml(rawFileName);
    const filePath = meta?.path || null;
    const folderPath = filePath ? this.getFolderFromPath(filePath) : null;

    const sizeBytes = meta?.sizeBytes || meta?.fileObj?.size || 0;
    const fileSize = sizeBytes > 0 
      ? `${this.formatBytes(sizeBytes)} (${sizeBytes.toLocaleString()} bytes)` 
      : 'In Memory (Unsaved)';

    const rawMime = meta?.mimeType || meta?.fileObj?.type || this.getMimeFromExtension(rawFileName);
    const mimeType = this.escapeHtml(rawMime);

    let lastModifiedStr = 'In Memory';
    if (meta?.lastModified) {
      lastModifiedStr = new Date(meta.lastModified).toLocaleString();
    } else if (meta?.fileObj?.lastModified) {
      lastModifiedStr = new Date(meta.fileObj.lastModified).toLocaleString();
    }

    const orientation = width === height ? 'Square' : (width > height ? 'Landscape' : 'Portrait');

    const folderRow = folderPath ? `
      <tr>
        <td class="meta-key">Folder</td>
        <td class="meta-val" title="${this.escapeHtml(filePath)}">${this.escapeHtml(folderPath)}</td>
      </tr>
    ` : '';

    const exifSection = this.buildExifSection(meta?.exif);

    this.container.innerHTML = `
      <table class="meta-table">
        <tbody>
          <tr><td class="meta-key">File Name</td><td class="meta-val" title="${fileName}">${fileName}</td></tr>
          ${folderRow}
          <tr><td class="meta-key">File Size</td><td class="meta-val">${fileSize}</td></tr>
          <tr><td class="meta-key">Format / MIME</td><td class="meta-val">${mimeType}</td></tr>
          <tr><td class="meta-key">Dimensions</td><td class="meta-val">${width} × ${height} px</td></tr>
          <tr><td class="meta-key">Resolution</td><td class="meta-val">${megapixels} MP</td></tr>
          <tr><td class="meta-key">Aspect Ratio</td><td class="meta-val">${aspect}</td></tr>
          <tr><td class="meta-key">Orientation</td><td class="meta-val">${orientation}</td></tr>
          <tr><td class="meta-key">Modified</td><td class="meta-val">${lastModifiedStr}</td></tr>
        </tbody>
      </table>

      ${exifSection}

      <div class="meta-section-divider">
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

  buildExifSection(exif) {
    if (!exif) return '';

    const rows = [];

    // Camera Make & Model
    if (exif.model) {
      const cam = exif.make && !exif.model.toLowerCase().includes(exif.make.toLowerCase())
        ? `${exif.make} ${exif.model}`
        : exif.model;
      rows.push(`<tr><td class="meta-key">Camera</td><td class="meta-val">${this.escapeHtml(cam)}</td></tr>`);
    } else if (exif.make) {
      rows.push(`<tr><td class="meta-key">Camera</td><td class="meta-val">${this.escapeHtml(exif.make)}</td></tr>`);
    }

    if (exif.lens) {
      rows.push(`<tr><td class="meta-key">Lens</td><td class="meta-val">${this.escapeHtml(exif.lens)}</td></tr>`);
    }

    if (exif.f_number) {
      rows.push(`<tr><td class="meta-key">Aperture</td><td class="meta-val">${this.escapeHtml(exif.f_number)}</td></tr>`);
    }

    if (exif.exposure_time) {
      rows.push(`<tr><td class="meta-key">Shutter Speed</td><td class="meta-val">${this.escapeHtml(exif.exposure_time)}</td></tr>`);
    }

    if (exif.iso) {
      rows.push(`<tr><td class="meta-key">ISO</td><td class="meta-val">ISO ${this.escapeHtml(exif.iso)}</td></tr>`);
    }

    if (exif.focal_length) {
      const flText = exif.focal_length_35mm
        ? `${exif.focal_length} (${exif.focal_length_35mm} eq)`
        : exif.focal_length;
      rows.push(`<tr><td class="meta-key">Focal Length</td><td class="meta-val">${this.escapeHtml(flText)}</td></tr>`);
    }

    if (exif.exposure_bias) {
      rows.push(`<tr><td class="meta-key">Exposure Bias</td><td class="meta-val">${this.escapeHtml(exif.exposure_bias)}</td></tr>`);
    }

    if (exif.metering_mode) {
      rows.push(`<tr><td class="meta-key">Metering</td><td class="meta-val">${this.escapeHtml(exif.metering_mode)}</td></tr>`);
    }

    if (exif.flash) {
      rows.push(`<tr><td class="meta-key">Flash</td><td class="meta-val">${this.escapeHtml(exif.flash)}</td></tr>`);
    }

    if (exif.date_time_original) {
      rows.push(`<tr><td class="meta-key">Date Taken</td><td class="meta-val">${this.escapeHtml(exif.date_time_original)}</td></tr>`);
    }

    if (exif.gps_latitude !== undefined && exif.gps_latitude !== null && exif.gps_longitude !== undefined && exif.gps_longitude !== null) {
      const latStr = `${Math.abs(exif.gps_latitude).toFixed(4)}° ${exif.gps_latitude >= 0 ? 'N' : 'S'}`;
      const lonStr = `${Math.abs(exif.gps_longitude).toFixed(4)}° ${exif.gps_longitude >= 0 ? 'E' : 'W'}`;
      const fullGps = `${latStr}, ${lonStr}${exif.gps_altitude ? ` (${Math.round(exif.gps_altitude)}m)` : ''}`;
      rows.push(`<tr><td class="meta-key">GPS Location</td><td class="meta-val" title="${this.escapeHtml(fullGps)}">${this.escapeHtml(fullGps)}</td></tr>`);
    }

    if (rows.length === 0) return '';

    return `
      <div class="meta-section-divider">
        <span class="filter-section-title">Camera & Shooting Info</span>
        <table class="meta-table" style="margin-top: 6px;">
          <tbody>
            ${rows.join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  getFolderFromPath(filePath) {
    if (!filePath) return '';
    const lastSep = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'));
    return lastSep > 0 ? filePath.substring(0, lastSep) : filePath;
  }

  getMimeFromExtension(name) {
    if (!name) return 'image/png';
    const ext = name.split('.').pop()?.toLowerCase();
    const map = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      gif: 'image/gif',
      bmp: 'image/bmp',
      ico: 'image/x-icon',
      svg: 'image/svg+xml',
      avif: 'image/avif',
      tiff: 'image/tiff',
      tif: 'image/tiff',
      arw: 'image/x-sony-arw',
      srf: 'image/x-sony-arw',
      sr2: 'image/x-sony-arw',
      cr2: 'image/x-canon-cr2',
      cr3: 'image/x-canon-cr3',
      nef: 'image/x-nikon-nef',
      nrw: 'image/x-nikon-nef',
      dng: 'image/x-adobe-dng',
      raf: 'image/x-fuji-raf',
      rw2: 'image/x-panasonic-rw2',
      orf: 'image/x-olympus-orf',
      pef: 'image/x-pentax-pef',
      hdr: 'image/vnd.radiance',
      exr: 'image/x-exr',
      tga: 'image/x-tga',
      dds: 'image/vnd.ms-dds',
      qoi: 'image/qoi',
      ppm: 'image/x-portable-pixmap',
      pgm: 'image/x-portable-graymap',
      pbm: 'image/x-portable-bitmap',
      pnm: 'image/x-portable-anymap',
      psd: 'image/vnd.adobe.photoshop',
    };
    return map[ext] || 'image/png';
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
