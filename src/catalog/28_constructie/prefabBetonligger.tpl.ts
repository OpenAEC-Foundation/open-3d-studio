import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";
import { CONCRETE_PROFILES, findProfile, profileOptions } from "../_shared/profiles";

const MM = 0.001;

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const prefabBetonligger: ComponentTemplate = {
  id: "prefab-betonligger",
  name: "Prefab betonligger",
  category: "Hoofddraagconstructie",
  nlSfb: "28.13",
  classification: { system: "NL-SfB", code: "28.13" },
  material: "Beton, prefab C50/60",
  loadBearing: true,

  placementKind: "linear",
  ifcEntity: "IfcBeam",
  ifcPredefinedType: "BEAM",
  profileSpec: findProfile("Beton 400x300"),

  params: [
    { key: "profiel", label: "Profiel", type: "select",
      options: profileOptions(CONCRETE_PROFILES.filter((p) => p.shape === "Rectangle")) },
    { key: "sterkte", label: "Betonsterkte", type: "select",
      options: [{ value: "C30/37", label: "C30/37" }, { value: "C45/55", label: "C45/55" }, { value: "C50/60", label: "C50/60" }] },
    { key: "basisHoogte", label: "Basishoogte", type: "length", min: -5000, max: 20000, step: 10 },
  ],
  defaults: { profiel: "Beton 400x300", sterkte: "C50/60", basisHoogte: 0 },

  depth(p) {
    const spec = findProfile(String(p.profiel));
    return (spec?.dimensions.YDim ?? 300) * MM;
  },

  color() { return "#a29b91"; },

  solids(length, p): SolidBox[] {
    const spec = findProfile(String(p.profiel));
    const dx = length;
    const H = (spec?.dimensions.XDim ?? 400) * MM;
    const B = (spec?.dimensions.YDim ?? 300) * MM;
    return [{ cx: length / 2, cy: 0, zBottom: 0, dx, dy: B, dz: H }];
  },

  psetName: "Prefab_Betonligger",
  psetProps(length, p) {
    return { Type: "Prefab betonligger", Profiel: String(p.profiel), Sterkteklasse: String(p.sterkte), Lengte_mm: Math.round(length / MM) };
  },

  commonPset(l) { return { Span: l }; },
};
