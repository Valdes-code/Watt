// Generátor PWA ikon: žltý blesk na tmavom pozadí (značka CycloWatt).
// Spustenie: node scripts/gen-icons.mjs  → zapíše PNG do public/.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const BG = [10, 15, 28];      // #0a0f1c
const BOLT = [255, 213, 74];  // #ffd54a

// Blesk v normalizovaných súradniciach (0..1, y smerom dole).
const POLY = [
  [0.58, 0.07], [0.30, 0.55], [0.47, 0.55], [0.40, 0.93],
  [0.74, 0.40], [0.55, 0.40], [0.66, 0.07],
];

function inPoly(x, y) {
  let inside = false;
  for (let i = 0, j = POLY.length - 1; i < POLY.length; j = i++) {
    const [xi, yi] = POLY[i], [xj, yj] = POLY[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// CRC32 pre PNG chunky.
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function renderPng(size) {
  const raw = Buffer.alloc(size * (size * 4 + 1)); // +1 filter byte / riadok
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const nx = (x + 0.5) / size, ny = (y + 0.5) / size;
      const c = inPoly(nx, ny) ? BOLT : BG;
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

mkdirSync(new URL("../public/", import.meta.url), { recursive: true });
for (const [name, size] of [["apple-touch-icon", 180], ["icon-192", 192], ["icon-512", 512]]) {
  writeFileSync(new URL(`../public/${name}.png`, import.meta.url), renderPng(size));
  console.log(`✓ public/${name}.png (${size}×${size})`);
}
