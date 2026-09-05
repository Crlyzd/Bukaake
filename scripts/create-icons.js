import fs from 'fs';
import path from 'path';

const iconsDir = path.join(process.cwd(), 'src-tauri', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 32x32 PNG (cyan/indigo glass icon)
const base64Png32 = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEwAACxMBAJqcGAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAEGSURBVGJjYBgFo2AUjIJRMApIBf8fP378nwqGUTB4AOPfv3//p6a9UTB4AOP///8NGBgY/tPTPgoGAfAYwPjx4wcDAwMDww8GBoY/9LSPgoEEGAZg8P/x48f//w0MDCwMDAwM/xkYGBj+09M+CgYR8B/A+P///38DAwMTAwMDw/8/DAwM//7T0z4KBhpwGMAExsbGBgwMDAz/GBgYGP7R0z4KBg1wGMAEZmNjw8DAwMDwn4GBgeEfPe2jYCAAPgMY/zMwMDT8Z2BgYPhDT/soGERARAAAYQ32/x9s31QAAAABJRU5ErkJggg==';

// Simple valid ICO header + PNG payload
const pngBuffer = Buffer.from(base64Png32, 'base64');

// Create 6-byte ICO header + 16-byte Directory Entry + PNG data
const icoHeader = Buffer.from([
  0x00, 0x00, // Reserved
  0x01, 0x00, // Type 1 = ICO
  0x01, 0x00, // 1 Image
  32,         // Width 32
  32,         // Height 32
  0,          // Colors
  0,          // Reserved
  1, 0,       // Color planes
  32, 0,      // Bits per pixel
  ...intTo4Bytes(pngBuffer.length),
  ...intTo4Bytes(22) // Offset to image data (6+16=22)
]);

function intTo4Bytes(num) {
  return [num & 0xff, (num >> 8) & 0xff, (num >> 16) & 0xff, (num >> 24) & 0xff];
}

const icoBuffer = Buffer.concat([icoHeader, pngBuffer]);

fs.writeFileSync(path.join(iconsDir, '32x32.png'), pngBuffer);
fs.writeFileSync(path.join(iconsDir, '128x128.png'), pngBuffer);
fs.writeFileSync(path.join(iconsDir, '128x128@2x.png'), pngBuffer);
fs.writeFileSync(path.join(iconsDir, 'icon.icns'), pngBuffer);
fs.writeFileSync(path.join(iconsDir, 'icon.ico'), icoBuffer);

console.log('Successfully generated icons in src-tauri/icons/');
