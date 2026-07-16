import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";

/** HSB-vloer: I-liggers 45×220 hoh 400/600 + OSB 22 + dekvloer 60. */

const MM = 0.001;

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const hsbVloer: ComponentTemplate = {
  id: "hsb-vloer",
  name: "HSB-vloer (I-liggers + OSB + dekvloer)",
  category: "Vloeren",
  nlSfb: "23.13",
  classification: { system: "NL-SfB", code: "23.13" },
  material: "Hout, gelamineerd + OSB + dekvloer",
  loadBearing: true,

  placementKind: "surface",
  materialLayers: [
    { material: "OSB-plaat 22 mm", thicknessMm: 22, category: "structure" },
    { material: "HSB I-ligger 220 mm", thicknessMm: 220, category: "structure", loadBearing: true },
    { material: "Vloerdekvloer 60 mm", thicknessMm: 60, category: "finish" },
  ],

  ifcEntity: "IfcSlab",
  ifcPredefinedType: "FLOOR",

  params: [
    { key: "hoh", label: "Hart-op-hart liggers", type: "length", min: 300, max: 800, step: 50 },
    { key: "liggerHoogte", label: "Liggerhoogte", type: "length", min: 180, max: 400, step: 20 },
    { key: "breedte", label: "Vloerbreedte", type: "length", min: 1000, max: 12000, step: 100 },
    { key: "basisHoogte", label: "Peil", type: "length", min: -5000, max: 20000, step: 10 },
  ],
  defaults: { hoh: 600, liggerHoogte: 220, breedte: 6000, basisHoogte: 0 },

  depth(p) { return num(p, "breedte") * MM; },
  color() { return "#c9a76b"; },

  solids(length, p): SolidBox[] {
    const b = num(p, "breedte") * MM;
    const lh = num(p, "liggerHoogte") * MM;
    const osb = 0.022;
    const dek = 0.060;
    return [
      // Onderin: OSB-plaat op volle vloerlengte × breedte
      { cx: length / 2, cy: 0, zBottom: 0, dx: length, dy: b, dz: osb },
      // Midden: één representatief liggerpakket (visuele vereenvoudiging)
      { cx: length / 2, cy: 0, zBottom: osb, dx: length, dy: b, dz: lh },
      // Boven: dekvloer
      { cx: length / 2, cy: 0, zBottom: osb + lh, dx: length, dy: b, dz: dek },
    ];
  },

  psetName: "HSB_Vloer",
  psetProps(length, p) {
    return { Type: "HSB-vloer", HoH_mm: num(p, "hoh"), LiggerHoogte_mm: num(p, "liggerHoogte"), Lengte_mm: Math.round(length / MM), Breedte_mm: num(p, "breedte") };
  },
};
