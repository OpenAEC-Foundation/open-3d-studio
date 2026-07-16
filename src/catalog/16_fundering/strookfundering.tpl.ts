import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";

const MM = 0.001;

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const strookfundering: ComponentTemplate = {
  id: "strookfundering",
  name: "Strookfundering (gewapend beton)",
  category: "Fundering",
  nlSfb: "16.11",
  classification: { system: "NL-SfB", code: "16.11" },
  material: "Beton, gewapend C25/30",
  loadBearing: true,
  isExternal: false,

  placementKind: "linear",
  ifcEntity: "IfcFooting",
  ifcPredefinedType: "STRIP_FOOTING",

  params: [
    { key: "breedte", label: "Strookbreedte", type: "length", min: 300, max: 1000, step: 50 },
    { key: "hoogte", label: "Strookhoogte", type: "length", min: 400, max: 1200, step: 50 },
    { key: "basisHoogte", label: "Peil b.k. fundering", type: "length", min: -3000, max: 0, step: 10 },
  ],
  defaults: { breedte: 400, hoogte: 800, basisHoogte: -1000 },

  depth(p) { return num(p, "breedte") * MM; },
  color() { return "#8a857b"; },

  solids(length, p): SolidBox[] {
    const b = num(p, "breedte") * MM;
    const h = num(p, "hoogte") * MM;
    return [{ cx: length / 2, cy: 0, zBottom: 0, dx: length, dy: b, dz: h }];
  },

  psetName: "Strookfundering",
  psetProps(length, p) {
    return { Type: "Strookfundering", Breedte_mm: num(p, "breedte"), Hoogte_mm: num(p, "hoogte"), Lengte_mm: Math.round(length / MM) };
  },
};
