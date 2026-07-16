import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";

/** Kalkzandsteen-lijmwand Silka (Xella).
 *
 *  Eerste template in het v0.4-formaat: gebruikt `placementKind`, `materialLayers` en
 *  `ifcPredefinedType`. Vervangt het monolithische SolidBox-vlak door één laag met
 *  parametrische dikte (100/120/150/214 mm). De solids-functie geeft nog steeds een
 *  enkelvoudig blok terug — de MaterialLayers zijn semantisch (voor export en hatching);
 *  meerlaagse opbouw (spouwmuur) volgt in Sprint 3. */

const MM = 0.001;

const DIKTES: Record<string, number> = {
  "100": 100,
  "120": 120,
  "150": 150,
  "214": 214,
};

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const kzsSilkaLijmwand: ComponentTemplate = {
  id: "xella-silka-lijmwand",
  name: "Silka lijmwand (KZS, dragend)",
  category: "Binnenwanden",
  manufacturer: "Xella",
  nlSfb: "22.11",
  classification: {
    system: "NL-SfB",
    code: "22.11",
  },
  material: "Kalkzandsteen (Silka)",
  loadBearing: true,
  isExternal: false,

  placementKind: "linear",
  materialLayers: [
    {
      material: "Kalkzandsteen (Silka)",
      thicknessMm: 100,
      category: "structure",
      loadBearing: true,
      lambda: 1.0,
    },
  ],

  ifcEntity: "IfcWall",
  ifcPredefinedType: "SOLIDWALL",

  params: [
    {
      key: "dikte",
      label: "Wanddikte",
      type: "select",
      options: [
        { value: "100", label: "100 mm — CS12" },
        { value: "120", label: "120 mm — CS12" },
        { value: "150", label: "150 mm — CS20" },
        { value: "214", label: "214 mm — CS28" },
      ],
    },
    { key: "hoogte", label: "Wandhoogte", type: "length", min: 2400, max: 4500, step: 10 },
    { key: "basisHoogte", label: "Basishoogte (peil)", type: "length", min: -5000, max: 20000, step: 10 },
    { key: "fireRating", label: "Brandwerendheid (minuten)", type: "select",
      options: [
        { value: "0", label: "Geen eis" },
        { value: "30", label: "30 minuten" },
        { value: "60", label: "60 minuten" },
        { value: "90", label: "90 minuten" },
        { value: "120", label: "120 minuten" },
      ],
    },
  ],

  defaults: {
    dikte: "150",
    hoogte: 2800,
    basisHoogte: 0,
    fireRating: "60",
  },

  depth(p) {
    return (DIKTES[String(p.dikte)] ?? 150) * MM;
  },

  color() {
    return "#e0dcd3"; // KZS-wit
  },

  solids(length, p): SolidBox[] {
    const dikte = (DIKTES[String(p.dikte)] ?? 150) * MM;
    const hoogte = num(p, "hoogte") * MM;
    return [
      { cx: length / 2, cy: 0, zBottom: 0, dx: length, dy: dikte, dz: hoogte },
    ];
  },

  psetName: "Xella_Silka",
  psetProps(length, p) {
    return {
      Fabrikant: "Xella",
      Product: "Silka lijmwand",
      Sterkteklasse: String(p.dikte) === "150" ? "CS20" : String(p.dikte) === "214" ? "CS28" : "CS12",
      Lengte_mm: Math.round(length / MM),
      Hoogte_mm: num(p, "hoogte"),
      Dikte_mm: DIKTES[String(p.dikte)] ?? 150,
      BrandwerendheidREI_min: num(p, "fireRating"),
    };
  },

  /** Common-Pset overrides: bovenop de factory-defaults ook FireRating uit param. */
  commonPset(_length, p) {
    const fr = num(p, "fireRating");
    return {
      FireRating: fr > 0 ? `REI${fr}` : "",
      Compartmentation: fr >= 60,
    };
  },
};
