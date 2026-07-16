import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";

const MM = 0.001;

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const systeemplafond: ComponentTemplate = {
  id: "systeemplafond-600",
  name: "Systeemplafond 600×600",
  category: "Plafonds",
  nlSfb: "45.11",
  classification: { system: "NL-SfB", code: "45.11" },
  material: "Minerale wolplaat + verzinkt-stalen T-grid",
  loadBearing: false,
  isExternal: false,

  placementKind: "surface",
  ifcEntity: "IfcCovering",
  ifcPredefinedType: "CEILING",

  params: [
    { key: "breedte", label: "Ruimte-breedte", type: "length", min: 2000, max: 20000, step: 100 },
    { key: "plaatDikte", label: "Plaatdikte", type: "length", min: 15, max: 40, step: 5 },
    { key: "basisHoogte", label: "Peil onderkant plafond", type: "length", min: 2000, max: 4000, step: 10 },
  ],
  defaults: { breedte: 6000, plaatDikte: 20, basisHoogte: 2700 },

  depth(p) { return num(p, "breedte") * MM; },
  color() { return "#e8e6e0"; },

  solids(length, p): SolidBox[] {
    const b = num(p, "breedte") * MM;
    const t = num(p, "plaatDikte") * MM;
    return [{ cx: length / 2, cy: 0, zBottom: 0, dx: length, dy: b, dz: t }];
  },

  psetName: "Systeemplafond",
  psetProps(length, p) {
    return { Type: "Systeemplafond 600×600", PlaatDikte_mm: num(p, "plaatDikte"), Lengte_mm: Math.round(length / MM), Breedte_mm: num(p, "breedte") };
  },
};
