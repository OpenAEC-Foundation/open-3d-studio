import type { PlacedElement, Storey } from "../types";
import { getTemplate } from "../../catalog/registry";
import { commonPsetFor } from "../psetFactories";
import { thermalPsetProps } from "../thermal";
import type { Facet, IdsDocument, RangeMatch, Specification, ValueMatch } from "./types";
import type { IlsBevinding } from "../ilsCheck";

/** Draai een IDS-document over de plaatsingen. Levert een lijst bevindingen
 *  in hetzelfde formaat als het "oude" checkIls(), zodat het rapportage-UI
 *  ongewijzigd blijft. */
export function runIds(
  doc: IdsDocument,
  elements: PlacedElement[],
  storeys: Storey[],
): IlsBevinding[] {
  const out: IlsBevinding[] = [];
  const add = (eis: string, status: IlsBevinding["status"], toelichting: string) =>
    out.push({ eis, status, toelichting });

  // Verzamel per element de "denormalized view" die de facets gaan matchen.
  const views = elements.map((el) => elementView(el, storeys));

  for (const spec of doc.specifications) {
    const applicable = views.filter((v) => v && spec.applicability.every((f) => matchFacet(f, v!))) as ElementView[];
    if (spec.cardinality === "prohibited") {
      if (applicable.length === 0) {
        add(spec.name, "ok", spec.description ?? "Geen elementen voldoen aan het verboden filter — goed.");
      } else {
        add(spec.name, "fout", `${applicable.length} element(en) voldoen aan een verboden combinatie: ${applicable.map((v) => v.name).slice(0, 3).join(", ")}${applicable.length > 3 ? " …" : ""}`);
      }
      continue;
    }
    if (applicable.length === 0) {
      // niets van toepassing — geen fout, wel informatief
      add(spec.name, "ok", "Geen elementen vallen onder dit filter.");
      continue;
    }
    const fouten: string[] = [];
    const letOp: string[] = [];
    for (const view of applicable) {
      for (const req of spec.requirements) {
        const result = matchFacet(req, view, true);
        if (result === "miss") fouten.push(`${view.name}: ${describeFacet(req)}`);
        else if (result === "warn") letOp.push(`${view.name}: ${describeFacet(req)}`);
      }
    }
    if (fouten.length === 0 && letOp.length === 0) {
      add(spec.name, "ok", `${applicable.length} element(en) voldoen aan ${spec.requirements.length} eis(en).`);
    } else if (fouten.length === 0) {
      add(spec.name, "let-op", `Aandacht: ${letOp.slice(0, 3).join("; ")}${letOp.length > 3 ? ` … +${letOp.length - 3}` : ""}`);
    } else {
      add(spec.name, "fout", `${fouten.length} tekortkoming(en): ${fouten.slice(0, 3).join("; ")}${fouten.length > 3 ? ` … +${fouten.length - 3}` : ""}`);
    }
  }
  return out;
}

/** Verzamelde eigenschappen van één plaatsing, zoals ze aan de facets worden gemeten. */
interface ElementView {
  name: string;
  entity: string;
  predefinedType?: string;
  classifications: Map<string, string>; // system → code
  material?: string;
  materialLayers: { material: string; thicknessMm: number; lambda?: number }[];
  /** Alle psets (common + eigen), platgeslagen op "PsetName.PropertyName" → value. */
  psets: Map<string, Map<string, string | number | boolean>>;
  attributes: Map<string, string>;
  storeyName?: string;
}

function elementView(el: PlacedElement, storeys: Storey[]): ElementView | null {
  let template;
  try {
    template = getTemplate(el.templateId);
  } catch {
    return null;
  }
  const length = Math.hypot(el.end.x - el.start.x, el.end.z - el.start.z);
  const view: ElementView = {
    name: el.name,
    entity: template.ifcEntity,
    predefinedType: template.ifcPredefinedType,
    classifications: new Map(),
    material: template.material,
    materialLayers: (template.materialLayers ?? []).map((l) => ({
      material: l.material,
      thicknessMm: l.thicknessMm,
      lambda: (l as any).lambda,
    })),
    psets: new Map(),
    attributes: new Map(),
    storeyName: storeys.find((s) => s.id === el.storeyId)?.name,
  };
  if (template.nlSfb) view.classifications.set("NL-SfB", template.nlSfb);
  if (template.classification) {
    view.classifications.set(template.classification.system, template.classification.code);
  }
  // Eigen pset (Storax_…)
  const ownProps = template.psetProps(length, el.params) as Record<string, string | number | boolean>;
  view.psets.set(template.psetName, new Map(Object.entries(ownProps)));
  // Common-pset
  const common = commonPsetFor(template, length, el.params);
  view.psets.set(common.name, new Map(Object.entries(common.props)));
  // Storax_Thermal (Rc/U) — dezelfde bron als de IFC-export, zodat de IDS-check
  // op de runtime-view precies dezelfde waarden ziet als in de geëxporteerde IFC.
  const thermal = thermalPsetProps(template);
  if (thermal) view.psets.set("Storax_Thermal", new Map(Object.entries(thermal)));
  // Attributen — een handvol worden ondersteund
  view.attributes.set("Name", el.name);
  view.attributes.set("Tag", el.merk ?? "");
  if (template.ifcPredefinedType) view.attributes.set("PredefinedType", template.ifcPredefinedType);
  return view;
}

