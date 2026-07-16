import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";

const MM = 0.001;

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const kozijnDraaiKiep: ComponentTemplate = {
  id: "kozijn-draai-kiep",
  name: "Kozijn draai-kiep",
  category: "Buitenkozijnen",
  nlSfb: "31.22",
  classification: { system: "NL-SfB", code: "31.22" },
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
    { key: "kozijnBreedte", label: "Profielbreedte kozijn", type: "length", min: 60, max: 150, step: 5 },
    { key: "beglazing", label: "Beglazing", type: "select",
      options: [{ value: "HR++", label: "HR++ (U 1.1)" }, { value: "HR+++", label: "HR+++ (U 0.9)" }, { value: "triple", label: "Triple (U 0.6)" }] },
    { key: "basisHoogte", label: "Onderdorpel h.o.v. peil", type: "length", min: 0, max: 3000, step: 10 },
  ],
  defaults: { breedte: 1000, hoogte: 1400, kozijnDiepte: 100, kozijnBreedte: 80, beglazing: "HR+++", basisHoogte: 900 },

  depth(p) { return num(p, "kozijnDiepte") * MM; },
  color() { return "#5a6068"; },

  solids(_length, p): SolidBox[] {
    const b = num(p, "breedte") * MM;
    const h = num(p, "hoogte") * MM;
    const d = num(p, "kozijnDiepte") * MM;
    const kb = num(p, "kozijnBreedte") * MM;

    // Kozijn: vier randen. Beglazing: één plaat centraal, dunner.
    const out: SolidBox[] = [];
    // onderdorpel
    out.push({ cx: b / 2, cy: 0, zBottom: 0, dx: b, dy: d, dz: kb });
    // bovendorpel
    out.push({ cx: b / 2, cy: 0, zBottom: h - kb, dx: b, dy: d, dz: kb });
    // linker stijl
    out.push({ cx: kb / 2, cy: 0, zBottom: kb, dx: kb, dy: d, dz: h - 2 * kb });
    // rechter stijl
    out.push({ cx: b - kb / 2, cy: 0, zBottom: kb, dx: kb, dy: d, dz: h - 2 * kb });
    // beglazing
    const gDikte = 0.024;
    out.push({ cx: b / 2, cy: 0, zBottom: kb, dx: b - 2 * kb, dy: gDikte, dz: h - 2 * kb });
    return out;
  },

  psetName: "Kozijn_DraaiKiep",
  psetProps(_l, p) {
    return { Type: "Draai-kiep kozijn", Breedte_mm: num(p, "breedte"), Hoogte_mm: num(p, "hoogte"), Beglazing: String(p.beglazing) };
  },

  commonPset(_l, p) {
    const u = p.beglazing === "triple" ? 0.6 : p.beglazing === "HR+++" ? 0.9 : 1.1;
    return { ThermalTransmittance: u, GlazingAreaFraction: 0.75 };
  },
};
