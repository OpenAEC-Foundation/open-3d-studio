import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";

const MM = 0.001;

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const brandwerendeDeur: ComponentTemplate = {
  id: "brandwerende-deur",
  name: "Brandwerende deur (EI30/60/90)",
  category: "Binnendeuren",
  nlSfb: "32.13",
  classification: { system: "NL-SfB", code: "32.13" },
  material: "Hout + brandwerende kern",
  loadBearing: false,
  isExternal: false,

  placementKind: "linear",
  ifcEntity: "IfcDoor",
  ifcPredefinedType: "DOOR",

  params: [
    { key: "breedte", label: "Deurbreedte", type: "length", min: 830, max: 1500, step: 10 },
    { key: "hoogte", label: "Deurhoogte", type: "length", min: 2115, max: 2315, step: 5 },
    { key: "fireRating", label: "Brandwerendheid (min)", type: "select",
      options: [{ value: "30", label: "EI30" }, { value: "60", label: "EI60" }, { value: "90", label: "EI90" }, { value: "120", label: "EI120" }] },
    { key: "zelfsluitend", label: "Zelfsluitend", type: "boolean" },
    { key: "basisHoogte", label: "Onderdorpel h.o.v. peil", type: "length", min: 0, max: 100, step: 5 },
  ],
  defaults: { breedte: 930, hoogte: 2115, fireRating: "60", zelfsluitend: true, basisHoogte: 0 },

  depth() { return 0.10; },
  color() { return "#d94c4c"; },

  solids(_l, p): SolidBox[] {
    const b = num(p, "breedte") * MM;
    const h = num(p, "hoogte") * MM;
    const d = 0.10;
    const kb = 0.07;
    const out: SolidBox[] = [];
    out.push({ cx: b / 2, cy: 0, zBottom: h - kb, dx: b, dy: d, dz: kb });
    out.push({ cx: kb / 2, cy: 0, zBottom: 0, dx: kb, dy: d, dz: h - kb });
    out.push({ cx: b - kb / 2, cy: 0, zBottom: 0, dx: kb, dy: d, dz: h - kb });
    out.push({ cx: b / 2, cy: 0, zBottom: 0, dx: b - 2 * kb, dy: 0.06, dz: h - kb });
    return out;
  },

  psetName: "Brandwerende_Deur",
  psetProps(_l, p) {
    return { Type: "Brandwerend", Breedte_mm: num(p, "breedte"), Hoogte_mm: num(p, "hoogte"), Brandwerendheid: `EI${num(p, "fireRating")}`, Zelfsluitend: !!p.zelfsluitend };
  },

  commonPset(_l, p) {
    return { FireRating: `EI${num(p, "fireRating")}`, SelfClosing: !!p.zelfsluitend, FireExit: true };
  },
};
