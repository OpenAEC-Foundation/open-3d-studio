import type { ComponentTemplate, SolidBox } from "../../core/types";
import { MM, num } from "./_helpers";

/** IfcSpaceHeater — CV-radiator of convector. */
export const spaceHeater: ComponentTemplate = {
  id: "space-heater",
  name: "CV-radiator (paneelradiator)",
  category: "MEP — Verwarming",
  nlSfb: "56.30",
  material: "Staal, gemoffeld",
  ifcEntity: "IfcSpaceHeater",
  ifcPredefinedType: "RADIATOR",
  placementKind: "linear",
  params: [
    {
      key: "type",
      label: "Type",
      type: "select",
      options: [
        { value: "T22", label: "Type 22 (2 paneel + 2 lamel)" },
        { value: "T33", label: "Type 33 (3 paneel + 3 lamel)" },
        { value: "T11", label: "Type 11 (1 paneel + 1 lamel)" },
      ],
    },
    { key: "hoogte", label: "Hoogte", type: "length", min: 300, max: 900, step: 10 },
    { key: "basisHoogte", label: "Peil onderkant", type: "length", min: 0, max: 3000, step: 10 },
  ],
  defaults: { type: "T22", hoogte: 600, basisHoogte: 150 },
  depth: (p) => (p.type === "T33" ? 155 : p.type === "T11" ? 65 : 100) * MM,
  color: () => "#f8fafc",
  solids(length, p): SolidBox[] {
    const d = (p.type === "T33" ? 155 : p.type === "T11" ? 65 : 100) * MM;
    const h = num(p, "hoogte", 600) * MM;
    return [{ cx: length / 2, cy: 0, zBottom: 0, dx: length, dy: d, dz: h }];
  },
  psetName: "Storax_SpaceHeater",
  psetProps: (length, p) => ({
    Type: String(p.type ?? "T22"),
    Hoogte_mm: num(p, "hoogte", 600),
    Lengte_mm: Math.round(length * 1000),
    Vermogen_W_bij_dt50: Math.round(length * 1200), // ruwe indicatie
  }),
};
