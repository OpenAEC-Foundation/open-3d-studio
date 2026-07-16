import type { ComponentTemplate, ParamValues, PlacedElement, Storey } from "./types";
import { getTemplate, registerRuntimeTemplate, unregisterRuntimeTemplate, allTemplates } from "../catalog/registry";

/** Plugin-API voor TS/JS-scripting (v0.6-6).
 *
 *  Bestandsformaat: `.o3sp` (plain-text JS). De file registreert zich via
 *  `plugin(register)` en wordt in een strict-mode Function-context uitgevoerd.
 *
 *  ⚠ VEILIGHEID — dit is GÉÉN sandbox. `new Function` schaduwt alleen de drie
 *  doorgegeven identifiers; window, document, fetch, localStorage en alle
 *  andere globals blijven volledig bereikbaar, en er is geen timeout op
 *  lang-lopende code. Een plugin kan dus alles wat de app zelf kan, inclusief
 *  netwerk-verkeer en toegang tot opgeslagen instellingen. Laad daarom
 *  uitsluitend plugins uit vertrouwde bron — de UI waarschuwt hiervoor.
 *  Een echte isolatie-laag (Web Worker + MessageChannel, met time-out) staat
 *  gepland voor v0.7.
 *
 *  Wat de nette API biedt (conventie, geen afdwinging):
 *    - templates lezen en registreren
 *    - elementen/verdiepingen lezen
 *    - via api.placeElement() een element plaatsen
 *
 *  Voorbeeld-plugin (`.o3sp`):
 *    plugin((api) => {
 *      api.log("Hoi vanuit mijn plugin");
 *      api.registerTemplate({ ...someO3st });
 *    });  */

export interface PluginRegistration {
  id: string;
  name: string;
  version?: string;
  onRun?: (api: PluginRuntime) => void | Promise<void>;
}

/** De runtime die aan een plugin wordt doorgegeven. */
export interface PluginRuntime {
  log(msg: string): void;
  listTemplates(): { id: string; name: string; category: string }[];
  getTemplate(id: string): ComponentTemplate | null;
  /** Registreer een template (bouwt runtime-catalogus uit). */
  registerTemplate(template: ComponentTemplate): void;
  /** Verwijder een eerder geregistreerd runtime-template. */
  unregisterTemplate(id: string): boolean;
  /** Levert alle geplaatste elementen als read-only kopie. */
  getElements(): ReadonlyArray<PlacedElement>;
  /** Levert de verdiepingen. */
  getStoreys(): ReadonlyArray<Storey>;
  /** Plaats een element via de host-Studio (async). Retourneert het element-id. */
  placeElement(spec: PlacementRequest): Promise<string>;
}

export interface PlacementRequest {
  templateId: string;
  start: [number, number]; // bouwkundige coordinaten (x, y), meters
  end: [number, number];
  params?: ParamValues;
}

/** De host-interface die de Studio moet leveren aan de plugin-loader. */
export interface PluginHost {
  getElements(): ReadonlyArray<PlacedElement>;
  getStoreys(): ReadonlyArray<Storey>;
  applyPlacements(placements: PlacementRequest[]): Promise<string[]>;
  onLog?(msg: string): void;
}

/** Laadt een plugin-bestand en voert het uit. Retourneert wat er ná registratie
 *  aan runtime-templates is toegevoegd (voor UI-update). */
export async function loadPlugin(
  source: string,
  host: PluginHost,
): Promise<{ ok: boolean; message: string; addedTemplates: string[] }> {
  const before = new Set(allTemplates().map((t) => t.id));
  const logs: string[] = [];
  const runtime: PluginRuntime = {
    log(msg) {
      logs.push(String(msg));
      host.onLog?.(String(msg));
    },
    listTemplates() {
      return allTemplates().map((t) => ({ id: t.id, name: t.name, category: t.category }));
    },
    getTemplate(id) {
      try { return getTemplate(id); } catch { return null; }
    },
    registerTemplate(template) {
      registerRuntimeTemplate(template);
    },
    unregisterTemplate(id) {
      return unregisterRuntimeTemplate(id);
    },
    getElements: () => host.getElements(),
    getStoreys: () => host.getStoreys(),
    async placeElement(spec) {
      const ids = await host.applyPlacements([spec]);
      return ids[0] ?? "";
    },
  };

  try {
    // Strict-mode Function-context. LET OP: dit isoleert NIETS — zie de
    // veiligheidswaarschuwing bovenaan dit bestand. Worker-sandbox volgt in v0.7.
    const factory = new Function(
      "plugin", "api", "console",
      `"use strict";\n${source};`,
    );
    let ran = false;
    const collector: PluginRegistration[] = [];
    const registerFn = (reg: PluginRegistration | ((api: PluginRuntime) => void)) => {
      if (typeof reg === "function") {
        collector.push({ id: "anon", name: "Anonymous", onRun: reg });
      } else {
        collector.push(reg);
      }
      ran = true;
    };
    factory(registerFn, runtime, {
      log: (...args: unknown[]) => runtime.log(args.map(String).join(" ")),
      warn: (...args: unknown[]) => runtime.log("[warn] " + args.map(String).join(" ")),
      error: (...args: unknown[]) => runtime.log("[error] " + args.map(String).join(" ")),
    });

    if (!ran) {
      return { ok: false, message: "Plugin heeft geen registratie gedaan. Roep plugin(...) aan.", addedTemplates: [] };
    }
    for (const reg of collector) {
      if (reg.onRun) await reg.onRun(runtime);
    }
    const after = allTemplates().map((t) => t.id);
    const addedTemplates = after.filter((id) => !before.has(id));
    return {
      ok: true,
      message: `Plugin geladen (${collector.length} registratie(s), ${addedTemplates.length} template(s) toegevoegd).${logs.length ? `\nLog:\n${logs.join("\n")}` : ""}`,
      addedTemplates,
    };
  } catch (err) {
    return {
      ok: false,
      message: `Plugin-fout: ${err instanceof Error ? err.message : String(err)}`,
      addedTemplates: [],
    };
  }
}

/** Voorbeeld-plugin die kan als demo. */
export const EXAMPLE_PLUGIN_JS = `// Voorbeeld: registreer een simpel houten-schotje template
plugin((api) => {
  api.log("Voorbeeld-plugin start; " + api.listTemplates().length + " templates aanwezig.");
  api.registerTemplate({
    id: "plugin-demo-schotje",
    name: "Plugin-demo · houten schotje",
    category: "Overig",
    ifcEntity: "IfcBuildingElementProxy",
    ifcPredefinedType: "USERDEFINED",
    ifcObjectType: "PluginDemo",
    placementKind: "linear",
    params: [
      { key: "hoogte", label: "Hoogte", type: "length", min: 200, max: 2000, step: 10 },
      { key: "basisHoogte", label: "Peil", type: "length", min: 0, max: 5000, step: 10 },
    ],
    defaults: { hoogte: 800, basisHoogte: 0 },
    solids: (length, p) => {
      const h = (typeof p.hoogte === "number" ? p.hoogte : 800) / 1000;
      return [{ cx: length / 2, cy: 0, zBottom: 0, dx: length, dy: 0.02, dz: h }];
    },
    depth: () => 0.02,
    color: () => "#b45309",
    psetName: "Plugin_Demo",
    psetProps: (length, p) => ({ Type: "Plugin-demo", Lengte_mm: Math.round(length * 1000), Hoogte_mm: p.hoogte }),
  });
  api.log("Klaar. Selecteer 'Plugin-demo · houten schotje' in de dropdown.");
});
`;
