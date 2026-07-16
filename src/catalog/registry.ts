import type { ComponentTemplate } from "../core/types";
import { o3stToTemplate, type O3stFile } from "../core/o3stTemplate";
import { storaxLamelWand } from "./storaxLamelWand";
import { storaxRooster } from "./storaxRooster";
import { storaxDrager } from "./storaxDrager";

/** Componentcatalogus met twee bronnen:
 *
 *  1. Expliciete imports (bestaande Storax-templates uit v0.3).
 *  2. Glob-autoload van elk `*.tpl.ts`-bestand ergens onder `src/catalog/`.
 *     Nieuwe templates (v0.4-S2 en verder) belanden in NL-SfB-directories
 *     zoals `src/catalog/23_vloer/vbi_kanaalplaat.tpl.ts` en worden vanzelf
 *     opgepikt — geen aanpassing van deze file nodig.
 *
 *  Een `.tpl.ts`-file mag zijn template exporteren als default of als named export;
 *  alles dat er als ComponentTemplate uitziet (id + name + solids-functie) wordt
 *  meegenomen. Duplicaten (zelfde `id`) worden gededuplicieerd — expliciete
 *  imports winnen van autoload. */

const autoloadModules = import.meta.glob<Record<string, unknown>>("./**/*.tpl.ts", {
  eager: true,
});

function isTemplate(x: unknown): x is ComponentTemplate {
  if (!x || typeof x !== "object") return false;
  const t = x as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    typeof t.name === "string" &&
    typeof t.category === "string" &&
    typeof t.solids === "function" &&
    typeof t.depth === "function"
  );
}

function collectAutoloaded(): ComponentTemplate[] {
  const found: ComponentTemplate[] = [];
  for (const mod of Object.values(autoloadModules)) {
    for (const exp of Object.values(mod)) {
      if (isTemplate(exp)) found.push(exp);
    }
  }
  return found;
}

const explicit: ComponentTemplate[] = [storaxLamelWand, storaxRooster, storaxDrager];
const autoloaded = collectAutoloaded();

// Dedupliceren op id, expliciete imports hebben voorrang.
const seen = new Set<string>();
export const templates: ComponentTemplate[] = [];
for (const t of [...explicit, ...autoloaded]) {
  if (seen.has(t.id)) {
    console.warn(`Template-id "${t.id}" komt meer dan eens voor — eerste registratie wint.`);
    continue;
  }
  seen.add(t.id);
  templates.push(t);
}

/** Extra templates die na build-tijd worden ingeladen (`.o3st` community-files,
 *  plugin-registrations). Nieuwe registraties overrulen bestaande id's. */
const runtime: ComponentTemplate[] = [];

/** Registreer een template dat na app-start is toegevoegd. Roept event-listeners aan. */
export function registerRuntimeTemplate(t: ComponentTemplate): void {
  const existing = runtime.findIndex((r) => r.id === t.id);
  if (existing >= 0) runtime.splice(existing, 1);
  runtime.push(t);
  for (const cb of runtimeListeners) cb();
}

/** Verwijder een runtime-template. Bouw-in-tijd templates worden niet geraakt. */
export function unregisterRuntimeTemplate(id: string): boolean {
  const i = runtime.findIndex((r) => r.id === id);
  if (i < 0) return false;
  runtime.splice(i, 1);
  for (const cb of runtimeListeners) cb();
  return true;
}

/** Laadt een .o3st-bestand als runtime-template. */
export function loadO3stTemplate(file: O3stFile): ComponentTemplate {
  const t = o3stToTemplate(file);
  registerRuntimeTemplate(t);
  return t;
}

const runtimeListeners = new Set<() => void>();
/** Abonneer op wijzigingen aan de runtime-lijst; retourneert de unsubscribe. */
export function subscribeRuntimeTemplates(cb: () => void): () => void {
  runtimeListeners.add(cb);
  return () => runtimeListeners.delete(cb);
}

/** Alle bekende templates, bouw-in-tijd + runtime samengevoegd (runtime wint bij dupe). */
export function allTemplates(): ComponentTemplate[] {
  const merged = new Map<string, ComponentTemplate>();
  for (const t of templates) merged.set(t.id, t);
  for (const t of runtime) merged.set(t.id, t);
  return [...merged.values()];
}

export function getTemplate(id: string): ComponentTemplate {
  const rt = runtime.find((tt) => tt.id === id);
  if (rt) return rt;
  const t = templates.find((tt) => tt.id === id);
  if (!t) throw new Error(`Onbekend componenttemplate: ${id}`);
  return t;
}

/** Templates gegroepeerd op hun NL-SfB-hoofdcategorie (eerste twee cijfers).
 *  Handig voor het lagenpaneel: `21`, `22`, `23`, … als sectiekop.
 *  Omvat óók runtime-templates (.o3st/plugin/IFC-family). */
export function templatesByNlSfb(): Record<string, ComponentTemplate[]> {
  const groups: Record<string, ComponentTemplate[]> = {};
  for (const t of allTemplates()) {
    const code = t.nlSfb?.match(/^\d{2}/)?.[0] ?? "??";
    (groups[code] ??= []).push(t);
  }
  return groups;
}

/** Templates gegroepeerd op fabrikant — voor de "manufacturer" tab in v1.0.
 *  Omvat óók runtime-templates (.o3st/plugin/IFC-family). */
export function templatesByManufacturer(): Record<string, ComponentTemplate[]> {
  const groups: Record<string, ComponentTemplate[]> = {};
  for (const t of allTemplates()) {
    const m = t.manufacturer ?? "Generiek";
    (groups[m] ??= []).push(t);
  }
  return groups;
}
