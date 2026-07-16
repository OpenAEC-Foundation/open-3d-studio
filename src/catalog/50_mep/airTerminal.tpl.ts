import type { ComponentTemplate, SolidBox } from "../../core/types";
import { MM, num } from "./_helpers";

/** IfcAirTerminal — plafondrooster of muurdiffusor. */
export const airTerminal: ComponentTemplate = {
  id: "air-terminal",
  name: "Ventilatierooster/diffusor",
  category: "MEP — Ventilatie",
  nlSfb: "57.44",
  material: "Aluminium",
  ifcEntity: "IfcAirTerminal",
  ifcPredefinedType: "DIFFUSER",
  placementKind: "point",
  params: [
    {
      key: "type",
      label: "Type",
      type: "select",
      options: [
        { value: "DIFFUSER", label: "Diffusor (plafond)" },
        { value: "GRILLE", label: "Rooster (muur)" },
        { value: "LOUVRE", label: "Louvre" },
      ],
    },
    { key: "afmeting", label: "Afmeting", type: "length", min: 100, max: 600, step: 10 },
    { key: "basisHoogte", label: "Peil", type: "length", min: 0, max: 15000, step: 10 },
  ],
  defaults: { type: "DIFFUSER", afmeting: 300, basisHoogte: 2700 },
  depth: (p) => num(p, "afmeting", 300) * MM,
  color: () => "#e2e8f0",
  solids(_l, p): SolidBox[] {
    const s = num(p, "afmeting", 300) * MM;
    return [{ cx: s / 2, cy: 0, zBottom: 0, dx: s, dy: s, dz: 0.04 }];
  },
  psetName: "Storax_AirTerminal",
  psetProps: (_l, p) => ({
    Type: String(p.type ?? "DIFFUSER"),
    Afmeting_mm: num(p, "afmeting", 300),
    Debiet_m3h: 120,
  }),
};
