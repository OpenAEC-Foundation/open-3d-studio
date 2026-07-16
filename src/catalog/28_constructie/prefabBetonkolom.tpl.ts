import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";
import { CONCRETE_PROFILES, findProfile, profileOptions } from "../_shared/profiles";

const MM = 0.001;

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const prefabBetonkolom: ComponentTemplate = {
  id: "prefab-betonkolom",
  name: "Prefab betonkolom (rechthoek/rond)",
  category: "Hoofddraagconstructie",
  nlSfb: "28.12",
  classification: { system: "NL-SfB", code: "28.12" },
  material: "Beton, prefab C50/60",
  loadBearing: true,

  placementKind: "linear",
  ifcEntity: "IfcColumn",
  ifcPredefinedType: "COLUMN",
  profileSpec: findProfile("Beton 300x300"),

  params: [
    { key: "profiel", label: "Profiel", type: "select", options: profileOptions(CONCRETE_PROFILES) },
    { key: "hoogte", label: "Kolomhoogte", type: "length", min: 2400, max: 8000, step: 50 },
    { key: "sterkte", label: "Betonsterkte", type: "select",
      options: [{ value: "C30/37", label: "C30/37" }, { value: "C45/55", label: "C45/55" }, { value: "C50/60", label: "C50/60" }] },
    { key: "basisHoogte", label: "Basishoogte", type: "length", min: -5000, max: 20000, step: 10 },
  ],
  defaults: { profiel: "Beton 300x300", hoogte: 2800, sterkte: "C50/60", basisHoogte: 0 },

  depth(p) {
    const spec = findProfile(String(p.profiel));
    if (!spec) return 0.3;
    return (spec.shape === "Circle" ? (spec.dimensions.Radius ?? 200) * 2 : spec.dimensions.YDim ?? 300) * MM;
  },

  color() { return "#a5a09a"; },

  solids(_length, p): SolidBox[] {
    const spec = findProfile(String(p.profiel));
    const h = num(p, "hoogte") * MM;
    const dx = spec ? (spec.shape === "Circle" ? (spec.dimensions.Radius ?? 200) * 2 : spec.dimensions.XDim ?? 300) * MM : 0.3;
    const dy = spec ? (spec.shape === "Circle" ? (spec.dimensions.Radius ?? 200) * 2 : spec.dimensions.YDim ?? 300) * MM : 0.3;
    return [{ cx: 0, cy: 0, zBottom: 0, dx, dy, dz: h }];
  },

  psetName: "Prefab_Betonkolom",
  psetProps(_l, p) {
    return { Type: "Prefab betonkolom", Profiel: String(p.profiel), Sterkteklasse: String(p.sterkte), Hoogte_mm: num(p, "hoogte") };
  },
};
