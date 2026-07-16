import type { ComponentTemplate, SolidBox } from "../../core/types";
import { MM, num } from "./_helpers";

/** IfcPipeFitting — bocht, T-stuk of verloop in de leiding. */
export const pipeFitting: ComponentTemplate = {
  id: "pipe-fitting",
  name: "Leiding-fitting (bocht/T)",
  category: "MEP — Sanitair/Verwarming",
  nlSfb: "52.13",
  material: "Messing",
  ifcEntity: "IfcPipeFitting",
  ifcPredefinedType: "BEND",
  placementKind: "point",
  params: [
    {
      key: "type",
      label: "Fittingtype",
      type: "select",
      options: [
        { value: "BEND", label: "Bocht" },
        { value: "JUNCTION", label: "T-stuk" },
        { value: "TRANSITION", label: "Verloop" },
        { value: "OBSTRUCTION", label: "Afsluiter" },
      ],
    },
    { key: "diameter", label: "Diameter", type: "length", min: 15, max: 42, step: 1 },
    { key: "basisHoogte", label: "Peil", type: "length", min: -2000, max: 15000, step: 10 },
  ],
  defaults: { type: "BEND", diameter: 22, basisHoogte: 2500 },
  depth: (p) => num(p, "diameter", 22) * MM,
  color: () => "#d4a574",
  solids(_l, p): SolidBox[] {
    const d = num(p, "diameter", 22) * MM;
    return [{ cx: d, cy: 0, zBottom: 0, dx: d * 2, dy: d * 2, dz: d * 2 }];
  },
  psetName: "Storax_PipeFitting",
  psetProps: (_l, p) => ({
    Type: String(p.type ?? "BEND"),
    Diameter_mm: num(p, "diameter", 22),
  }),
};
