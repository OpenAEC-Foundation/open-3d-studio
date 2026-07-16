import * as THREE from "three";

/** Een rechthoekig volume in wand-lokale coördinaten (meters).
 *  x = langs de wandas, y = dikte (gecentreerd rond 0), z = omhoog vanaf onderkant. */
export interface SolidBox {
  /** middelpunt in x (langs de wand) */
  cx: number;
  /** middelpunt in y (dikte-richting) */
  cy: number;
  /** onderkant in z */
  zBottom: number;
  /** afmeting langs de wand */
  dx: number;
  /** afmeting in dikte-richting */
  dy: number;
  /** hoogte */
  dz: number;
}

/** Parameterdefinitie voor de eigenschappen-UI (Revit-parameter-gedachte). */
export interface ParamDef {
  key: string;
  label: string;
  type: "length" | "select" | "text" | "boolean" | "material-layer" | "profile";
  /** lengtes worden in de UI in mm getoond en bewerkt */
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  /** Toon deze parameter alleen als het predicaat true is (v0.4-S9 conditional geometry). */
  visibleWhen?: (p: ParamValues) => boolean;
  /** Bereken de waarde uit andere parameters (v0.4-S9 formula-driven). */
  formula?: (p: ParamValues) => number | string;
}

export type ParamValues = Record<string, number | string | boolean>;

// ============================================================================
// v0.4-S1: parametrische diepte
// ============================================================================

/** Hoe wordt dit template geplaatst?
 *  - linear:   twee punten in het horizontale vlak (wand, balk, leuning) — huidige gedrag
 *  - point:    één punt (kolom, poer, paal, dakraam)
 *  - surface:  polygonaal contour + dikte (vloer, dak, ruimte)
 *  - assembly: multi-entiteit (trap, dakkapel, kozijn met beslag) */
export type PlacementKind = "linear" | "point" | "surface" | "assembly";

/** Eén materiaallaag in een IfcMaterialLayerSet (spouwmuur, HSB-wand, dakopbouw). */
export interface MaterialLayer {
  /** IfcMaterial-naam (BIM basis ILS eis 6) */
  material: string;
  /** dikte in mm */
  thicknessMm: number;
  /** laagfunctie voor semantiek — geen IFC-veld maar handig voor UI/hatching */
  category?: "structure" | "insulation" | "cladding" | "finish" | "membrane" | "cavity";
  loadBearing?: boolean;
  isVentilated?: boolean;
  /** Warmtegeleidingscoëfficiënt λ in W/(m·K). Voedt Pset_MaterialThermal en de
   *  Rc-berekening (v0.5). Verplicht laten wanneer dit een gevel/dak/vloer is
   *  waar de Bbl-eisen op van toepassing zijn. */
  lambda?: number;
}

/** Constructief profiel voor staal/hout (IfcMaterialProfileSetUsage).
 *  Eén template + ProfileSpec + profielCatalogus = ~300 modelleerbare varianten. */
export interface ProfileSpec {
  shape:
    | "IShape"           // IPE, HEA, HEB, HEM — IfcIShapeProfileDef
    | "RectangleHollow"  // SHS, RHS         — IfcRectangleHollowProfileDef
    | "CircleHollow"     // CHS              — IfcCircleHollowProfileDef
    | "UShape"           // UNP, UAP         — IfcUShapeProfileDef
    | "LShape"           // hoekstaal        — IfcLShapeProfileDef
    | "TShape"           // T-profiel        — IfcTShapeProfileDef
    | "ZShape"           // Z-profiel        — IfcZShapeProfileDef
    | "CShape"           // koudgevormd C    — IfcCShapeProfileDef
    | "Rectangle"        // rechthoek        — IfcRectangleProfileDef (glulam, prefab beton)
    | "Circle";          // ronde kolom      — IfcCircleProfileDef
  /** Aanduiding uit catalogus (bv. "IPE 200", "HEA 300", "SHS 100x100x5"). */
  designation: string;
  /** Afmetingen in mm afhankelijk van shape. Bv. IShape: {depth, width, webThickness, flangeThickness, filletRadius}. */
  dimensions: Record<string, number>;
}

// ============================================================================
// v0.4-S1: IFC-entiteiten en PredefinedType
// ============================================================================

/** IFC-entiteiten die Open 3D Studio kan exporteren.
 *  Uitgebreid in v0.4 t.o.v. de oorspronkelijke {IfcWall, IfcBeam, IfcPlate};
 *  in v0.6 met de MEP-basisset (pipe/duct/cable + terminals). */
