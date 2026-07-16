import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";

const MM = 0.001;

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const spijlleuning: ComponentTemplate = {
  id: "spijlleuning",
  name: "Spijlleuning (staal)",
  category: "Balustrades",
  nlSfb: "34.11",
  classification: { system: "NL-SfB", code: "34.11" },
  material: "Staal, gepoedercoat",
  loadBearing: false,

  placementKind: "linear",
  ifcEntity: "IfcRailing",
  ifcPredefinedType: "BALUSTRADE",

  params: [
    { key: "hoogte", label: "Balustradehoogte", type: "length", min: 800, max: 1200, step: 10 },
    { key: "spijlAfstand", label: "H.o.h. spijlen", type: "length", min: 80, max: 200, step: 5 },
    { key: "spijlDiameter", label: "Spijldiameter", type: "length", min: 10, max: 30, step: 2 },
    { key: "handregelDikte", label: "Handregeldikte", type: "length", min: 40, max: 80, step: 5 },
    { key: "basisHoogte", label: "Peil onderkant", type: "length", min: 0, max: 10000, step: 10 },
  ],
  defaults: { hoogte: 900, spijlAfstand: 100, spijlDiameter: 16, handregelDikte: 50, basisHoogte: 0 },

  depth() { return 0.05; },
  color() { return "#2a2a2a"; },

  solids(length, p): SolidBox[] {
    const h = num(p, "hoogte") * MM;
    const sa = num(p, "spijlAfstand") * MM;
    const sd = num(p, "spijlDiameter") * MM;
    const hd = num(p, "handregelDikte") * MM;
    const out: SolidBox[] = [];
    // Onderregel + handregel
    out.push({ cx: length / 2, cy: 0, zBottom: 0, dx: length, dy: hd, dz: hd });
    out.push({ cx: length / 2, cy: 0, zBottom: h - hd, dx: length, dy: hd, dz: hd });
    // Spijlen tussen onder- en handregel
    const n = Math.max(2, Math.floor(length / sa));
    for (let i = 0; i <= n; i++) {
      const cx = (i * length) / n;
      out.push({ cx, cy: 0, zBottom: hd, dx: sd, dy: sd, dz: h - 2 * hd });
    }
    return out;
  },

  psetName: "Spijlleuning",
  psetProps(length, p) {
    return { Type: "Spijlleuning", Hoogte_mm: num(p, "hoogte"), SpijlAfstand_mm: num(p, "spijlAfstand"), Lengte_mm: Math.round(length / MM) };
  },

  commonPset(_l, p) {
    return { Height: num(p, "hoogte") / 1000 };
  },
};
