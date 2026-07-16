import type { ComponentTemplate, SolidBox } from "../../core/types";
import { MM, num } from "./_helpers";

/** IfcLightFixture — LED-plafondarmatuur (spot/paneel). */
export const lightFixture: ComponentTemplate = {
  id: "light-fixture",
  name: "LED-armatuur (plafond)",
  category: "MEP — Verlichting",
  nlSfb: "63.60",
  material: "Aluminium + LED",
  ifcEntity: "IfcLightFixture",
  ifcPredefinedType: "DIRECTIONSOURCE",
  placementKind: "point",
  params: [
    {
      key: "type",
      label: "Type",
      type: "select",
      options: [
        { value: "spot", label: "Inbouwspot Ø90 mm" },
        { value: "paneel", label: "Paneelarmatuur 600×600" },
        { value: "lijn", label: "Lijnarmatuur 1200 mm" },
      ],
    },
    { key: "vermogen", label: "Vermogen (W)", type: "length", min: 3, max: 60, step: 1 },
    { key: "basisHoogte", label: "Peil onderkant", type: "length", min: 0, max: 5000, step: 10 },
  ],
  defaults: { type: "paneel", vermogen: 36, basisHoogte: 2700 },
  depth: (p) => (p.type === "lijn" ? 100 : p.type === "spot" ? 90 : 600) * MM,
  color: () => "#fbbf24",
  solids(_l, p): SolidBox[] {
    if (p.type === "paneel")
      return [{ cx: 0.3, cy: 0, zBottom: 0, dx: 0.6, dy: 0.6, dz: 0.02 }];
    if (p.type === "lijn")
      return [{ cx: 0.6, cy: 0, zBottom: 0, dx: 1.2, dy: 0.1, dz: 0.06 }];
    return [{ cx: 0.045, cy: 0, zBottom: 0, dx: 0.09, dy: 0.09, dz: 0.06 }];
  },
  psetName: "Storax_LightFixture",
  psetProps: (_l, p) => ({
    Type: String(p.type ?? "paneel"),
    Vermogen_W: num(p, "vermogen", 36),
    LichtStroom_lm: num(p, "vermogen", 36) * 110, // ~110 lm/W LED
  }),
};
