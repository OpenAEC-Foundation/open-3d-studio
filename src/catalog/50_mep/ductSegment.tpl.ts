import type { ComponentTemplate, SolidBox } from "../../core/types";
import { MM, num } from "./_helpers";

/** IfcDuctSegment — rechthoekig ventilatiekanaal (spirobuis komt in v0.7). */
export const ductSegment: ComponentTemplate = {
  id: "duct-segment",
  name: "Ventilatiekanaal (rechthoekig)",
  category: "MEP — Ventilatie",
  nlSfb: "57.20",
  material: "Staal, verzinkt",
  ifcEntity: "IfcDuctSegment",
  ifcPredefinedType: "RIGIDSEGMENT",
  placementKind: "linear",
  params: [
    { key: "breedte", label: "Breedte", type: "length", min: 100, max: 600, step: 10 },
    { key: "hoogte", label: "Hoogte", type: "length", min: 100, max: 400, step: 10 },
    { key: "basisHoogte", label: "Peil", type: "length", min: 0, max: 15000, step: 10 },
  ],
  defaults: { breedte: 300, hoogte: 150, basisHoogte: 2800 },
  depth: (p) => num(p, "breedte", 300) * MM,
  color: () => "#94a3b8",
  solids(length, p): SolidBox[] {
    const b = num(p, "breedte", 300) * MM;
    const h = num(p, "hoogte", 150) * MM;
    return [{ cx: length / 2, cy: 0, zBottom: 0, dx: length, dy: b, dz: h }];
  },
  psetName: "Storax_Duct",
  psetProps: (length, p) => ({
    Breedte_mm: num(p, "breedte", 300),
    Hoogte_mm: num(p, "hoogte", 150),
    Lengte_mm: Math.round(length * 1000),
    Debiet_indicatief_m3h: Math.round(num(p, "breedte", 300) * num(p, "hoogte", 150) * 0.02),
  }),
};
