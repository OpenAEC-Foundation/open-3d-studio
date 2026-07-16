import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";

/** Velux dakraam MK06 (78×118 cm) — later meer maten via profielCatalogus. */

const MM = 0.001;

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const dakraamVelux: ComponentTemplate = {
  id: "dakraam-velux",
  name: "Dakraam Velux MK06",
  category: "Buitenkozijnen",
  manufacturer: "Velux",
  nlSfb: "31.31",
  classification: { system: "NL-SfB", code: "31.31" },
  material: "Aluminium + gelakt hout, HR-glas",
  loadBearing: false,
  isExternal: true,

  placementKind: "linear",
  ifcEntity: "IfcWindow",
  ifcPredefinedType: "SKYLIGHT",

  params: [
    { key: "maat", label: "Maat", type: "select",
      options: [
        { value: "CK04", label: "CK04 — 550×980" },
        { value: "MK06", label: "MK06 — 780×1180" },
        { value: "PK06", label: "PK06 — 940×1180" },
        { value: "SK06", label: "SK06 — 1140×1180" },
      ] },
    { key: "basisHoogte", label: "Dakhelling-offset", type: "length", min: 0, max: 5000, step: 10 },
  ],
  defaults: { maat: "MK06", basisHoogte: 0 },

  depth() { return 0.12; },
  color() { return "#7a828b"; },

  solids(_l, p): SolidBox[] {
    const map: Record<string, [number, number]> = { CK04: [550, 980], MK06: [780, 1180], PK06: [940, 1180], SK06: [1140, 1180] };
    const [w, h] = map[String(p.maat)] ?? [780, 1180];
    const b = w * MM;
    const H = h * MM;
    return [{ cx: b / 2, cy: 0, zBottom: 0, dx: b, dy: 0.12, dz: H }];
  },

  psetName: "Velux_Dakraam",
  psetProps(_l, p) {
    return { Fabrikant: "Velux", Type: String(p.maat) };
  },

  commonPset() { return { ThermalTransmittance: 1.0 }; },
};
