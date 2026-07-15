import type { ComponentTemplate, ParamValues, SolidBox } from "../core/types";

/** Storax rooster-lamelwand.
 *
 * Opbouw: stalen stijlen op vaste maximale hart-op-hartafstand, met daartussen
 * horizontale lamellen met open spleten (roosterwerking), optioneel op een plint.
 * Alle maten in de UI in millimeters; intern rekenen we in meters.
 */

const MM = 0.001;

const KLEUREN: Record<string, string> = {
  RAL7016: "#383e42", // antracietgrijs
  RAL9005: "#0a0a0d", // gitzwart
  RAL9006: "#a5a8a6", // blank aluminiumkleurig
  RAL9010: "#f1ede1", // zuiver wit
};

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const storaxLamelWand: ComponentTemplate = {
  id: "storax-rooster-lamelwand",
  name: "Storax rooster-lamelwand",
  category: "Roosterwanden",
  manufacturer: "Storax",
  nlSfb: "22.21",
  material: "Staal, gepoedercoat",
  ifcEntity: "IfcWall",

  params: [
    { key: "hoogte", label: "Hoogte", type: "length", min: 400, max: 6000, step: 10 },
    { key: "plintHoogte", label: "Plinthoogte", type: "length", min: 0, max: 500, step: 5 },
    { key: "lamelHoogte", label: "Lamelhoogte", type: "length", min: 20, max: 300, step: 5 },
    { key: "lamelDiepte", label: "Lameldiepte", type: "length", min: 10, max: 100, step: 5 },
    { key: "spleet", label: "Spleetbreedte", type: "length", min: 5, max: 200, step: 5 },
    { key: "stijlBreedte", label: "Stijlbreedte", type: "length", min: 30, max: 200, step: 5 },
    { key: "stijlDiepte", label: "Stijldiepte", type: "length", min: 30, max: 200, step: 5 },
    { key: "stijlAfstand", label: "Max. h.o.h. stijlen", type: "length", min: 300, max: 3000, step: 50 },
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
    hoogte: 2500,
    plintHoogte: 100,
    lamelHoogte: 80,
    lamelDiepte: 30,
    spleet: 20,
    stijlBreedte: 60,
    stijlDiepte: 60,
    stijlAfstand: 1000,
    basisHoogte: 0,
    kleur: "RAL7016",
  },

  depth(p) {
    return Math.max(num(p, "stijlDiepte"), num(p, "lamelDiepte")) * MM;
  },

  color(p) {
    return KLEUREN[String(p.kleur)] ?? KLEUREN.RAL7016;
  },

  solids(length, p): SolidBox[] {
    const hoogte = num(p, "hoogte") * MM;
    const plint = num(p, "plintHoogte") * MM;
    const lamelH = num(p, "lamelHoogte") * MM;
    const lamelD = num(p, "lamelDiepte") * MM;
    const spleet = num(p, "spleet") * MM;
    const stijlB = num(p, "stijlBreedte") * MM;
    const stijlD = num(p, "stijlDiepte") * MM;
    const hoh = num(p, "stijlAfstand") * MM;

    const solids: SolidBox[] = [];

    // Stijlen: aan beide uiteinden en tussenliggend op max. h.o.h.-afstand
    const veldLengte = length - stijlB;
    const velden = Math.max(1, Math.ceil(veldLengte / hoh));
    for (let i = 0; i <= velden; i++) {
      const cx = stijlB / 2 + (veldLengte * i) / velden;
      solids.push({ cx, cy: 0, zBottom: 0, dx: stijlB, dy: stijlD, dz: hoogte });
    }

    // Plint over de volle lengte
    if (plint > 0) {
      solids.push({ cx: length / 2, cy: 0, zBottom: 0, dx: length, dy: stijlD, dz: plint });
    }

    // Lamellen: gestapeld met open spleten, tot de bovenkant
    let z = plint + spleet;
    while (z + lamelH <= hoogte + 1e-9) {
      solids.push({ cx: length / 2, cy: 0, zBottom: z, dx: length, dy: lamelD, dz: lamelH });
      z += lamelH + spleet;
    }

    return solids;
  },

  psetName: "Storax_RoosterLamelwand",
  psetProps(length, p) {
    return {
      Fabrikant: "Storax",
      Type: "Rooster-lamelwand",
      Lengte_mm: Math.round(length / MM),
      Hoogte_mm: num(p, "hoogte"),
      Plinthoogte_mm: num(p, "plintHoogte"),
      Lamelhoogte_mm: num(p, "lamelHoogte"),
      Lameldiepte_mm: num(p, "lamelDiepte"),
      Spleetbreedte_mm: num(p, "spleet"),
      Stijlbreedte_mm: num(p, "stijlBreedte"),
      Stijldiepte_mm: num(p, "stijlDiepte"),
      MaxHartOpHartStijlen_mm: num(p, "stijlAfstand"),
      Kleur: String(p.kleur),
    };
  },
};
