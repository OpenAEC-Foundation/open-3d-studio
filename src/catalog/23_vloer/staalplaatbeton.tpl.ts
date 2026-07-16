import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";

/** Staalplaatbeton (composite deck).
 *  Trapeziumplaat 55/60/70 mm profielhoogte + beton bovenlaag. Semantisch één IfcSlab. */

const MM = 0.001;

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const staalplaatbeton: ComponentTemplate = {
  id: "staalplaatbeton",
  name: "Staalplaatbeton (composite deck)",
  category: "Vloeren",
  nlSfb: "23.14",
  classification: { system: "NL-SfB", code: "23.14" },
  material: "Staal + Beton",
  loadBearing: true,

  placementKind: "surface",
  materialLayers: [
    { material: "Staal, trapeziumplaat", thicknessMm: 1, category: "structure", loadBearing: true },
    { material: "Beton, in-situ", thicknessMm: 90, category: "structure", loadBearing: true },
  ],

  ifcEntity: "IfcSlab",
  ifcPredefinedType: "FLOOR",

  params: [
    { key: "profielHoogte", label: "Profielhoogte trapeziumplaat", type: "select",
      options: [
        { value: "55", label: "55 mm — lichte vloer" },
        { value: "60", label: "60 mm — standaard" },
        { value: "70", label: "70 mm — zware overspanning" },
      ],
    },
    { key: "betonHoogte", label: "Betonhoogte boven top plaat", type: "length", min: 60, max: 150, step: 5 },
    { key: "breedte", label: "Breedte", type: "length", min: 1000, max: 12000, step: 100 },
    { key: "basisHoogte", label: "Peil", type: "length", min: -5000, max: 20000, step: 10 },
  ],
  defaults: { profielHoogte: "60", betonHoogte: 90, breedte: 6000, basisHoogte: 0 },

  depth(p) { return num(p, "breedte") * MM; },
  color() { return "#a2a09c"; },

  solids(length, p): SolidBox[] {
    const b = num(p, "breedte") * MM;
    const staal = (num(p, "profielHoogte")) * MM;
    const beton = num(p, "betonHoogte") * MM;
    return [
      { cx: length / 2, cy: 0, zBottom: 0, dx: length, dy: b, dz: staal },
      { cx: length / 2, cy: 0, zBottom: staal, dx: length, dy: b, dz: beton },
    ];
  },

  psetName: "Staalplaatbeton",
  psetProps(length, p) {
    return { Type: "Composite deck", ProfielHoogte_mm: num(p, "profielHoogte"), BetonHoogte_mm: num(p, "betonHoogte"), Lengte_mm: Math.round(length / MM), Breedte_mm: num(p, "breedte") };
  },

  commonPset() { return { FireRating: "REI60" }; },
};
