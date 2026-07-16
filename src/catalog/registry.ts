import type { ComponentTemplate } from "../core/types";
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

export function getTemplate(id: string): ComponentTemplate {
  const t = templates.find((tt) => tt.id === id);
  if (!t) throw new Error(`Onbekend componenttemplate: ${id}`);
  return t;
}

/** Templates gegroepeerd op hun NL-SfB-hoofdcategorie (eerste twee cijfers).
 *  Handig voor het lagenpaneel: `21`, `22`, `23`, … als sectiekop. */
export function templatesByNlSfb(): Record<string, ComponentTemplate[]> {
  const groups: Record<string, ComponentTemplate[]> = {};
  for (const t of templates) {
    const code = t.nlSfb?.match(/^\d{2}/)?.[0] ?? "??";
    (groups[code] ??= []).push(t);
  }
  return groups;
}

/** Templates gegroepeerd op fabrikant — voor de "manufacturer" tab in v1.0. */
export function templatesByManufacturer(): Record<string, ComponentTemplate[]> {
  const groups: Record<string, ComponentTemplate[]> = {};
  for (const t of templates) {
    const m = t.manufacturer ?? "Generiek";
    (groups[m] ??= []).push(t);
  }
  return groups;
}
