import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";
import { STEEL_PROFILES, findProfile, profileOptions } from "../_shared/profiles";

/** Universeel constructiestaal-template.
 *  Eén file levert ~300 modelleerbare varianten dankzij de profielCatalogus-select
 *  (IPE, HEA/HEB/HEM, UNP, SHS/RHS, CHS, L).
 *
 *  Sinds de geometrie-stap is de doorsnede écht: `profileSpecFor` levert het
 *  gekozen profiel per element, en meshBuilder/ifcExport extruderen dat als
 *  werkelijke vorm (fillets incluis) in 3D-weergave én IFC-body. De
 *  `solids()`-enveloppe hieronder is alleen nog de terugval voor elementen
 *  met sparingen en voor de 2D-consumenten (sectionSvg, elementeren).
 *
 *  De `richting`-parameter is voorbereid maar nog niet bedraad: een
 *  kolom-adapter (IfcColumn + verticale extrusie) bestaat nog niet. */

const MM = 0.001;

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

/** Buitenmaten (h × b) uit een ProfileSpec — voor alle shape-varianten. */
function envelope(designation: string): { h: number; b: number } {
  const p = findProfile(designation);
  if (!p) return { h: 200, b: 100 };
  const d = p.dimensions;
  switch (p.shape) {
    case "IShape":
      return { h: d.OverallDepth ?? 200, b: d.OverallWidth ?? 100 };
    case "UShape":
      return { h: d.OverallDepth ?? 200, b: d.FlangeWidth ?? 100 };
    case "RectangleHollow":
    case "Rectangle":
      return { h: d.XDim ?? 200, b: d.YDim ?? 100 };
    case "CircleHollow":
    case "Circle":
      return { h: (d.Radius ?? 100) * 2, b: (d.Radius ?? 100) * 2 };
    case "LShape":
      return { h: d.Depth ?? 100, b: d.Width ?? 100 };
    default:
      return { h: 200, b: 100 };
  }
}

export const staalprofiel: ComponentTemplate = {
  id: "staalprofiel-nen10365",
  name: "Constructiestaal (IPE/HEA/HEB/HEM/UNP/koker/buis/L)",
  category: "Hoofddraagconstructie",
  nlSfb: "28.11",
  classification: { system: "NL-SfB", code: "28.11" },
  material: "Staal S235/S355",
  loadBearing: true,

  placementKind: "linear",

  ifcEntity: "IfcBeam", // kolom-adapter (IfcColumn bij richting="verticaal") bestaat nog niet
  ifcPredefinedType: "BEAM",

  profileSpec: findProfile("IPE 200"),
  profileSpecFor: (p) => findProfile(String(p.profiel)),

  params: [
    { key: "profiel", label: "Profiel (NEN-EN 10365)", type: "select", options: profileOptions(STEEL_PROFILES) },
    { key: "richting", label: "Richting", type: "select",
      options: [{ value: "horizontaal", label: "Balk (horizontaal)" }, { value: "verticaal", label: "Kolom (verticaal)" }] },
    { key: "staalsoort", label: "Staalsoort", type: "select",
      options: [{ value: "S235", label: "S235 (standaard)" }, { value: "S355", label: "S355 (hoogsterkte)" }] },
    { key: "basisHoogte", label: "Basishoogte", type: "length", min: -5000, max: 20000, step: 10 },
  ],
  defaults: { profiel: "IPE 200", richting: "horizontaal", staalsoort: "S235", basisHoogte: 0 },

  depth(p) {
    const { b } = envelope(String(p.profiel));
    return b * MM;
  },

  color() { return "#4d5560"; },

  solids(length, p): SolidBox[] {
    const { h, b } = envelope(String(p.profiel));
    const H = h * MM;
    const B = b * MM;
    // Weergave als enveloppe-doos. Balk = h omhoog, kolom = h langs lengte-as (nvt hier).
    return [{ cx: length / 2, cy: 0, zBottom: 0, dx: length, dy: B, dz: H }];
  },

  psetName: "Staalprofiel",
  psetProps(length, p) {
    const spec = findProfile(String(p.profiel));
    return {
      Profiel: String(p.profiel),
      Staalsoort: String(p.staalsoort),
      Richting: String(p.richting),
      Lengte_mm: Math.round(length / MM),
      ProfielShape: spec?.shape ?? "",
    };
  },

  commonPset(l) {
    return { Span: l, FireRating: "R60" };
  },
};
