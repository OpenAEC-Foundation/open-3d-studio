import type { Facet, IdsDocument, Specification, ValueMatch } from "./types";

/** Parseer een buildingSMART IDS-XML naar de interne representatie.
 *
 *  IDS v1.0 gebruikt `xs:restriction` voor value-matching. Voor onze doeleinden
 *  vertalen we `<xs:enumeration>` naar `oneOf`, `<xs:pattern>` naar `pattern`
 *  en één plaatje-zonder-restriction naar `equal`. Alles daarbuiten (bounds op
 *  strings, length-restrictions) wordt genegeerd — het model matcht dan bewust
 *  minder streng, zodat de rapportage nooit onterecht "fout" meldt. */
export function parseIdsXml(xml: string): IdsDocument {
  const dom = new DOMParser().parseFromString(xml, "application/xml");
  const err = dom.querySelector("parsererror");
  if (err) throw new Error(`IDS-XML kon niet worden gelezen: ${err.textContent}`);
  const root = dom.documentElement;
  if (!root || root.localName !== "ids") {
    throw new Error("IDS-bestand mist een <ids>-wortelelement.");
  }
  const info = firstChildLocal(root, "info");
  const doc: IdsDocument = {
    title: textOf(info, "title") ?? "IDS-controle",
    description: textOf(info, "description") ?? undefined,
    author: textOf(info, "author") ?? undefined,
    version: textOf(info, "version") ?? undefined,
    specifications: [],
  };
  const specs = firstChildLocal(root, "specifications");
  if (!specs) return doc;
  for (const s of childrenLocal(specs, "specification")) {
    doc.specifications.push(parseSpecification(s));
  }
  return doc;
}

function parseSpecification(el: Element): Specification {
  const name = el.getAttribute("name") ?? "Onbenoemde specificatie";
  const description = el.getAttribute("description") ?? undefined;
  const cardinality = (el.getAttribute("cardinality") as Specification["cardinality"]) ?? "required";
  const applicability = parseFacetContainer(firstChildLocal(el, "applicability"));
  const requirements = parseFacetContainer(firstChildLocal(el, "requirements"));
  return { name, description, cardinality, applicability, requirements };
}

function parseFacetContainer(el: Element | null): Facet[] {
  if (!el) return [];
  const facets: Facet[] = [];
  for (const c of Array.from(el.children)) {
    const facet = parseFacet(c);
    if (facet) facets.push(facet);
  }
  return facets;
}

function parseFacet(el: Element): Facet | null {
  switch (el.localName) {
    case "entity": {
      const name = parseValueMatch(firstChildLocal(el, "name"));
      const predefinedType = parseValueMatch(firstChildLocal(el, "predefinedType"));
      if (!name) return null;
      return { kind: "entity", name, predefinedType: predefinedType ?? undefined };
    }
    case "classification": {
      const system = parseValueMatch(firstChildLocal(el, "system"));
      const value = parseValueMatch(firstChildLocal(el, "value"));
      if (!system) return null;
      return { kind: "classification", system, value: value ?? undefined };
    }
    case "material": {
      const value = parseValueMatch(firstChildLocal(el, "value"));
      return { kind: "material", value: value ?? undefined };
    }
    case "property": {
      const pset = parseValueMatch(firstChildLocal(el, "propertySet"));
      const name = parseValueMatch(firstChildLocal(el, "baseName"));
      const value = parseValueMatch(firstChildLocal(el, "value"));
      const range = parseRange(firstChildLocal(el, "value"));
      const dataType = (el.getAttribute("dataType") ?? undefined) as any;
      if (!pset || !name) return null;
      return {
        kind: "property",
        pset,
        name,
        value: value ?? undefined,
        range: range ?? undefined,
        dataType,
      };
    }
    case "attribute": {
      const name = parseValueMatch(firstChildLocal(el, "name"));
      const value = parseValueMatch(firstChildLocal(el, "value"));
      if (!name) return null;
      return { kind: "attribute", name, value: value ?? undefined };
    }
    default:
      return null;
  }
}

/** Match op simple- of restriction-node. Retourneert `null` bij lege input. */
function parseValueMatch(el: Element | null): ValueMatch | null {
  if (!el) return null;
  const simple = firstChildLocal(el, "simpleValue");
  if (simple && simple.textContent) return { equal: simple.textContent.trim() };
  const restriction = firstChildLocal(el, "restriction");
  if (!restriction) {
    const text = el.textContent?.trim();
    return text ? { equal: text } : null;
  }
  const enums = childrenLocal(restriction, "enumeration")
    .map((c) => c.getAttribute("value") ?? "")
    .filter(Boolean);
  if (enums.length === 1) return { equal: enums[0] };
  if (enums.length > 1) return { oneOf: enums };
  const pattern = firstChildLocal(restriction, "pattern")?.getAttribute("value");
  if (pattern) return { pattern };
  return null;
}

function parseRange(el: Element | null) {
  if (!el) return null;
  const restriction = firstChildLocal(el, "restriction");
  if (!restriction) return null;
  const bound = (name: string): number | undefined => {
    const attr = firstChildLocal(restriction, name)?.getAttribute("value");
    if (attr === null || attr === undefined || attr === "") return undefined;
    const n = Number(attr);
    return Number.isFinite(n) ? n : undefined;
  };
  const minInc = bound("minInclusive");
  const minExc = bound("minExclusive");
  const maxInc = bound("maxInclusive");
  const maxExc = bound("maxExclusive");
  const range = {
    min: minInc ?? minExc,
    minInclusive: minInc !== undefined,
    max: maxInc ?? maxExc,
    maxInclusive: maxInc !== undefined,
  };
  return range.min === undefined && range.max === undefined ? null : range;
}

// ------- kleine DOM-helpers (localName-based zodat namespaces geen roet gooien) ---

function firstChildLocal(parent: Element | null | undefined, local: string): Element | null {
  if (!parent) return null;
  for (const child of Array.from(parent.children)) {
    if (child.localName === local) return child;
  }
  return null;
}

function childrenLocal(parent: Element | null, local: string): Element[] {
  if (!parent) return [];
  return Array.from(parent.children).filter((c) => c.localName === local);
}

function textOf(parent: Element | null, local: string): string | null {
  return firstChildLocal(parent, local)?.textContent?.trim() ?? null;
}
