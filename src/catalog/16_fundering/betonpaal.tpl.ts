import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";

const MM = 0.001;

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const prefabBetonpaal: ComponentTemplate = {
  id: "prefab-betonpaal",
  name: "Prefab betonpaal (heipaal)",
  category: "Fundering",
  nlSfb: "17.11",
  classification: { system: "NL-SfB", code: "17.11" },
  material: "Beton, prefab C50/60",
  loadBearing: true,

  placementKind: "point",
  ifcEntity: "IfcPile",
  ifcPredefinedType: "COHESION",
  ifcObjectType: "Prefab betonpaal",

  params: [
    { key: "paalMaat", label: "Paalmaat", type: "select",
      options: [{ value: "220", label: "220×220 mm" }, { value: "250", label: "250×250 mm" }, { value: "290", label: "290×290 mm" }, { value: "320", label: "320×320 mm" }] },
    { key: "lengte", label: "Paallengte", type: "length", min: 6000, max: 18000, step: 500 },
    { key: "basisHoogte", label: "B.k. paal (peil)", type: "length", min: -3000, max: 0, step: 10 },
  ],
  defaults: { paalMaat: "250", lengte: 12000, basisHoogte: -1000 },

  depth(p) { return (typeof p.paalMaat === "string" ? parseInt(p.paalMaat) : 250) * MM; },
  color() { return "#7a7269"; },

  solids(_length, p): SolidBox[] {
    const s = (typeof p.paalMaat === "string" ? parseInt(p.paalMaat) : 250) * MM;
    const L = num(p, "lengte") * MM;
    // Paal groeit naar beneden vanaf basisHoogte, dus negatieve zBottom
    return [{ cx: 0, cy: 0, zBottom: -L, dx: s, dy: s, dz: L }];
  },

  psetName: "Prefab_Betonpaal",
  psetProps(_l, p) {
    return { Fabrikant: "Voorgeschreven leverancier", Type: "Prefab betonpaal", Maat_mm: p.paalMaat, Lengte_mm: num(p, "lengte") };
  },

  commonPset() {
    return { PileHeadElevation: 0, PileToeElevation: -12 };
  },
};
