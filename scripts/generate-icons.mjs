import { mkdir, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

// Code-native artwork: white brackets and a prompt line on a rounded green tile.
// PNG generation uses only Node's standard library, with 4x supersampling.
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const label = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([label, data])));
  return Buffer.concat([length, label, data, checksum]);
}

function pixel(x, y) {
  const radius = 23;
  const dx = Math.max(radius - x, 0, x - (128 - radius));
  const dy = Math.max(radius - y, 0, y - (128 - radius));
  if (dx * dx + dy * dy > radius * radius) return [0, 0, 0, 0];
  const box = (left, top, width, height) =>
    x >= left && x < left + width && y >= top && y < top + height;
  const white =
    box(28, 32, 9, 64) ||
    box(28, 32, 20, 9) ||
    box(28, 87, 20, 9) ||
    box(91, 32, 9, 64) ||
    box(80, 32, 20, 9) ||
    box(80, 87, 20, 9) ||
    box(51, 59, 26, 9);
  return white ? [247, 251, 242, 255] : [38, 102, 78, 255];
}

await mkdir(new URL('../public/icons/', import.meta.url), { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const rows = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const channels = [0, 0, 0, 0];
      for (let sy = 0; sy < 4; sy++)
        for (let sx = 0; sx < 4; sx++) {
          const sample = pixel(
            ((x + (sx + 0.5) / 4) * 128) / size,
            ((y + (sy + 0.5) / 4) * 128) / size,
          );
          sample.forEach((value, index) => {
            channels[index] += value / 16;
          });
        }
      channels.forEach((value, index) => {
        rows[y * (1 + size * 4) + 1 + x * 4 + index] = Math.round(value);
      });
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  await writeFile(
    new URL(`../public/icons/icon-${size}.png`, import.meta.url),
    png,
  );
}
console.log('Generated extension icons at 16, 32, 48, and 128 pixels.');
