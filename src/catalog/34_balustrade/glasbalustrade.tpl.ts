import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";

/** Glasbalustrade met RVS-klemhandregel. */

const MM = 0.001;

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const glasbalustrade: ComponentTemplate = {
  id: "glasbalustrade",
  name: "Glasbalustrade (RVS handregel)",
  category: "Balustrades",
  nlSfb: "34.12",
  classification: { system: "NL-SfB", code: "34.12" },
  material: "Gelaagd glas + RVS",
  loadBearing: false,

  placementKind: "linear",
  ifcEntity: "IfcRailing",
  ifcPredefinedType: "BALUSTRADE",

  params: [
    { key: "hoogte", label: "Balustradehoogte", type: "length", min: 900, max: 1200, step: 10 },
    { key: "glasDikte", label: "Glasdikte (gelaagd)", type: "length", min: 12, max: 25, step: 1 },
    { key: "handregelDiameter", label: "Handregeldiameter", type: "length", min: 40, max: 60, step: 2 },
    { key: "basisHoogte", label: "Peil onderkant", type: "length", min: 0, max: 10000, step: 10 },
  ],
  defaults: { hoogte: 1000, glasDikte: 18, handregelDiameter: 42, basisHoogte: 0 },

  depth(p) { return num(p, "handregelDiameter") * MM; },
  color() { return "#a4c6d0"; },

  solids(length, p): SolidBox[] {
    const h = num(p, "hoogte") * MM;
    const gd = num(p, "glasDikte") * MM;
    const hd = num(p, "handregelDiameter") * MM;
    // Onderprofiel (klemprofiel), glasvlak, handregel
    return [
      { cx: length / 2, cy: 0, zBottom: 0, dx: length, dy: hd, dz: 0.08 },
      { cx: length / 2, cy: 0, zBottom: 0.08, dx: length, dy: gd, dz: h - 0.08 - hd },
      { cx: length / 2, cy: 0, zBottom: h - hd, dx: length, dy: hd, dz: hd },
    ];
  },

  psetName: "Glasbalustrade",
  psetProps(length, p) {
    return { Type: "Glasbalustrade", Hoogte_mm: num(p, "hoogte"), GlasDikte_mm: num(p, "glasDikte"), Lengte_mm: Math.round(length / MM) };
  },

  commonPset(_l, p) {
    return { Height: num(p, "hoogte") / 1000 };
  },
};
