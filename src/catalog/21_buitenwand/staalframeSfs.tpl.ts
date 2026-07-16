import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";

/** Staalframe (SFS — Steel Frame System) buitenwand: koudgevormde C-profielen als
 *  stijl+regel, minerale wol tussen, gips of gipsvezel binnen, gevelplaat buiten. */

const MM = 0.001;

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const staalframeSfs: ComponentTemplate = {
  id: "staalframe-sfs",
  name: "Staalframe SFS-buitenwand",
  category: "Buitenwanden",
  nlSfb: "21.24",
  classification: { system: "NL-SfB", code: "21.24" },
  material: "Staal + minerale wol + gipsvezel + gevelplaat",
  loadBearing: true,
  isExternal: true,

  placementKind: "linear",
  materialLayers: [
    { material: "Gipsvezelplaat", thicknessMm: 15, category: "finish" },
    { material: "Staal, C-profielen + minerale wol", thicknessMm: 150, category: "structure", loadBearing: true },
    { material: "Windvast plaatmateriaal", thicknessMm: 12, category: "structure" },
    { material: "Isolatie (buitenzijde)", thicknessMm: 60, category: "insulation" },
    { material: "Gevelplaat", thicknessMm: 18, category: "cladding" },
  ],

  ifcEntity: "IfcWall",
  ifcPredefinedType: "SOLIDWALL",

  params: [
    { key: "cProfiel", label: "C-profiel diepte", type: "select",
      options: [{ value: "100", label: "100 mm" }, { value: "150", label: "150 mm" }, { value: "200", label: "200 mm" }] },
    { key: "hoogte", label: "Wandhoogte", type: "length", min: 2400, max: 4200, step: 10 },
    { key: "basisHoogte", label: "Peil", type: "length", min: -5000, max: 20000, step: 10 },
  ],
  defaults: { cProfiel: "150", hoogte: 2800, basisHoogte: 0 },

  depth(p) { return (15 + num(p, "cProfiel") + 12 + 60 + 18) * MM; },
  color() { return "#606870"; },

  solids(length, p): SolidBox[] {
    const c = num(p, "cProfiel") * MM;
    const h = num(p, "hoogte") * MM;
    const lagen = [15, c / MM, 12, 60, 18].map((mm) => mm * MM);
    const totaal = lagen.reduce((a, b) => a + b, 0);
    let cursor = -totaal / 2;
    const out: SolidBox[] = [];
    for (const laag of lagen) {
      out.push({ cx: length / 2, cy: cursor + laag / 2, zBottom: 0, dx: length, dy: laag, dz: h });
      cursor += laag;
    }
    return out;
  },

  psetName: "Staalframe_SFS",
  psetProps(length, p) {
    return { Type: "SFS", CProfiel_mm: num(p, "cProfiel"), Lengte_mm: Math.round(length / MM), Hoogte_mm: num(p, "hoogte") };
  },

  commonPset(_l, p) {
    return { ThermalTransmittance: Math.max(0.15, 25 / num(p, "cProfiel")) };
  },
};
