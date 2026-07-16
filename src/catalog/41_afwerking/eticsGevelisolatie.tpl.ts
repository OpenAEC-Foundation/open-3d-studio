import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";

/** ETICS = External Thermal Insulation Composite System.
 *  120 mm PIR + wapeningsnet + stucwerk als afwerking op de gevel. */

const MM = 0.001;

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const eticsGevelisolatie: ComponentTemplate = {
  id: "etics-gevelisolatie",
  name: "ETICS-gevelisolatie (PIR + stucwerk)",
  category: "Gevelafwerking",
  nlSfb: "41.31",
  classification: { system: "NL-SfB", code: "41.31" },
  material: "PIR + minerale afwerkstuc",
  loadBearing: false,
  isExternal: true,

  placementKind: "linear",
  materialLayers: [
    { material: "PIR-isolatie", thicknessMm: 120, category: "insulation", lambda: 0.023 },
    { material: "Minerale afwerkstuc", thicknessMm: 8, category: "finish", lambda: 0.87 },
  ],

  ifcEntity: "IfcCovering",
  ifcPredefinedType: "CLADDING",

  params: [
    { key: "isolatieDikte", label: "PIR-isolatie", type: "length", min: 80, max: 200, step: 10 },
    { key: "stucDikte", label: "Stucwerkdikte", type: "length", min: 6, max: 15, step: 1 },
    { key: "hoogte", label: "Wandhoogte", type: "length", min: 2400, max: 4500, step: 10 },
    { key: "basisHoogte", label: "Peil", type: "length", min: -1000, max: 6000, step: 10 },
  ],
  defaults: { isolatieDikte: 120, stucDikte: 8, hoogte: 2800, basisHoogte: 0 },

  depth(p) { return (num(p, "isolatieDikte") + num(p, "stucDikte")) * MM; },
  color() { return "#d9d1be"; },

  solids(length, p): SolidBox[] {
    const iso = num(p, "isolatieDikte") * MM;
    const stuc = num(p, "stucDikte") * MM;
    const h = num(p, "hoogte") * MM;
    const totaal = iso + stuc;
    let cursor = -totaal / 2;
    const out: SolidBox[] = [];
    for (const laag of [iso, stuc]) {
      out.push({ cx: length / 2, cy: cursor + laag / 2, zBottom: 0, dx: length, dy: laag, dz: h });
      cursor += laag;
    }
    return out;
  },

  psetName: "ETICS",
  psetProps(length, p) {
    return { Type: "ETICS", IsolatieDikte_mm: num(p, "isolatieDikte"), StucDikte_mm: num(p, "stucDikte"), Lengte_mm: Math.round(length / MM), Hoogte_mm: num(p, "hoogte") };
  },

  commonPset(_l, p) {
    return { ThermalTransmittance: Math.max(0.12, 25 / num(p, "isolatieDikte")) };
  },
};
