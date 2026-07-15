import type { ComponentTemplate, ParamValues, SolidBox } from "../core/types";

/** Storax rooster (los paneel).
 *
 * Zelfstandig roosterpaneel met kader rondom en horizontale lamellen.
 * Wordt getekend van punt naar punt (de getekende lengte = paneelbreedte).
 */

const MM = 0.001;

const KLEUREN: Record<string, string> = {
  RAL7016: "#383e42",
  RAL9005: "#0a0a0d",
  RAL9006: "#a5a8a6",
  RAL9010: "#f1ede1",
};

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const storaxRooster: ComponentTemplate = {
  id: "storax-rooster",
  name: "Storax rooster (paneel)",
  category: "Roosters",
  manufacturer: "Storax",
  nlSfb: "22.21",
  material: "Staal, gepoedercoat",
  ifcEntity: "IfcPlate",

  params: [
    { key: "hoogte", label: "Paneelhoogte", type: "length", min: 200, max: 4000, step: 10 },
    { key: "kaderBreedte", label: "Kaderbreedte", type: "length", min: 20, max: 120, step: 5 },
    { key: "kaderDiepte", label: "Kaderdiepte", type: "length", min: 15, max: 100, step: 5 },
    { key: "lamelHoogte", label: "Lamelhoogte", type: "length", min: 20, max: 200, step: 5 },
    { key: "lamelDiepte", label: "Lameldiepte", type: "length", min: 10, max: 80, step: 5 },
    { key: "spleet", label: "Spleetbreedte", type: "length", min: 5, max: 150, step: 5 },
    { key: "basisHoogte", label: "Basishoogte (peil)", type: "length", min: -5000, max: 20000, step: 10 },
    {
      key: "kleur",
      label: "Kleur",
      type: "select",
      options: [
        { value: "RAL7016", label: "RAL 7016 antraciet" },
        { value: "RAL9005", label: "RAL 9005 zwart" },
        { value: "RAL9006", label: "RAL 9006 aluminium" },
        { value: "RAL9010", label: "RAL 9010 wit" },
      ],
    },
  ],

  defaults: {
    hoogte: 2000,
    kaderBreedte: 40,
    kaderDiepte: 30,
    lamelHoogte: 60,
    lamelDiepte: 25,
    spleet: 15,
    basisHoogte: 0,
    kleur: "RAL7016",
  },

  depth(p) {
    return Math.max(num(p, "kaderDiepte"), num(p, "lamelDiepte")) * MM;
  },

  color(p) {
    return KLEUREN[String(p.kleur)] ?? KLEUREN.RAL7016;
  },

  solids(length, p): SolidBox[] {
    const hoogte = num(p, "hoogte") * MM;
    const kaderB = num(p, "kaderBreedte") * MM;
    const kaderD = num(p, "kaderDiepte") * MM;
    const lamelH = num(p, "lamelHoogte") * MM;
    const lamelD = num(p, "lamelDiepte") * MM;
    const spleet = num(p, "spleet") * MM;

    const solids: SolidBox[] = [];

    // kader: 2 staanders + boven- en onderregel
    solids.push({ cx: kaderB / 2, cy: 0, zBottom: 0, dx: kaderB, dy: kaderD, dz: hoogte });
    solids.push({ cx: length - kaderB / 2, cy: 0, zBottom: 0, dx: kaderB, dy: kaderD, dz: hoogte });
    const binnenLengte = Math.max(0, length - 2 * kaderB);
    solids.push({ cx: length / 2, cy: 0, zBottom: 0, dx: binnenLengte, dy: kaderD, dz: kaderB });
    solids.push({ cx: length / 2, cy: 0, zBottom: hoogte - kaderB, dx: binnenLengte, dy: kaderD, dz: kaderB });

    // lamellen binnen het kader
    let z = kaderB + spleet;
    while (z + lamelH <= hoogte - kaderB + 1e-9) {
      solids.push({ cx: length / 2, cy: 0, zBottom: z, dx: binnenLengte, dy: lamelD, dz: lamelH });
      z += lamelH + spleet;
    }

    return solids;
  },

  psetName: "Pset_Storax_Rooster",
  psetProps(length, p) {
    return {
      Fabrikant: "Storax",
      Type: "Roosterpaneel",
      Breedte_mm: Math.round(length / MM),
      Hoogte_mm: num(p, "hoogte"),
      Kaderbreedte_mm: num(p, "kaderBreedte"),
      Kaderdiepte_mm: num(p, "kaderDiepte"),
      Lamelhoogte_mm: num(p, "lamelHoogte"),
      Lameldiepte_mm: num(p, "lamelDiepte"),
      Spleetbreedte_mm: num(p, "spleet"),
      Kleur: String(p.kleur),
    };
  },
};
