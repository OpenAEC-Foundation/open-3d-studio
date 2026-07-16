import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";

const MM = 0.001;

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const poer: ComponentTemplate = {
  id: "poer-fundering",
  name: "Poer (puntfundering)",
  category: "Fundering",
  nlSfb: "16.12",
  classification: { system: "NL-SfB", code: "16.12" },
  material: "Beton, gewapend C25/30",
  loadBearing: true,

  placementKind: "point",
  ifcEntity: "IfcFooting",
  ifcPredefinedType: "PAD_FOOTING",

  params: [
    { key: "breedte", label: "Poerbreedte (x)", type: "length", min: 400, max: 1500, step: 50 },
    { key: "diepte", label: "Poerbreedte (y)", type: "length", min: 400, max: 1500, step: 50 },
    { key: "hoogte", label: "Poerhoogte", type: "length", min: 400, max: 1200, step: 50 },
    { key: "basisHoogte", label: "Peil b.k. poer", type: "length", min: -3000, max: 0, step: 10 },
  ],
  defaults: { breedte: 800, diepte: 800, hoogte: 800, basisHoogte: -1000 },

  depth(p) { return num(p, "diepte") * MM; },
  color() { return "#7f7a70"; },

  solids(_length, p): SolidBox[] {
    const dx = num(p, "breedte") * MM;
    const dy = num(p, "diepte") * MM;
    const dz = num(p, "hoogte") * MM;
    return [{ cx: 0, cy: 0, zBottom: 0, dx, dy, dz }];
  },

  psetName: "Poer",
  psetProps(_l, p) {
    return { Type: "Poer", Breedte_mm: num(p, "breedte"), Diepte_mm: num(p, "diepte"), Hoogte_mm: num(p, "hoogte") };
  },
};
