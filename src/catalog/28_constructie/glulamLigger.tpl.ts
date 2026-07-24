import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";
import { GLULAM_PROFILES, findProfile, profileOptions } from "../_shared/profiles";

const MM = 0.001;

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const glulamLigger: ComponentTemplate = {
  id: "glulam-ligger",
  name: "Glulam-ligger (gelamineerd hout)",
  category: "Hoofddraagconstructie",
  nlSfb: "28.15",
  classification: { system: "NL-SfB", code: "28.15" },
  material: "Hout, gelamineerd (GL24h/GL28c)",
  loadBearing: true,

  placementKind: "linear",
  ifcEntity: "IfcBeam",
  ifcPredefinedType: "BEAM",
  profileSpec: findProfile("Glulam 400x240"),
  profileSpecFor: (p) => findProfile(String(p.profiel)),

  params: [
    { key: "profiel", label: "Profiel", type: "select", options: profileOptions(GLULAM_PROFILES) },
    { key: "sterkteklasse", label: "Sterkteklasse", type: "select",
      options: [{ value: "GL24h", label: "GL24h" }, { value: "GL28c", label: "GL28c" }, { value: "GL32c", label: "GL32c" }] },
    { key: "basisHoogte", label: "Basishoogte", type: "length", min: -5000, max: 20000, step: 10 },
  ],
  defaults: { profiel: "Glulam 400x240", sterkteklasse: "GL24h", basisHoogte: 0 },

  depth(p) {
    const spec = findProfile(String(p.profiel));
    return (spec?.dimensions.YDim ?? 240) * MM;
  },

  color() { return "#a6763a"; },

  solids(length, p): SolidBox[] {
    const spec = findProfile(String(p.profiel));
    const H = (spec?.dimensions.XDim ?? 400) * MM;
    const B = (spec?.dimensions.YDim ?? 240) * MM;
    return [{ cx: length / 2, cy: 0, zBottom: 0, dx: length, dy: B, dz: H }];
  },

  psetName: "Glulam_Ligger",
  psetProps(length, p) {
    return { Type: "Glulam ligger", Profiel: String(p.profiel), Sterkteklasse: String(p.sterkteklasse), Lengte_mm: Math.round(length / MM) };
  },

  commonPset(l) { return { Span: l }; },
};
