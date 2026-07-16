import type { ComponentTemplate, SolidBox } from "../../core/types";

/** IfcSanitaryTerminal — wastafel, wc, urinoir. */
export const sanitaryTerminal: ComponentTemplate = {
  id: "sanitary-terminal",
  name: "Sanitair (wastafel/wc)",
  category: "MEP — Sanitair",
  nlSfb: "53.10",
  material: "Keramiek",
  ifcEntity: "IfcSanitaryTerminal",
  ifcPredefinedType: "WASHHANDBASIN",
  placementKind: "point",
  params: [
    {
      key: "type",
      label: "Type",
      type: "select",
      options: [
        { value: "WASHHANDBASIN", label: "Wastafel" },
        { value: "TOILETPAN", label: "Toilet (WC)" },
        { value: "URINAL", label: "Urinoir" },
        { value: "BATH", label: "Bad" },
        { value: "SHOWER", label: "Douche" },
      ],
    },
    { key: "basisHoogte", label: "Hoogte b.k. vloer", type: "length", min: 0, max: 1200, step: 10 },
  ],
  defaults: { type: "WASHHANDBASIN", basisHoogte: 800 },
  depth: () => 0.45,
  color: () => "#f8fafc",
  solids(_l, p): SolidBox[] {
    const w = p.type === "BATH" ? 1.7 : p.type === "SHOWER" ? 0.9 : 0.6;
    const d = p.type === "BATH" ? 0.7 : p.type === "SHOWER" ? 0.9 : 0.45;
    const h = p.type === "TOILETPAN" ? 0.4 : p.type === "URINAL" ? 0.55 : 0.15;
    return [{ cx: w / 2, cy: 0, zBottom: 0, dx: w, dy: d, dz: h }];
  },
  psetName: "Storax_Sanitary",
  psetProps: (_l, p) => ({ Type: String(p.type ?? "WASHHANDBASIN") }),
};
