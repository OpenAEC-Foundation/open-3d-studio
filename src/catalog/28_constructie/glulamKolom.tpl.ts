import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";
import { GLULAM_PROFILES, findProfile, profileOptions } from "../_shared/profiles";

const MM = 0.001;

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const glulamKolom: ComponentTemplate = {
  id: "glulam-kolom",
  name: "Glulam-kolom (gelamineerd hout)",
  category: "Hoofddraagconstructie",
  nlSfb: "28.14",
  classification: { system: "NL-SfB", code: "28.14" },
  material: "Hout, gelamineerd (GL24h/GL28c)",
  loadBearing: true,

  placementKind: "linear",
  ifcEntity: "IfcColumn",
  ifcPredefinedType: "COLUMN",
  profileSpec: findProfile("Glulam 240x180"),
  profileSpecFor: (p) => findProfile(String(p.profiel)),

  params: [
    { key: "profiel", label: "Profiel", type: "select", options: profileOptions(GLULAM_PROFILES) },
    { key: "sterkteklasse", label: "Sterkteklasse", type: "select",
      options: [{ value: "GL24h", label: "GL24h — homogeen" }, { value: "GL28c", label: "GL28c — combi" }, { value: "GL32c", label: "GL32c" }] },
    { key: "hoogte", label: "Kolomhoogte", type: "length", min: 2400, max: 8000, step: 50 },
    { key: "basisHoogte", label: "Basishoogte", type: "length", min: -5000, max: 20000, step: 10 },
  ],
  defaults: { profiel: "Glulam 240x180", sterkteklasse: "GL24h", hoogte: 2800, basisHoogte: 0 },

  depth(p) {
    const spec = findProfile(String(p.profiel));
    return (spec?.dimensions.YDim ?? 180) * MM;
  },

  color() { return "#a6763a"; },

  solids(_length, p): SolidBox[] {
    const spec = findProfile(String(p.profiel));
    const dx = (spec?.dimensions.XDim ?? 240) * MM;
    const dy = (spec?.dimensions.YDim ?? 180) * MM;
    const h = num(p, "hoogte") * MM;
    return [{ cx: 0, cy: 0, zBottom: 0, dx, dy, dz: h }];
  },

  psetName: "Glulam_Kolom",
  psetProps(_l, p) {
    return { Type: "Glulam kolom", Profiel: String(p.profiel), Sterkteklasse: String(p.sterkteklasse), Hoogte_mm: num(p, "hoogte") };
  },
};
