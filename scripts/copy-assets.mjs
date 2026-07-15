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

for (const [from, to] of copies) {
  const src = join(root, from);
  if (existsSync(src)) {
    cpSync(src, join(root, to));
    console.log(`copied ${from} -> ${to}`);
  } else {
    console.warn(`NOT FOUND (skipped): ${from}`);
  }
}
