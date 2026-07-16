import type { ComponentTemplate, SolidBox } from "../../core/types";
import { MM, num } from "./_helpers";

/** IfcPipeSegment — koperen of kunststof leiding, ronde doorsnede.
 *  Rendering: rechthoek met dz = diameter (approx.), later te vervangen door
 *  echte cirkel-extrusie. Voor IFC-export is IfcPipeSegment.RIGIDSEGMENT genoeg. */
export const pipeSegment: ComponentTemplate = {
  id: "pipe-segment",
  name: "Leiding (koper/kunststof)",
  category: "MEP — Sanitair/Verwarming",
  nlSfb: "52.10",
  material: "Koper",
  ifcEntity: "IfcPipeSegment",
  ifcPredefinedType: "RIGIDSEGMENT",
  placementKind: "linear",
  params: [
    {
      key: "diameter",
      label: "Diameter",
      type: "select",
      options: [
        { value: "15", label: "15 mm — koud/warm water" },
        { value: "22", label: "22 mm — verdeler" },
        { value: "28", label: "28 mm — hoofdleiding" },
        { value: "42", label: "42 mm — CV-hoofdleiding" },
      ],
    },
    { key: "basisHoogte", label: "Peil", type: "length", min: -2000, max: 15000, step: 10 },
  ],
  defaults: { diameter: "22", basisHoogte: 2500 },
  depth: (p) => num(p, "diameter", 22) * MM,
  color: () => "#c8873d",
  solids(length, p): SolidBox[] {
    const d = num(p, "diameter", 22) * MM;
    return [{ cx: length / 2, cy: 0, zBottom: 0, dx: length, dy: d, dz: d }];
  },
  psetName: "Storax_Pipe",
  psetProps: (length, p) => ({
    Diameter_mm: num(p, "diameter", 22),
    Lengte_mm: Math.round(length * 1000),
    Materiaal: "Koper (default)",
  }),
};
