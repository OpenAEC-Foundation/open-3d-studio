import type { ComponentTemplate, SolidBox } from "../../core/types";
import { MM } from "./_helpers";

/** IfcOutlet — stopcontact / data-aansluiting / audiovisueel. */
export const outlet: ComponentTemplate = {
  id: "outlet",
  name: "Stopcontact / data-aansluiting",
  category: "MEP — Elektra",
  nlSfb: "63.42",
  material: "Kunststof",
  ifcEntity: "IfcOutlet",
  ifcPredefinedType: "AUDIOVISUALOUTLET",
  placementKind: "point",
  params: [
    {
      key: "type",
      label: "Type",
      type: "select",
      options: [
        { value: "AUDIOVISUALOUTLET", label: "Data (CAT6)" },
        { value: "DATAOUTLET", label: "Data (glasvezel)" },
        { value: "COMMUNICATIONSOUTLET", label: "Communicatie (RJ12)" },
        { value: "POWEROUTLET", label: "Stopcontact (230 V)" },
      ],
    },
    { key: "basisHoogte", label: "Hoogte b.k. vloer", type: "length", min: 100, max: 1500, step: 10 },
  ],
  defaults: { type: "POWEROUTLET", basisHoogte: 300 },
  depth: () => 0.05,
  color: () => "#f1f5f9",
  solids(): SolidBox[] {
    return [{ cx: 0.04, cy: 0, zBottom: 0, dx: 0.08, dy: 0.05, dz: 0.08 }];
  },
  psetName: "Storax_Outlet",
  psetProps: (_l, p) => ({ Type: String(p.type ?? "POWEROUTLET") }),
};
