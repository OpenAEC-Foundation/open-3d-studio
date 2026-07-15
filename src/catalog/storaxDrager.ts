import type { ComponentTemplate, ParamValues, SolidBox } from "../core/types";

/** Storax drager (kokerprofiel).
 *
 * Horizontale drager waar roosters/panelen aan hangen.
 * Wordt getekend van punt naar punt op de ingestelde basishoogte.
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

export const storaxDrager: ComponentTemplate = {
  id: "storax-drager",
  name: "Storax drager (koker)",
  category: "Dragers",
  manufacturer: "Storax",
  nlSfb: "22.2",
  material: "Staal, gepoedercoat",
  ifcEntity: "IfcBeam",

  params: [
    { key: "profielHoogte", label: "Profielhoogte", type: "length", min: 40, max: 400, step: 10 },
    { key: "profielBreedte", label: "Profielbreedte", type: "length", min: 30, max: 300, step: 10 },
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
    profielHoogte: 120,
    profielBreedte: 60,
    basisHoogte: 2500,
    kleur: "RAL7016",
  },

  depth(p) {
    return num(p, "profielBreedte") * MM;
  },

  color(p) {
    return KLEUREN[String(p.kleur)] ?? KLEUREN.RAL7016;
  },

  solids(length, p): SolidBox[] {
    const h = num(p, "profielHoogte") * MM;
    const b = num(p, "profielBreedte") * MM;
    return [{ cx: length / 2, cy: 0, zBottom: 0, dx: length, dy: b, dz: h }];
  },

  psetName: "Pset_Storax_Drager",
  psetProps(length, p) {
    return {
      Fabrikant: "Storax",
      Type: "Drager kokerprofiel",
      Lengte_mm: Math.round(length / MM),
      Profielhoogte_mm: num(p, "profielHoogte"),
      Profielbreedte_mm: num(p, "profielBreedte"),
      Kleur: String(p.kleur),
    };
  },
};
