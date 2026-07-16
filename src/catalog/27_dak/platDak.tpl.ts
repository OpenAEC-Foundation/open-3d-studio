import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";

/** Plat dak — dakopbouw: dakbeschot + dampscherm + isolatie + bitumen + ballast. */

const MM = 0.001;

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const platDak: ComponentTemplate = {
  id: "plat-dak",
  name: "Plat dak (bitumen + ballast)",
  category: "Daken",
  nlSfb: "27.21",
  classification: { system: "NL-SfB", code: "27.21" },
  material: "Beton/HSB + PIR-isolatie + bitumen",
  loadBearing: true,
  isExternal: true,

  placementKind: "surface",
  materialLayers: [
    { material: "Dampscherm", thicknessMm: 1, category: "membrane" },
    { material: "PIR-isolatie", thicknessMm: 160, category: "insulation" },
    { material: "Bitumen dakbanen", thicknessMm: 8, category: "membrane" },
    { material: "Ballast (grind)", thicknessMm: 50, category: "finish" },
  ],

  ifcEntity: "IfcRoof",
  ifcPredefinedType: "FLAT_ROOF",

  params: [
    { key: "isolatieDikte", label: "PIR-isolatie", type: "length", min: 100, max: 300, step: 10 },
    { key: "breedte", label: "Dakbreedte", type: "length", min: 2000, max: 20000, step: 100 },
    { key: "basisHoogte", label: "Peil b.k. dak", type: "length", min: 0, max: 30000, step: 10 },
  ],
  defaults: { isolatieDikte: 160, breedte: 8000, basisHoogte: 3000 },

  depth(p) { return num(p, "breedte") * MM; },
  color() { return "#4a4640"; },

  solids(length, p): SolidBox[] {
    const b = num(p, "breedte") * MM;
    const iso = num(p, "isolatieDikte") * MM;
    const dampscherm = 0.001;
    const bitumen = 0.008;
    const ballast = 0.050;
    let z = 0;
    const out: SolidBox[] = [];
    for (const [dz, ] of [[dampscherm, "damp"], [iso, "iso"], [bitumen, "bit"], [ballast, "bal"]] as const) {
      out.push({ cx: length / 2, cy: 0, zBottom: z, dx: length, dy: b, dz });
      z += dz;
    }
    return out;
  },

  psetName: "Plat_Dak",
  psetProps(length, p) {
    return { Type: "Plat dak", IsolatieDikte_mm: num(p, "isolatieDikte"), Lengte_mm: Math.round(length / MM), Breedte_mm: num(p, "breedte") };
  },

  commonPset(_l, p) {
    return {
      ThermalTransmittance: Math.max(0.15, 30 / num(p, "isolatieDikte")),
      TotalArea: Math.round((num(p, "breedte") / 1000) * 6),
    };
  },
};
