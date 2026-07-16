import type { ComponentTemplate, SolidBox } from "../../core/types";
import { MM, num } from "./_helpers";

/** IfcCableCarrierSegment — kabelgoot voor de installatietechniek. */
export const cableCarrier: ComponentTemplate = {
  id: "cable-carrier",
  name: "Kabelgoot",
  category: "MEP — Elektra",
  nlSfb: "63.15",
  material: "Staal, verzinkt",
  ifcEntity: "IfcCableCarrierSegment",
  ifcPredefinedType: "CABLETRAYSEGMENT",
  placementKind: "linear",
  params: [
    { key: "breedte", label: "Breedte", type: "length", min: 100, max: 600, step: 10 },
    { key: "hoogte", label: "Hoogte", type: "length", min: 40, max: 150, step: 5 },
    { key: "basisHoogte", label: "Peil", type: "length", min: 0, max: 15000, step: 10 },
  ],
  defaults: { breedte: 300, hoogte: 60, basisHoogte: 2900 },
  depth: (p) => num(p, "breedte", 300) * MM,
  color: () => "#475569",
  solids(length, p): SolidBox[] {
    const b = num(p, "breedte", 300) * MM;
    const h = num(p, "hoogte", 60) * MM;
    return [{ cx: length / 2, cy: 0, zBottom: 0, dx: length, dy: b, dz: h }];
  },
  psetName: "Storax_CableCarrier",
  psetProps: (length, p) => ({
    Breedte_mm: num(p, "breedte", 300),
    Hoogte_mm: num(p, "hoogte", 60),
    Lengte_mm: Math.round(length * 1000),
  }),
};
