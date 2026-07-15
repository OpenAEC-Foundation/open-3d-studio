// Genereert het app-icoon (512x512 PNG): amber ruit met donkere ring,
// naar het voorbeeld van het OpenAEC-merkteken. Pure Node, geen dependencies.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const S = 512;
const px = Buffer.alloc(S * S * 4);
const c = (S - 1) / 2;

for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const d = Math.abs(x - c) + Math.abs(y - c);
    const i = (y * S + x) * 4;
    if (d < S * 0.46) {
      if (d < S * 0.3 && d > S * 0.2) {
        px[i] = 33; px[i + 1] = 29; px[i + 2] = 26; px[i + 3] = 255; // donkere ring
      } else {
        px[i] = 217; px[i + 1] = 119; px[i + 2] = 6; px[i + 3] = 255; // construction amber
      }
    }
  }
}

// PNG samenstellen (filter 0 per scanline)
const raw = Buffer.alloc((S * 4 + 1) * S);
for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0;
  px.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4);
}

const crcTable = [];
for (let n = 0; n < 256; n++) {
  let v = n;
  for (let k = 0; k < 8; k++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
  crcTable[n] = v >>> 0;
}
const crc32 = (buf) => {
  let crc = 0xffffffff;
  for (const b of buf) crc = (crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0);
ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8; // bitdiepte
ihdr[9] = 6; // RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "app-icon.png");
writeFileSync(out, png);
console.log(`icoon geschreven: ${out} (${png.length} bytes)`);
