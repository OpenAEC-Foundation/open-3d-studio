import type { ComponentTemplate, SolidBox } from "../../core/types";
import { MM, num } from "./_helpers";

/** IfcDuctFitting — vertakking/bocht in ventilatiekanaal. */
export const ductFitting: ComponentTemplate = {
  id: "duct-fitting",
  name: "Ventilatie-fitting (bocht/T)",
  category: "MEP — Ventilatie",
  nlSfb: "57.23",
  material: "Staal, verzinkt",
  ifcEntity: "IfcDuctFitting",
  ifcPredefinedType: "BEND",
  placementKind: "point",
  params: [
    {
      key: "type",
      label: "Fittingtype",
      type: "select",
      options: [
        { value: "BEND", label: "Bocht 90°" },
        { value: "JUNCTION", label: "T-stuk" },
        { value: "TRANSITION", label: "Verloop" },
      ],
    },
    { key: "breedte", label: "Breedte", type: "length", min: 100, max: 600, step: 10 },
    { key: "hoogte", label: "Hoogte", type: "length", min: 100, max: 400, step: 10 },
    { key: "basisHoogte", label: "Peil", type: "length", min: 0, max: 15000, step: 10 },
  ],
  defaults: { type: "BEND", breedte: 300, hoogte: 150, basisHoogte: 2800 },
  depth: (p) => num(p, "breedte", 300) * MM,
  color: () => "#64748b",
  solids(_l, p): SolidBox[] {
    const b = num(p, "breedte", 300) * MM;
    const h = num(p, "hoogte", 150) * MM;
    return [{ cx: b, cy: 0, zBottom: 0, dx: b * 2, dy: b, dz: h }];
  },
  psetName: "Storax_DuctFitting",
  psetProps: (_l, p) => ({
    Type: String(p.type ?? "BEND"),
    Breedte_mm: num(p, "breedte", 300),
    Hoogte_mm: num(p, "hoogte", 150),
  }),
};
