import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";

/** Breedplaatvloer 60 mm + in-situ druklaag.
 *  Twee-laags: prefab breedplaat (structuur) + in-situ druklaag (structuur). */

const MM = 0.001;

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const breedplaatvloer: ComponentTemplate = {
  id: "breedplaatvloer",
  name: "Breedplaatvloer + druklaag",
  category: "Vloeren",
  nlSfb: "23.12",
  classification: { system: "NL-SfB", code: "23.12" },
  material: "Beton, prefab + in-situ",
  loadBearing: true,

  placementKind: "surface",
  materialLayers: [
    { material: "Beton, prefab (breedplaat)", thicknessMm: 60, category: "structure", loadBearing: true, lambda: 2.3 },
    { material: "Beton, in-situ druklaag", thicknessMm: 200, category: "structure", loadBearing: true, lambda: 2.3 },
  ],

  ifcEntity: "IfcSlab",
  ifcPredefinedType: "FLOOR",

  params: [
    { key: "totaalDikte", label: "Totale dikte", type: "length", min: 200, max: 400, step: 10 },
    { key: "breedte", label: "Breedte", type: "length", min: 1000, max: 12000, step: 100 },
    { key: "basisHoogte", label: "Peil", type: "length", min: -5000, max: 20000, step: 10 },
  ],
  defaults: { totaalDikte: 260, breedte: 6000, basisHoogte: 0 },

  depth(p) { return num(p, "breedte") * MM; },
  color() { return "#b6b0a3"; },

  solids(length, p): SolidBox[] {
    const t = num(p, "totaalDikte") * MM;
    const b = num(p, "breedte") * MM;
    return [{ cx: length / 2, cy: 0, zBottom: 0, dx: length, dy: b, dz: t }];
  },

  psetName: "Breedplaat",
  psetProps(length, p) {
    return { Type: "Breedplaat + druklaag", TotaalDikte_mm: num(p, "totaalDikte"), Lengte_mm: Math.round(length / MM), Breedte_mm: num(p, "breedte") };
  },

  commonPset() { return { FireRating: "REI60" }; },
};
