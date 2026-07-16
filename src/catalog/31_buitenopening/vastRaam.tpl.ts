import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";

const MM = 0.001;

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const vastRaam: ComponentTemplate = {
  id: "vast-raam",
  name: "Vast raam",
  category: "Buitenkozijnen",
  nlSfb: "31.21",
  classification: { system: "NL-SfB", code: "31.21" },
  material: "Aluminium, geanodiseerd",
  loadBearing: false,
  isExternal: true,

  placementKind: "linear",
  ifcEntity: "IfcWindow",
  ifcPredefinedType: "WINDOW",

  params: [
    { key: "breedte", label: "Kozijnbreedte", type: "length", min: 400, max: 3000, step: 10 },
    { key: "hoogte", label: "Kozijnhoogte", type: "length", min: 400, max: 2500, step: 10 },
    { key: "kozijnDiepte", label: "Kozijndiepte", type: "length", min: 60, max: 200, step: 5 },
    { key: "beglazing", label: "Beglazing", type: "select",
      options: [{ value: "HR++", label: "HR++" }, { value: "HR+++", label: "HR+++" }, { value: "triple", label: "Triple" }] },
    { key: "basisHoogte", label: "Onderdorpel h.o.v. peil", type: "length", min: 0, max: 3000, step: 10 },
  ],
  defaults: { breedte: 800, hoogte: 1200, kozijnDiepte: 80, beglazing: "HR+++", basisHoogte: 900 },

  depth(p) { return num(p, "kozijnDiepte") * MM; },
  color() { return "#5a6068"; },

  solids(_length, p): SolidBox[] {
    const b = num(p, "breedte") * MM;
    const h = num(p, "hoogte") * MM;
    const d = num(p, "kozijnDiepte") * MM;
    const kb = 0.06;
    const out: SolidBox[] = [];
    out.push({ cx: b / 2, cy: 0, zBottom: 0, dx: b, dy: d, dz: kb });
    out.push({ cx: b / 2, cy: 0, zBottom: h - kb, dx: b, dy: d, dz: kb });
    out.push({ cx: kb / 2, cy: 0, zBottom: kb, dx: kb, dy: d, dz: h - 2 * kb });
    out.push({ cx: b - kb / 2, cy: 0, zBottom: kb, dx: kb, dy: d, dz: h - 2 * kb });
    out.push({ cx: b / 2, cy: 0, zBottom: kb, dx: b - 2 * kb, dy: 0.024, dz: h - 2 * kb });
    return out;
  },

  psetName: "Vast_Raam",
  psetProps(_l, p) {
    return { Type: "Vast raam", Breedte_mm: num(p, "breedte"), Hoogte_mm: num(p, "hoogte"), Beglazing: String(p.beglazing) };
  },

  commonPset(_l, p) {
    const u = p.beglazing === "triple" ? 0.6 : p.beglazing === "HR+++" ? 0.9 : 1.1;
    return { ThermalTransmittance: u, GlazingAreaFraction: 0.85 };
  },
};
