// Kopieert runtime-assets uit node_modules naar public/ zodat de app
// volledig lokaal draait (geen unpkg nodig voor wasm en de fragments-worker).
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");
const wasmDir = join(publicDir, "wasm");
mkdirSync(wasmDir, { recursive: true });

const copies = [
  ["node_modules/web-ifc/web-ifc.wasm", "public/wasm/web-ifc.wasm"],
  ["node_modules/web-ifc/web-ifc-mt.wasm", "public/wasm/web-ifc-mt.wasm"],
  ["node_modules/web-ifc/web-ifc-mt.worker.js", "public/wasm/web-ifc-mt.worker.js"],
  ["node_modules/@thatopen/fragments/dist/Worker/worker.mjs", "public/fragments-worker.mjs"],
];

// web-ifc.wasm en de fragments-worker zijn onmisbaar: zonder deze bestanden
// start de app wel, maar kan hij geen enkel IFC laden of schrijven.
const verplicht = new Set([
  "node_modules/web-ifc/web-ifc.wasm",
  "node_modules/@thatopen/fragments/dist/Worker/worker.mjs",
]);

let fataal = false;
for (const [from, to] of copies) {
  const src = join(root, from);
  if (existsSync(src)) {
    cpSync(src, join(root, to));
    console.log(`copied ${from} -> ${to}`);
  } else if (verplicht.has(from)) {
    console.error(`FOUT: verplicht bestand ontbreekt: ${from} — draai eerst npm install`);
    fataal = true;
  } else {
    console.warn(`NOT FOUND (skipped): ${from}`);
  }
}
if (fataal) process.exit(1);
