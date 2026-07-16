import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";

/** VBI kanaalplaatvloer (Prefab beton, dragend).
 *
 *  Dikte-reeks: 150/200/260/320/400 mm — de standaard VBI-catalogus die ook door
 *  Xella en digiGO in de ILS v1.0-referentie wordt gebruikt. Templates staan model
 *  voor `placementKind: "surface"` in v0.4-S2: één laag beton, één lineair segment
 *  met een `breedte`-parameter (polygonaal contour volgt in Sprint 8). */

const MM = 0.001;
const DIKTES: Record<string, number> = { "150": 150, "200": 200, "260": 260, "320": 320, "400": 400 };

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const vbiKanaalplaat: ComponentTemplate = {
  id: "vbi-kanaalplaat",
  name: "VBI kanaalplaatvloer",
  category: "Vloeren",
  manufacturer: "VBI",
  nlSfb: "23.11",
  classification: { system: "NL-SfB", code: "23.11" },
  material: "Beton, prefab",
  loadBearing: true,
  isExternal: false,

  placementKind: "surface",
  materialLayers: [{ material: "Beton, prefab", thicknessMm: 200, category: "structure", loadBearing: true }],

  ifcEntity: "IfcSlab",
  ifcPredefinedType: "FLOOR",

  params: [
    { key: "dikte", label: "Vloerdikte", type: "select",
      options: [
        { value: "150", label: "150 mm" },
        { value: "200", label: "200 mm" },
        { value: "260", label: "260 mm — leidingvloer" },
        { value: "320", label: "320 mm — appartementenvloer" },
        { value: "400", label: "400 mm — zware overspanning" },
      ],
    },
    { key: "breedte", label: "Vloerbreedte", type: "length", min: 1000, max: 12000, step: 100 },
    { key: "basisHoogte", label: "Peil (b.k. vloer)", type: "length", min: -5000, max: 20000, step: 10 },
  ],

  defaults: { dikte: "200", breedte: 6000, basisHoogte: 0 },

  depth(p) { return num(p, "breedte") * MM; },

  color() { return "#b3aca0"; },

  solids(length, p): SolidBox[] {
    const dikte = (DIKTES[String(p.dikte)] ?? 200) * MM;
    const breedte = num(p, "breedte") * MM;
    return [{ cx: length / 2, cy: 0, zBottom: 0, dx: length, dy: breedte, dz: dikte }];
  },

  psetName: "VBI_Kanaalplaat",
  psetProps(length, p) {
    return {
      Fabrikant: "VBI",
      Product: "Kanaalplaatvloer",
      Dikte_mm: DIKTES[String(p.dikte)] ?? 200,
      Lengte_mm: Math.round(length / MM),
      Breedte_mm: num(p, "breedte"),
    };
  },

  commonPset(_l, p) {
    return { FireRating: "REI60", AcousticRating: p.dikte === "320" ? "Lu > 60 dB" : "Lu > 55 dB" };
  },
};
