import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";

/** Ytong cellenbetonwand (Xella). Isolerend, niet-dragend of licht dragend. */

const MM = 0.001;
const DIKTES: Record<string, number> = { "70": 70, "100": 100, "150": 150 };

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const ytongCellenbeton: ComponentTemplate = {
  id: "xella-ytong-cellenbeton",
  name: "Ytong cellenbetonwand",
  category: "Binnenwanden",
  manufacturer: "Xella",
  nlSfb: "22.12",
  classification: { system: "NL-SfB", code: "22.12" },
  material: "Cellenbeton (Ytong)",
  loadBearing: false,
  isExternal: false,

  placementKind: "linear",
  materialLayers: [{ material: "Cellenbeton (Ytong)", thicknessMm: 100, category: "structure", lambda: 0.11 }],

  ifcEntity: "IfcWall",
  ifcPredefinedType: "PARTITIONING",

  params: [
    { key: "dikte", label: "Wanddikte", type: "select",
      options: [{ value: "70", label: "70 mm" }, { value: "100", label: "100 mm" }, { value: "150", label: "150 mm" }] },
    { key: "hoogte", label: "Wandhoogte", type: "length", min: 2400, max: 4500, step: 10 },
    { key: "basisHoogte", label: "Peil", type: "length", min: -5000, max: 20000, step: 10 },
  ],
  defaults: { dikte: "100", hoogte: 2600, basisHoogte: 0 },

  depth(p) { return (DIKTES[String(p.dikte)] ?? 100) * MM; },
  color() { return "#f0eadd"; },

  solids(length, p): SolidBox[] {
    const d = (DIKTES[String(p.dikte)] ?? 100) * MM;
    const h = num(p, "hoogte") * MM;
    return [{ cx: length / 2, cy: 0, zBottom: 0, dx: length, dy: d, dz: h }];
  },

  psetName: "Xella_Ytong",
  psetProps(length, p) {
    return { Fabrikant: "Xella", Product: "Ytong cellenbeton", Dikte_mm: DIKTES[String(p.dikte)] ?? 100, Lengte_mm: Math.round(length / MM), Hoogte_mm: num(p, "hoogte") };
  },
};
