import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";

/** Prefab betonwand: sandwich met binnenblad + isolatie + buitenblad (gevelelement). */

const MM = 0.001;

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const prefabBetonwand: ComponentTemplate = {
  id: "prefab-betonwand",
  name: "Prefab betonwand (sandwich)",
  category: "Buitenwanden",
  nlSfb: "21.11",
  classification: { system: "NL-SfB", code: "21.11" },
  material: "Beton, prefab + PIR-isolatie",
  loadBearing: true,
  isExternal: true,

  placementKind: "linear",
  materialLayers: [
    { material: "Beton, prefab (binnenblad)", thicknessMm: 150, category: "structure", loadBearing: true },
    { material: "PIR-isolatie", thicknessMm: 120, category: "insulation" },
    { material: "Beton, prefab (buitenblad)", thicknessMm: 80, category: "cladding" },
  ],

  ifcEntity: "IfcWall",
  ifcPredefinedType: "SOLIDWALL",

  params: [
    { key: "binnenDikte", label: "Binnenblad", type: "length", min: 100, max: 250, step: 10 },
    { key: "isolatie", label: "Isolatie", type: "length", min: 80, max: 200, step: 10 },
    { key: "buitenDikte", label: "Buitenblad", type: "length", min: 60, max: 150, step: 10 },
    { key: "hoogte", label: "Wandhoogte", type: "length", min: 2400, max: 4500, step: 10 },
    { key: "basisHoogte", label: "Peil", type: "length", min: -5000, max: 20000, step: 10 },
  ],
  defaults: { binnenDikte: 150, isolatie: 120, buitenDikte: 80, hoogte: 2900, basisHoogte: 0 },

  depth(p) { return (num(p, "binnenDikte") + num(p, "isolatie") + num(p, "buitenDikte")) * MM; },
  color() { return "#a49f92"; },

  solids(length, p): SolidBox[] {
    const bi = num(p, "binnenDikte") * MM;
    const iso = num(p, "isolatie") * MM;
    const bu = num(p, "buitenDikte") * MM;
    const h = num(p, "hoogte") * MM;
    const totaal = bi + iso + bu;
    let cursor = -totaal / 2;
    const out: SolidBox[] = [];
    for (const laag of [bi, iso, bu]) {
      out.push({ cx: length / 2, cy: cursor + laag / 2, zBottom: 0, dx: length, dy: laag, dz: h });
      cursor += laag;
    }
    return out;
  },

  psetName: "Prefab_Betonwand",
  psetProps(length, p) {
    return { Type: "Prefab sandwich", Binnenblad_mm: num(p, "binnenDikte"), Isolatie_mm: num(p, "isolatie"), Buitenblad_mm: num(p, "buitenDikte"), Lengte_mm: Math.round(length / MM), Hoogte_mm: num(p, "hoogte") };
  },

  commonPset(_l, p) {
    // vereenvoudigde Rc-schatting op basis van isolatiedikte
    return { ThermalTransmittance: Math.max(0.15, 30 / num(p, "isolatie")) };
  },
};
