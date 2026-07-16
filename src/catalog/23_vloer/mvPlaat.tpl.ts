import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";

/** Massieve vloer (MV-plaat) gewapend beton 250/300 mm — grondvloer of kelderdek. */

const MM = 0.001;
const DIKTES: Record<string, number> = { "250": 250, "300": 300 };

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const mvPlaat: ComponentTemplate = {
  id: "mv-plaat",
  name: "MV-plaat gewapend (grondvloer/kelderdek)",
  category: "Vloeren",
  nlSfb: "13.11",
  classification: { system: "NL-SfB", code: "13.11" },
  material: "Beton, gewapend",
  loadBearing: true,

  placementKind: "surface",
  materialLayers: [{ material: "Beton, gewapend C25/30", thicknessMm: 250, category: "structure", loadBearing: true, lambda: 2.3 }],

  ifcEntity: "IfcSlab",
  ifcPredefinedType: "BASESLAB",

  params: [
    { key: "dikte", label: "Vloerdikte", type: "select", options: [{ value: "250", label: "250 mm" }, { value: "300", label: "300 mm" }] },
    { key: "breedte", label: "Breedte", type: "length", min: 1000, max: 20000, step: 100 },
    { key: "basisHoogte", label: "Peil (b.k. vloer)", type: "length", min: -5000, max: 5000, step: 10 },
  ],
  defaults: { dikte: "250", breedte: 6000, basisHoogte: 0 },

  depth(p) { return num(p, "breedte") * MM; },
  color() { return "#8f8b83"; },

  solids(length, p): SolidBox[] {
    const dikte = (DIKTES[String(p.dikte)] ?? 250) * MM;
    const b = num(p, "breedte") * MM;
    return [{ cx: length / 2, cy: 0, zBottom: 0, dx: length, dy: b, dz: dikte }];
  },

  psetName: "MV_Plaat",
  psetProps(length, p) {
    return { Type: "MV-plaat gewapend", Dikte_mm: DIKTES[String(p.dikte)] ?? 250, Lengte_mm: Math.round(length / MM), Breedte_mm: num(p, "breedte") };
  },
};
