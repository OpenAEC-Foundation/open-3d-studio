import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";

/** Prefab dakelement — HSB-cassette met dakpannen. Voor de renovatiemarkt. */

const MM = 0.001;

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const prefabDakelement: ComponentTemplate = {
  id: "prefab-dakelement",
  name: "Prefab dakelement (cassette)",
  category: "Daken",
  nlSfb: "27.12",
  classification: { system: "NL-SfB", code: "27.12" },
  material: "Hout + isolatie + pannen (kant-en-klaar)",
  loadBearing: true,
  isExternal: true,

  placementKind: "surface",
  materialLayers: [
    { material: "HSB-cassette", thicknessMm: 300, category: "structure", loadBearing: true, lambda: 0.05 },
    { material: "Dakpannen (keramisch)", thicknessMm: 22, category: "cladding", lambda: 1.0 },
  ],

  ifcEntity: "IfcRoof",
  ifcPredefinedType: "GABLE_ROOF",

  params: [
    { key: "cassetteHoogte", label: "Cassettehoogte", type: "length", min: 240, max: 400, step: 10 },
    { key: "breedte", label: "Dakvlakbreedte", type: "length", min: 3000, max: 15000, step: 100 },
    { key: "basisHoogte", label: "Peil b.k. muurplaat", type: "length", min: 0, max: 30000, step: 10 },
  ],
  defaults: { cassetteHoogte: 300, breedte: 8000, basisHoogte: 3000 },

  depth(p) { return num(p, "breedte") * MM; },
  color() { return "#a26b48"; },

  solids(length, p): SolidBox[] {
    const b = num(p, "breedte") * MM;
    const cass = num(p, "cassetteHoogte") * MM;
    const dakpan = 0.022;
    return [
      { cx: length / 2, cy: 0, zBottom: 0, dx: length, dy: b, dz: cass },
      { cx: length / 2, cy: 0, zBottom: cass, dx: length, dy: b, dz: dakpan },
    ];
  },

  psetName: "Prefab_Dakelement",
  psetProps(length, p) {
    return { Type: "Prefab dakelement", CassetteHoogte_mm: num(p, "cassetteHoogte"), Lengte_mm: Math.round(length / MM), Breedte_mm: num(p, "breedte") };
  },
};
