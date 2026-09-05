import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createValidPNG(width, height) {
  const rawPixels = Buffer.alloc(height * (1 + width * 4));
  let pos = 0;

  for (let y = 0; y < height; y++) {
    rawPixels[pos++] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      rawPixels[pos++] = Math.round((x / width) * 127);
      rawPixels[pos++] = 242;
      rawPixels[pos++] = 254;
      rawPixels[pos++] = 255;
    }
  }

  const compressedData = zlib.deflateSync(rawPixels);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth 8
  ihdr[9] = 6; // Color type 6 (RGBA)
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([pngHeader, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ -1) >>> 0;
}

const iconsDir = path.join(process.cwd(), 'src-tauri', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const png32 = createValidPNG(32, 32);
const png128 = createValidPNG(128, 128);
const png256 = createValidPNG(256, 256);

// Build valid ICO file with 32x32 PNG payload
const icoHeader = Buffer.alloc(22);
icoHeader.writeUInt16LE(0, 0); // Reserved
icoHeader.writeUInt16LE(1, 2); // Type 1 = ICO
icoHeader.writeUInt16LE(1, 4); // 1 Image
icoHeader[6] = 32;            // Width
icoHeader[7] = 32;            // Height
icoHeader[8] = 0;             // Palette
icoHeader[9] = 0;             // Reserved
icoHeader.writeUInt16LE(1, 10); // Color planes
icoHeader.writeUInt16LE(32, 12); // Bits per pixel
icoHeader.writeUInt32LE(png32.length, 14); // Size of image data
icoHeader.writeUInt32LE(22, 18); // Offset to image data

const icoBuffer = Buffer.concat([icoHeader, png32]);

fs.writeFileSync(path.join(iconsDir, '32x32.png'), png32);
fs.writeFileSync(path.join(iconsDir, '128x128.png'), png128);
fs.writeFileSync(path.join(iconsDir, '128x128@2x.png'), png256);
fs.writeFileSync(path.join(iconsDir, 'icon.png'), png256);
fs.writeFileSync(path.join(iconsDir, 'icon.icns'), png256);
fs.writeFileSync(path.join(iconsDir, 'icon.ico'), icoBuffer);

console.log('Successfully generated 100% valid PNG and ICO files!');
