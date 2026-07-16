import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";

/** IfcSpace — ruimte-template.
 *
 *  Voor v0.4-S8 als *lineair* segment geïmplementeerd met een breedte-parameter,
 *  zoals de vloeren in Sprint 2. Polygonaal contour + NEN 2580-berekening op de
 *  contour komen in v0.5 samen met de UI-flow voor polygonen. De rekenfunctie
 *  `berekenGbo()` in src/core/nen2580.ts is nu al bruikbaar via de API. */

const MM = 0.001;

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const ifcSpaceRuimte: ComponentTemplate = {
  id: "ifcspace-ruimte",
  name: "Ruimte (IfcSpace, NEN 2580)",
  category: "Ruimten",
  nlSfb: "90.10",
  classification: { system: "NL-SfB", code: "90.10" },
  loadBearing: false,

  placementKind: "surface",
  ifcEntity: "IfcSpace",
  ifcPredefinedType: "INTERNAL",

  params: [
    { key: "breedte", label: "Ruimtebreedte", type: "length", min: 1000, max: 20000, step: 100 },
    { key: "vrijeHoogte", label: "Vrije hoogte", type: "length", min: 1500, max: 4000, step: 10 },
    { key: "soort", label: "Ruimtesoort", type: "select",
      options: [
        { value: "verblijfsruimte", label: "Verblijfsruimte" },
        { value: "verkeersruimte", label: "Verkeersruimte" },
        { value: "sanitair", label: "Sanitair" },
        { value: "installatieruimte", label: "Installatieruimte" },
        { value: "berging", label: "Berging" },
      ] },
    { key: "basisHoogte", label: "Peil b.k. vloer", type: "length", min: -1000, max: 30000, step: 10 },
  ],
  defaults: { breedte: 4000, vrijeHoogte: 2600, soort: "verblijfsruimte", basisHoogte: 0 },

  depth(p) { return num(p, "breedte") * MM; },
  color() { return "#c9d5c1"; },

  solids(length, p): SolidBox[] {
    // Space wordt gerenderd als transparante enveloppe. In v0.4 nog een blokvorm.
    const b = num(p, "breedte") * MM;
    const h = num(p, "vrijeHoogte") * MM;
    return [{ cx: length / 2, cy: 0, zBottom: 0, dx: length, dy: b, dz: h }];
  },

  psetName: "IfcSpace_NEN2580",
  psetProps(length, p) {
    const opp = (length * num(p, "breedte")) / 1e6;
    return {
      Soort: String(p.soort),
      Breedte_mm: num(p, "breedte"),
      Lengte_mm: Math.round(length / MM),
      VrijeHoogte_mm: num(p, "vrijeHoogte"),
      GBO_ruw_m2: Math.round(opp * 100) / 100,
    };
  },
};