export type IfcEntityName =
  | "IfcWall"
  | "IfcSlab"
  | "IfcBeam"
  | "IfcColumn"
  | "IfcPlate"
  | "IfcMember"
  | "IfcRoof"
  | "IfcStair"
  | "IfcStairFlight"
  | "IfcRailing"
  | "IfcCovering"
  | "IfcDoor"
  | "IfcWindow"
  | "IfcFooting"
  | "IfcPile"
  | "IfcSpace"
  | "IfcOpeningElement"
  | "IfcElementAssembly"
  | "IfcBuildingElementProxy"
  // v0.6-3: MEP-basisset
  | "IfcPipeSegment"
  | "IfcPipeFitting"
  | "IfcDuctSegment"
  | "IfcDuctFitting"
  | "IfcCableSegment"
  | "IfcCableCarrierSegment"
  | "IfcAirTerminal"
  | "IfcSpaceHeater"
  | "IfcOutlet"
  | "IfcSanitaryTerminal"
  | "IfcFlowTerminal"
  | "IfcLightFixture";

// ============================================================================
// v0.4-S1: bouwkundige fase (renovatie/nieuwbouw/sloop)
// ============================================================================

/** Faseringstoestand per element. Data-shape in v0.4-S1, UI-filter in v0.5. */
export type ElementPhase = "existing" | "new" | "demolished" | "temporary";

// ============================================================================
// ComponentTemplate — één definitie voedt 3D-weergave én IFC-export.
// ============================================================================

/** Een componenttemplate — vergelijkbaar met een Revit-familie, open en in code.
 *  Alle v0.4-uitbreidingen zijn optioneel: bestaande templates blijven werken. */
export interface ComponentTemplate {
  id: string;
  name: string;
  /** categorie = laag in het lagenpaneel */
  category: string;
  manufacturer?: string;
  /** NL-SfB-code (BIM basis ILS) — kan blijven naast bSDD-classification hieronder */
  nlSfb?: string;
  /** bSDD-classificatie (v0.4-S9). Vult IfcClassificationReference in de export. */
  classification?: {
    /** systeem: "NL-SfB", "Uniclass", "OmniClass", "DIN 276" */
    system: string;
    code: string;
    /** bSDD-URL naar het concept */
    location?: string;
  };
  /** materiaalnaam voor IfcMaterial (BIM basis ILS eis 6) */
  material?: string;
  /** dragend element (Pset_*Common LoadBearing); standaard false */
  loadBearing?: boolean;
  /** buitentoepassing (Pset_*Common IsExternal); standaard false */
  isExternal?: boolean;

  // ------- v0.4-S1: parametrische diepte + IFC-precisie -------

  /** Plaatsing-model. Default = "linear" (backwards-compat met huidige templates). */
  placementKind?: PlacementKind;
  /** MaterialLayerSet voor spouwmuur, HSB, dakopbouw. Voert IfcMaterialLayerSet in de export. */
  materialLayers?: MaterialLayer[];
  /** Voor staal/hout: profielselectie. Genereert IfcMaterialProfileSetUsage. */
  profileSpec?: ProfileSpec;

  /** IFC-entiteit waarnaar dit component exporteert. Uitgebreid in v0.4 —
   *  bestaande "IfcWall"|"IfcBeam"|"IfcPlate" blijven geldig. */
  ifcEntity: IfcEntityName;
  /** IFC PredefinedType (BIM basis ILS eis 3). Bijv. "SOLIDWALL" voor IfcWall,
   *  "STRIP_FOOTING" voor IfcFooting, "STRAIGHT_RUN_STAIR" voor IfcStair. */
  ifcPredefinedType?: string;
  /** ObjectType (verplicht wanneer PredefinedType = USERDEFINED). Bijv. "WOODEN_PILE". */
  ifcObjectType?: string;

  params: ParamDef[];
  defaults: ParamValues;

  /** Genereer de opbouw (boxen) voor een gegeven lengte en parameters. Meters. */
  solids(length: number, p: ParamValues): SolidBox[];
  /** Totale dikte van het element (voor placering/weergave). Meters. */
  depth(p: ParamValues): number;
  /** Kleur voor de 3D-weergave */
  color(p: ParamValues): string;

  /** Naam en inhoud van de eigen property set (fabrikant-specifiek). */
  psetName: string;
  psetProps(length: number, p: ParamValues): Record<string, number | string | boolean>;

  /** Common Pset per IFC-entiteit (BIM basis ILS v2 eis 7).
   *  Optioneel: als je hem niet levert, valt de export terug op de factory-defaults
   *  uit `src/core/psetFactories.ts`. Template overschrijft alleen wat afwijkt. */
  commonPset?(length: number, p: ParamValues): Record<string, string | number | boolean>;
}

