import { defineConfig } from "vite";

/** Bouwt tests/headless/export-scene.ts als Node-bundel (SSR-target).
 *
 *  Waarom een aparte Vite-build en geen kale tsx/ts-node: de catalogus laadt
 *  zijn templates via `import.meta.glob` (src/catalog/registry.ts), en deze
 *  poort moet exact dezelfde catalogus zien als de app — niets nagebouwd.
 *
 *  Afhankelijkheden blijven extern (Vite-SSR-standaard): Node lost `web-ifc`
 *  via de "node"-exportconditie op naar web-ifc-api-node.js, die zijn wasm
 *  naast zichzelf vindt. Daarom slaat getIfcApi() zijn SetWasmPath("/wasm/")
 *  onder Node over — zie src/core/ifcCommon.ts. */
export default defineConfig({
  build: {
    ssr: "tests/headless/export-scene.ts",
    outDir: "tests/headless/dist",
    emptyOutDir: true,
    target: "node20",
    // Geen minify: de bundel is een testartefact en moet leesbaar blijven.
    minify: false,
  },
  logLevel: "warn",
});
