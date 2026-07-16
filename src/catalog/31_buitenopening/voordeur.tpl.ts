import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";

const MM = 0.001;

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const voordeur: ComponentTemplate = {
  id: "voordeur",
  name: "Voordeur (paneel, geïsoleerd)",
  category: "Buitendeuren",
  nlSfb: "31.11",
  classification: { system: "NL-SfB", code: "31.11" },
  material: "Aluminium + PIR-kern",
  loadBearing: false,
  isExternal: true,

  placementKind: "linear",
  ifcEntity: "IfcDoor",
  ifcPredefinedType: "DOOR",

  params: [
    { key: "breedte", label: "Deurbreedte", type: "length", min: 800, max: 1200, step: 10 },
    { key: "hoogte", label: "Deurhoogte", type: "length", min: 2015, max: 2500, step: 5 },
    { key: "kozijnDiepte", label: "Kozijndiepte", type: "length", min: 80, max: 200, step: 5 },
    { key: "basisHoogte", label: "Onderdorpel h.o.v. peil", type: "length", min: -100, max: 200, step: 5 },
  ],
  defaults: { breedte: 930, hoogte: 2315, kozijnDiepte: 120, basisHoogte: 0 },

  depth(p) { return num(p, "kozijnDiepte") * MM; },
  color() { return "#3d4550"; },

  solids(_l, p): SolidBox[] {
    const b = num(p, "breedte") * MM;
    const h = num(p, "hoogte") * MM;
    const d = num(p, "kozijnDiepte") * MM;
    // Kozijn (3-zijdig, geen dorpel) + deurblad
    const kb = 0.08;
    const out: SolidBox[] = [];
    out.push({ cx: b / 2, cy: 0, zBottom: h - kb, dx: b, dy: d, dz: kb });
    out.push({ cx: kb / 2, cy: 0, zBottom: 0, dx: kb, dy: d, dz: h - kb });
    out.push({ cx: b - kb / 2, cy: 0, zBottom: 0, dx: kb, dy: d, dz: h - kb });
    // Deurblad iets uitgesprongen
    out.push({ cx: b / 2, cy: 0, zBottom: 0, dx: b - 2 * kb, dy: 0.06, dz: h - kb });
    return out;
  },

  psetName: "Voordeur",
  psetProps(_l, p) {
    return { Type: "Voordeur paneel", Breedte_mm: num(p, "breedte"), Hoogte_mm: num(p, "hoogte") };
  },

  commonPset() { return { ThermalTransmittance: 1.0, SecurityRating: "SKG **" }; },
};
