import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";

/** HSB-buitenwand: stijl+regelwerk 45×145 of 45×220, plaatmateriaal binnen+buiten,
 *  minerale wol tussen de stijlen. Meerlaagse render laat de opbouw zien. */

const MM = 0.001;
const REGELWERK: Record<string, number> = { "145": 145, "195": 195, "220": 220 };

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const hsbBuitenwand: ComponentTemplate = {
  id: "hsb-buitenwand",
  name: "HSB-buitenwand (stijl+regel + isolatie)",
  category: "Buitenwanden",
  nlSfb: "21.22",
  classification: { system: "NL-SfB", code: "21.22" },
  material: "Hout + minerale wol + gipsvezel + houten gevelbekleding",
  loadBearing: true,
  isExternal: true,

  placementKind: "linear",
  materialLayers: [
    { material: "Gipsvezelplaat", thicknessMm: 15, category: "finish" },
    { material: "Hout, gelamineerd stijl+regel", thicknessMm: 145, category: "structure", loadBearing: true },
    { material: "Minerale wol", thicknessMm: 145, category: "insulation" },
    { material: "OSB windvast", thicknessMm: 12, category: "structure" },
    { material: "Houten gevelbekleding", thicknessMm: 22, category: "cladding" },
  ],

  ifcEntity: "IfcWall",
  ifcPredefinedType: "SOLIDWALL",

  params: [
    { key: "regelHoogte", label: "Regeldiepte", type: "select",
      options: [{ value: "145", label: "145 mm" }, { value: "195", label: "195 mm" }, { value: "220", label: "220 mm" }] },
    { key: "hoogte", label: "Wandhoogte", type: "length", min: 2400, max: 4000, step: 10 },
    { key: "basisHoogte", label: "Peil", type: "length", min: -5000, max: 20000, step: 10 },
  ],
  defaults: { regelHoogte: "145", hoogte: 2800, basisHoogte: 0 },

  depth(p) {
    const regel = (REGELWERK[String(p.regelHoogte)] ?? 145) * MM;
    return (15 + 12 + 22) * MM + regel;
  },

  color() { return "#8b6f4b"; },

  solids(length, p): SolidBox[] {
    const regel = (REGELWERK[String(p.regelHoogte)] ?? 145) * MM;
    const h = num(p, "hoogte") * MM;
    const gips = 15 * MM;
    const osb = 12 * MM;
    const gevel = 22 * MM;

    // Gestapeld in dikte-richting: gips (binnen) — regel+isolatie — OSB — gevel (buiten)
    // De y-as loopt van -depth/2 tot +depth/2. Start binnen (cy = -depth/2 + laag/2).
    const totaal = gips + regel + osb + gevel;
    let cursor = -totaal / 2;
    const out: SolidBox[] = [];
    for (const laag of [gips, regel, osb, gevel]) {
      out.push({ cx: length / 2, cy: cursor + laag / 2, zBottom: 0, dx: length, dy: laag, dz: h });
      cursor += laag;
    }
    return out;
  },

  psetName: "HSB_Buitenwand",
  psetProps(length, p) {
    return { Type: "HSB-buitenwand", Regeldiepte_mm: REGELWERK[String(p.regelHoogte)] ?? 145, Lengte_mm: Math.round(length / MM), Hoogte_mm: num(p, "hoogte"), Rc_indicatief: p.regelHoogte === "220" ? "5.5" : "4.7" };
  },

  commonPset(_l, p) {
    return { ThermalTransmittance: p.regelHoogte === "220" ? 0.18 : 0.21 };
  },
};
