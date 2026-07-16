import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";

const MM = 0.001;

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const binnendeur: ComponentTemplate = {
  id: "binnendeur-stomp",
  name: "Binnendeur stompe",
  category: "Binnendeuren",
  nlSfb: "32.11",
  classification: { system: "NL-SfB", code: "32.11" },
  material: "Hout, gelakt",
  loadBearing: false,
  isExternal: false,

  placementKind: "linear",
  ifcEntity: "IfcDoor",
  ifcPredefinedType: "DOOR",

  params: [
    { key: "breedte", label: "Deurbreedte", type: "length", min: 630, max: 1080, step: 10 },
    { key: "hoogte", label: "Deurhoogte", type: "length", min: 2015, max: 2315, step: 5 },
    { key: "opdek", label: "Type", type: "select", options: [{ value: "stomp", label: "Stomp" }, { value: "opdek", label: "Opdek" }] },
    { key: "basisHoogte", label: "Onderdorpel h.o.v. peil", type: "length", min: 0, max: 100, step: 5 },
  ],
  defaults: { breedte: 830, hoogte: 2015, opdek: "stomp", basisHoogte: 0 },

  depth(p) { return p.opdek === "opdek" ? 0.10 : 0.09; },
  color() { return "#c8ad82"; },

  solids(_l, p): SolidBox[] {
    const b = num(p, "breedte") * MM;
    const h = num(p, "hoogte") * MM;
    const d = p.opdek === "opdek" ? 0.10 : 0.09;
    const kb = 0.06;
    const out: SolidBox[] = [];
    out.push({ cx: b / 2, cy: 0, zBottom: h - kb, dx: b, dy: d, dz: kb });
    out.push({ cx: kb / 2, cy: 0, zBottom: 0, dx: kb, dy: d, dz: h - kb });
    out.push({ cx: b - kb / 2, cy: 0, zBottom: 0, dx: kb, dy: d, dz: h - kb });
    out.push({ cx: b / 2, cy: 0, zBottom: 0, dx: b - 2 * kb, dy: 0.04, dz: h - kb });
    return out;
  },

  psetName: "Binnendeur",
  psetProps(_l, p) {
    return { Type: String(p.opdek), Breedte_mm: num(p, "breedte"), Hoogte_mm: num(p, "hoogte") };
  },
};