/** Match één facet tegen één element. Voor "applicability" returnt de functie een boolean;
 *  voor "requirements" onderscheidt een string-tri-state het uitkomst-detail:
 *  `ok`  — voldoet
 *  `warn`— voldoet maar met kanttekeningen (waarde ontbreekt, cardinality optional)
 *  `miss`— voldoet niet */
function matchFacet(facet: Facet, view: ElementView): boolean;
function matchFacet(facet: Facet, view: ElementView, forRequirement: true): "ok" | "warn" | "miss";
function matchFacet(facet: Facet, view: ElementView, forRequirement = false): any {
  const ret = (ok: boolean, warn = false) => (forRequirement ? (ok ? (warn ? "warn" : "ok") : "miss") : ok);
  switch (facet.kind) {
    case "entity": {
      // IDS 1.0 schrijft entity-namen in HOOFDLETTERS (IFCWALL) en de vergelijking
      // is per spec case-insensitief — anders matchen officiële IDS-bestanden
      // (BIM Loket IDS Configurator e.d.) nul elementen en kleurt alles vals groen.
      if (!matchValue(view.entity, facet.name, true)) return ret(false);
      if (facet.predefinedType && !matchValue(view.predefinedType ?? "", facet.predefinedType, true)) return ret(false);
      return ret(true);
    }
    case "classification": {
      let matchedSystem: string | null = null;
      for (const [sys, code] of view.classifications) {
        if (matchValue(sys, facet.system)) {
          if (!facet.value || matchValue(code, facet.value)) {
            matchedSystem = sys;
            break;
          }
        }
      }
      return ret(matchedSystem !== null);
    }
    case "material": {
      const candidates = [view.material, ...view.materialLayers.map((l) => l.material)].filter(Boolean) as string[];
      if (!facet.value) return ret(candidates.length > 0);
      return ret(candidates.some((c) => matchValue(c, facet.value!)));
    }
    case "attribute": {
      const value = view.attributes.get(firstEqual(facet.name) ?? "") ?? "";
      if (!facet.value) return ret(value.trim().length > 0);
      return ret(matchValue(value, facet.value));
    }
    case "property": {
      const psetName = firstEqual(facet.pset);
      const propName = firstEqual(facet.name);
      if (!psetName || !propName) return ret(false);
      // pset kan een pattern/oneOf zijn — dan matchen we alle psets die passen
      const psetMap = view.psets.get(psetName)
        ?? [...view.psets.entries()].find(([name]) => matchValue(name, facet.pset))?.[1];
      if (!psetMap) return ret(false);
      const val = psetMap.get(propName);
      if (val === undefined || val === null || val === "") return ret(false);
      if (facet.range) return ret(matchRange(val, facet.range));
      if (facet.value) return ret(matchValue(String(val), facet.value));
      return ret(true);
    }
  }
}

function matchValue(actual: string, match: ValueMatch, caseInsensitive = false): boolean {
  const norm = (s: string) => (caseInsensitive ? s.toUpperCase() : s);
  if (match.equal !== undefined) return norm(actual) === norm(match.equal);
  if (match.oneOf) return match.oneOf.some((v) => norm(v) === norm(actual));
  if (match.pattern) {
    try {
      return new RegExp(match.pattern, caseInsensitive ? "i" : "").test(actual);
    } catch {
      return false;
    }
  }
  return true;
}

function matchRange(val: string | number | boolean, r: RangeMatch): boolean {
  const n = typeof val === "number" ? val : Number(val);
  if (!Number.isFinite(n)) return false;
  if (r.min !== undefined) {
    if (r.minInclusive ? n < r.min : n <= r.min) return false;
  }
  if (r.max !== undefined) {
    if (r.maxInclusive ? n > r.max : n >= r.max) return false;
  }
  return true;
}

function firstEqual(m: ValueMatch): string | null {
  return m.equal ?? m.oneOf?.[0] ?? null;
}

function describeFacet(f: Facet): string {
  switch (f.kind) {
    case "entity":
      return `entiteit ${firstEqual(f.name) ?? "?"}${f.predefinedType ? ` (${firstEqual(f.predefinedType)})` : ""}`;
    case "classification":
      return `classificatie ${firstEqual(f.system) ?? "?"}${f.value ? ` = ${firstEqual(f.value)}` : ""}`;
    case "material":
      return `materiaal${f.value ? ` = ${firstEqual(f.value)}` : ""}`;
    case "property":
      return `${firstEqual(f.pset)}.${firstEqual(f.name)}${
        f.range
          ? ` in [${f.range.min ?? "-∞"}, ${f.range.max ?? "∞"}]`
          : f.value
            ? ` = ${firstEqual(f.value)}`
            : ""
      }`;
    case "attribute":
      return `attribuut ${firstEqual(f.name)}${f.value ? ` = ${firstEqual(f.value)}` : ""}`;
  }
}
