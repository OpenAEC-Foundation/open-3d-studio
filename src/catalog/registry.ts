import type { ComponentTemplate } from "../core/types";
import { storaxLamelWand } from "./storaxLamelWand";
import { storaxRooster } from "./storaxRooster";
import { storaxDrager } from "./storaxDrager";

/** Componentcatalogus. Nieuw component toevoegen = nieuw bestand in src/catalog/
 *  dat een ComponentTemplate exporteert, en hier registreren. */
export const templates: ComponentTemplate[] = [storaxLamelWand, storaxRooster, storaxDrager];

export function getTemplate(id: string): ComponentTemplate {
  const t = templates.find((t) => t.id === id);
  if (!t) throw new Error(`Onbekend componenttemplate: ${id}`);
  return t;
}
