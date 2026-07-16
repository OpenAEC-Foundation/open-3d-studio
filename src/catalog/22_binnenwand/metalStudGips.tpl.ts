import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";

/** Metal-stud gipswand: metaalstijl 70/100 mm + gipsplaat 12,5 mm aan beide kanten. */

const MM = 0.001;
const STUD: Record<string, number> = { "70": 70, "100": 100 };

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const metalStudGips: ComponentTemplate = {
  id: "metal-stud-gips",
  name: "Metal-stud gipswand",
  category: "Binnenwanden",
  nlSfb: "22.13",
  classification: { system: "NL-SfB", code: "22.13" },
  material: "Staal + minerale wol + gipsplaat",
  loadBearing: false,

  placementKind: "linear",
  materialLayers: [
    { material: "Gipsplaat", thicknessMm: 12.5, category: "finish" },
    { material: "Staal, stijlwerk + minerale wol", thicknessMm: 70, category: "structure" },
    { material: "Gipsplaat", thicknessMm: 12.5, category: "finish" },
  ],

  ifcEntity: "IfcWall",
  ifcPredefinedType: "PARTITIONING",

  params: [
    { key: "studBreedte", label: "Studbreedte", type: "select",
      options: [{ value: "70", label: "70 mm" }, { value: "100", label: "100 mm" }] },
    { key: "hoogte", label: "Wandhoogte", type: "length", min: 2400, max: 4500, step: 10 },
    { key: "fireRating", label: "Brandwerendheid (min)", type: "select",
      options: [{ value: "0", label: "Geen eis" }, { value: "30", label: "30" }, { value: "60", label: "60" }, { value: "90", label: "90" }] },
    { key: "basisHoogte", label: "Peil", type: "length", min: -5000, max: 20000, step: 10 },
  ],
  defaults: { studBreedte: "70", hoogte: 2700, fireRating: "30", basisHoogte: 0 },

  depth(p) { return ((STUD[String(p.studBreedte)] ?? 70) + 25) * MM; },
  color() { return "#eeece5"; },

  solids(length, p): SolidBox[] {
    const stud = (STUD[String(p.studBreedte)] ?? 70) * MM;
    const gips = 0.0125;
    const h = num(p, "hoogte") * MM;
    const totaal = stud + 2 * gips;
    let cursor = -totaal / 2;
    const out: SolidBox[] = [];
    for (const laag of [gips, stud, gips]) {
      out.push({ cx: length / 2, cy: cursor + laag / 2, zBottom: 0, dx: length, dy: laag, dz: h });
      cursor += laag;
    }
    return out;
  },

  psetName: "MetalStud_Gips",
  psetProps(length, p) {
    return { Type: "Metal-stud gipswand", StudBreedte_mm: STUD[String(p.studBreedte)] ?? 70, Lengte_mm: Math.round(length / MM), Hoogte_mm: num(p, "hoogte"), BrandwerendheidREI_min: num(p, "fireRating") };
  },

  commonPset(_l, p) {
    const fr = num(p, "fireRating");
    return { FireRating: fr > 0 ? `EI${fr}` : "", AcousticRating: p.studBreedte === "100" ? "40 dB" : "35 dB" };
  },
};