/** Sparing (opening) in een wandvormig element, in wand-lokale coördinaten (meters). */
export interface Opening {
  /** afstand van het startpunt tot het midden van de sparing, langs de wandas */
  xPos: number;
  breedte: number;
  /** hoogte van de sparing vanaf de onderkant van het element */
  hoogte: number;
}

/** Een geplaatst element in het model (start/eind in three.js-wereldcoördinaten, meters, y = omhoog). */
export interface PlacedElement {
  id: string;
  templateId: string;
  name: string;
  start: THREE.Vector3;
  end: THREE.Vector3;
  params: ParamValues;
  /** verdieping waarop het element hoort (IfcBuildingStorey) */
  storeyId?: string;
  /** optionele sparing */
  opening?: Opening | null;
  /** merk-/posnummer (automatisch, identieke elementen delen een merk) */
  merk?: string;

  // ------- v0.4-S1: host/space/phase -------

  /** Voor hosted elementen (deuren/ramen in wand, coverings op vloer): het host-element. */
  hostId?: string;
  /** Ruimte-relatie (IfcRelContainedInSpatialStructure via IfcSpace). */
  spaceId?: string;
  /** Bouwkundige fase (data-shape v0.4-S1; view-filter en overrides v0.5). */
  phase?: ElementPhase;
}

/** Bouwlaag conform BIM basis ILS-naamgeving ("00 begane grond", "01 eerste verdieping"). */
export interface Storey {
  id: string;
  name: string;
  /** peil in meters */
  elevation: number;
}

/** Rechthoekig stramien: assen 1..n in x-richting, A..n in y-richting (bouwkundig). */
export interface GridConfig {
  enabled: boolean;
  /** aantal assen in x-richting (genummerd 1, 2, 3, …) */
  countX: number;
  /** hart-op-hart in meters */
  spacingX: number;
  countY: number;
  spacingY: number;
}

export interface LoadedModelInfo {
  id: string;
  name: string;
  visible: boolean;
}

/** Los lijnsegment (schetslijnen), in wereldcoördinaten. */
export interface LineSegment {
  id: string;
  a: THREE.Vector3;
  b: THREE.Vector3;
}

/** Maatvoeringssegment met gemeten lengte in meters. */
export interface MeasureSegment {
  id: string;
  a: THREE.Vector3;
  b: THREE.Vector3;
  length: number;
}

/** Projectnulpunt in bouwkundige coördinaten (X=oost, Y=noord, Z=hoogte), meters. */
export interface ProjectOrigin {
  x: number;
  y: number;
  z: number;
}

/** Tekstlabel in het model. */
export interface TextLabel {
  id: string;
  position: THREE.Vector3;
  text: string;
}

export type ViewName = "iso" | "top" | "front" | "back" | "left" | "right";

/** Eén afdrukvenster op een sheet: aanzicht + schaal (noemer, bv. 50 = 1:50).
 *  Sinds v0.4-S9-productie: paper-coordinaten (mm) voor vrije positionering. */
export interface SheetViewport {
  view: ViewName;
  scale: number;
  /** Positie op het papier in mm (linkerbovenhoek). Optioneel; ontbreekt = auto-grid. */
  paper_x_mm?: number;
  paper_y_mm?: number;
  paper_w_mm?: number;
  paper_h_mm?: number;
  /** v0.5-S3: annotaties (maten, callouts) in paper-mm bovenop deze viewport. */
  annotations?: SheetAnnotation[];
}

/** Sheet-annotatie: maatlijn of callout-verwijzing (v0.5-S3).
 *  Paper-coordinaten in mm (absoluut op het blad, oorsprong linksboven); bij
 *  viewport-drag schuiven ze mee. NB: maten zijn papier-metingen (afstand ×
 *  schaal) en NIET gekoppeld aan modelgeometrie — bij een modelwijziging
 *  moeten ze opnieuw geplaatst worden. Associatieve maatvoering volgt in v0.7. */
export type SheetAnnotation =
  | {
      kind: "dimension";
      /** Twee punten in paper-mm; label wordt automatisch berekend uit de schaal. */
      a: { x: number; y: number };
      b: { x: number; y: number };
      /** Handmatig label (mm). Ontbreekt = auto uit lengte en schaal. */
      overrideMm?: number;
    }
  | {
      kind: "callout";
      /** Positie op het papier. */
      pos: { x: number; y: number };
      /** Detailnummer dat op het bronblad wordt getoond (bv. "3"). */
      detailNr: string;
      /** Sheet-nummer waar het detail te vinden is (bv. "S-05"). */
      refSheet: string;
    };

/** Tekeningblad met formaat, oriëntatie en afdrukvensters. */
export interface Sheet {
  id: string;
  name: string;
  number: string;
  format: "A4" | "A3" | "A2" | "A1";
  landscape: boolean;
  viewports: SheetViewport[];
}
