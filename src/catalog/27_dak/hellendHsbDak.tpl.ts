import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";

/** Hellend HSB-dak: sporen 45×220 hoh 600 + isolatie + dampscherm + panlatten + dakpannen. */

const MM = 0.001;

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const hellendHsbDak: ComponentTemplate = {
  id: "hellend-hsb-dak",
  name: "Hellend HSB-dak (sporen + isolatie + pannen)",
  category: "Daken",
  nlSfb: "27.11",
  classification: { system: "NL-SfB", code: "27.11" },
  material: "Hout, gelamineerd + PIR + dakpannen",
  loadBearing: true,
  isExternal: true,

  placementKind: "surface",
  materialLayers: [
    { material: "Dampscherm (binnen)", thicknessMm: 1, category: "membrane" },
    { material: "HSB-sporen 220 mm", thicknessMm: 220, category: "structure", loadBearing: true, lambda: 0.13 },
    { material: "PIR-isolatie", thicknessMm: 140, category: "insulation", lambda: 0.023 },
    { material: "Onderdakfolie", thicknessMm: 1, category: "membrane" },
    { material: "Panlatten", thicknessMm: 30, category: "structure", lambda: 0.13 },
    { material: "Dakpannen (keramisch)", thicknessMm: 22, category: "cladding", lambda: 1.0 },
  ],

  ifcEntity: "IfcRoof",
  ifcPredefinedType: "GABLE_ROOF",

  params: [
    { key: "helling", label: "Dakhelling (graden)", type: "length", min: 20, max: 60, step: 1 },
    { key: "sporenHoogte", label: "Sporenhoogte", type: "length", min: 180, max: 300, step: 10 },
    { key: "isolatieDikte", label: "PIR-isolatie", type: "length", min: 100, max: 200, step: 10 },
    { key: "breedte", label: "Dakvlakbreedte", type: "length", min: 3000, max: 20000, step: 100 },
    { key: "basisHoogte", label: "Peil b.k. muurplaat", type: "length", min: 0, max: 30000, step: 10 },
  ],
  defaults: { helling: 45, sporenHoogte: 220, isolatieDikte: 140, breedte: 8000, basisHoogte: 3000 },

  depth(p) { return num(p, "breedte") * MM; },
  color() { return "#6b3a2a"; },

  solids(length, p): SolidBox[] {
    const b = num(p, "breedte") * MM;
    const spoor = num(p, "sporenHoogte") * MM;
    const iso = num(p, "isolatieDikte") * MM;
    const panlat = 0.030;
    const dakpan = 0.022;
    let z = 0;
    const out: SolidBox[] = [];
    for (const dz of [0.001, spoor, iso, 0.001, panlat, dakpan]) {
      out.push({ cx: length / 2, cy: 0, zBottom: z, dx: length, dy: b, dz });
      z += dz;
    }
    return out;
  },

  psetName: "Hellend_Dak",
  psetProps(length, p) {
    return { Type: "Hellend HSB-dak", DakhellingGraden: num(p, "helling"), SporenHoogte_mm: num(p, "sporenHoogte"), IsolatieDikte_mm: num(p, "isolatieDikte"), Lengte_mm: Math.round(length / MM), Breedte_mm: num(p, "breedte") };
  },
};
