import type { ComponentTemplate, SolidBox } from "../../core/types";
import { MM, num } from "./_helpers";

/** IfcCableSegment — elektra-kabel, ronde doorsnede via IfcCableSegment. */
export const cableSegment: ComponentTemplate = {
  id: "cable-segment",
  name: "Elektrakabel",
  category: "MEP — Elektra",
  nlSfb: "63.10",
  material: "Koper met PVC-mantel",
  ifcEntity: "IfcCableSegment",
  ifcPredefinedType: "CABLESEGMENT",
  placementKind: "linear",
  params: [
    {
      key: "type",
      label: "Kabeltype",
      type: "select",
      options: [
        { value: "vd", label: "VD 2.5 mm² (installatiedraad)" },
        { value: "xmvk", label: "XMvK 3G2.5 (grondkabel)" },
        { value: "ymvk", label: "YMvK 5x2.5 (krachtstroom)" },
        { value: "utp", label: "UTP CAT6 (data)" },
      ],
    },
    { key: "basisHoogte", label: "Peil", type: "length", min: -2000, max: 15000, step: 10 },
  ],
  defaults: { type: "vd", basisHoogte: 2800 },
  depth: () => 0.008,
  color: () => "#0f172a",
  solids(length): SolidBox[] {
    return [{ cx: length / 2, cy: 0, zBottom: 0, dx: length, dy: 0.008, dz: 0.008 }];
  },
  psetName: "Storax_Cable",
  psetProps: (length, p) => ({
    Kabeltype: String(p.type ?? "vd"),
    Lengte_mm: Math.round(length * 1000),
  }),
};
