import * as WebIFC from "web-ifc";

/** Gedeelde IFC-hulpmiddelen (inhaalslag na v0.6-review).
 *
 *  1. `getIfcApi()` — één wasm-initialisatie per sessie i.p.v. per operatie.
 *     Export, structural export, family-import en heropenen betaalden elk hun
 *     eigen fetch+compile+instantiate van de web-ifc-wasm (honderden ms per stuk).
 *     OpenModel/CreateModel + CloseModel isoleren de per-bestand-state al, dus
 *     één API-instantie is veilig te delen zolang elke gebruiker zijn model sluit.
 *
 *  2. `newIfcGuid()` — de IFC-GUID-encoder stond gedupliceerd in ifcExport en
 *     structuralExport; een fix in de één bereikte de ander niet. */

let apiPromise: Promise<WebIFC.IfcAPI> | null = null;

export function getIfcApi(): Promise<WebIFC.IfcAPI> {
  if (!apiPromise) {
    apiPromise = (async () => {
      const api = new WebIFC.IfcAPI();
      // In de browser serveert de app de wasm vanaf /wasm/ (scripts/copy-assets.mjs).
      // Onder Node (headless IFC-poort, tests/) resolven imports van "web-ifc" naar
      // web-ifc-api-node.js, die zijn wasm naast zichzelf vindt — dit absolute pad
      // zou hem daar juist breken.
      if (typeof window !== "undefined") {
        api.SetWasmPath("/wasm/", true);
      }
      await api.Init();
      return api;
    })();
    // bij een init-fout opnieuw kunnen proberen i.p.v. een kapotte promise cachen
    apiPromise.catch(() => {
      apiPromise = null;
    });
  }
  return apiPromise;
}

/** IFC-GUID: 128 bits gecodeerd als 22 tekens in het IFC-base64-alfabet. */
const GUID_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";

export function newIfcGuid(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let num = 0n;
  for (const b of bytes) num = (num << 8n) | BigInt(b);
  let out = GUID_CHARS[Number(num >> 126n)];
  for (let i = 20; i >= 0; i--) {
    out += GUID_CHARS[Number((num >> BigInt(i * 6)) & 63n)];
  }
  return out;
}
