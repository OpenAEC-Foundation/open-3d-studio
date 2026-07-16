import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";

const MM = 0.001;

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const baksteenHalfsteens: ComponentTemplate = {
  id: "baksteen-halfsteens",
  name: "Baksteenmetselwerk halfsteens",
  category: "Gevelbekleding",
  nlSfb: "41.21",
  classification: { system: "NL-SfB", code: "41.21" },
  material: "Baksteen (keramisch)",
  loadBearing: false,
  isExternal: true,

  placementKind: "linear",
  materialLayers: [{ material: "Baksteen (keramisch)", thicknessMm: 100, category: "cladding", lambda: 0.7 }],

  ifcEntity: "IfcCovering",
  ifcPredefinedType: "CLADDING",

  params: [
    { key: "baksteenmaat", label: "Baksteenmaat", type: "select",
      options: [{ value: "WF", label: "WF — 210×100×50" }, { value: "MF", label: "MF — 205×100×65" }, { value: "DF", label: "DF — 240×115×52" }] },
    { key: "hoogte", label: "Metselhoogte", type: "length", min: 500, max: 6000, step: 10 },
    { key: "basisHoogte", label: "Peil onderkant metselwerk", type: "length", min: -1000, max: 6000, step: 10 },
  ],
  defaults: { baksteenmaat: "WF", hoogte: 2800, basisHoogte: 0 },

  depth() { return 0.1; },
  color() { return "#b0553a"; },

  solids(length, p): SolidBox[] {
    const h = num(p, "hoogte") * MM;
    return [{ cx: length / 2, cy: 0, zBottom: 0, dx: length, dy: 0.1, dz: h }];
  },

  psetName: "Baksteen_Metselwerk",
  psetProps(length, p) {
    return { Type: "Halfsteens metselwerk", Baksteenmaat: String(p.baksteenmaat), Lengte_mm: Math.round(length / MM), Hoogte_mm: num(p, "hoogte") };
  },
};
