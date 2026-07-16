import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";

const MM = 0.001;

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const dekvloer: ComponentTemplate = {
  id: "dekvloer",
  name: "Dekvloer (zwevend)",
  category: "Vloerafwerking",
  nlSfb: "43.11",
  classification: { system: "NL-SfB", code: "43.11" },
  material: "Cementdekvloer + PIR onderdekvloer",
  loadBearing: false,

  placementKind: "surface",
  materialLayers: [
    { material: "PIR-isolatie", thicknessMm: 40, category: "insulation", lambda: 0.023 },
    { material: "Cementdekvloer", thicknessMm: 60, category: "finish", lambda: 1.4 },
  ],

  ifcEntity: "IfcCovering",
  ifcPredefinedType: "FLOORING",

  params: [
    { key: "isolatieDikte", label: "Isolatiedikte", type: "length", min: 30, max: 100, step: 5 },
    { key: "dekvloerDikte", label: "Dekvloerdikte", type: "length", min: 50, max: 100, step: 5 },
    { key: "breedte", label: "Ruimtebreedte", type: "length", min: 2000, max: 20000, step: 100 },
    { key: "basisHoogte", label: "Peil b.k. constructievloer", type: "length", min: -1000, max: 20000, step: 10 },
  ],
  defaults: { isolatieDikte: 40, dekvloerDikte: 60, breedte: 6000, basisHoogte: 0 },

  depth(p) { return num(p, "breedte") * MM; },
  color() { return "#c9c3b3"; },

  solids(length, p): SolidBox[] {
    const b = num(p, "breedte") * MM;
    const iso = num(p, "isolatieDikte") * MM;
    const dek = num(p, "dekvloerDikte") * MM;
    return [
      { cx: length / 2, cy: 0, zBottom: 0, dx: length, dy: b, dz: iso },
      { cx: length / 2, cy: 0, zBottom: iso, dx: length, dy: b, dz: dek },
    ];
  },

  psetName: "Dekvloer",
  psetProps(length, p) {
    return { Type: "Zwevende dekvloer", IsolatieDikte_mm: num(p, "isolatieDikte"), DekvloerDikte_mm: num(p, "dekvloerDikte"), Lengte_mm: Math.round(length / MM), Breedte_mm: num(p, "breedte") };
  },
};
