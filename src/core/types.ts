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
  type: "length" | "select";
  /** lengtes worden in de UI in mm getoond en bewerkt */
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
}

export type ParamValues = Record<string, number | string>;

/** Een componenttemplate: één definitie voedt zowel de 3D-weergave als de IFC-export.
 *  Vergelijkbaar met een Revit-familie, maar open en in code/JSON te definiëren. */
export interface ComponentTemplate {
  id: string;
  name: string;
  /** categorie = laag in het lagenpaneel */
  category: string;
  manufacturer?: string;
  /** NL-SfB-code (BIM basis ILS) */
  nlSfb?: string;
  /** materiaalnaam voor IfcMaterial (BIM basis ILS) */
  material?: string;
  /** dragend element (Pset_*Common LoadBearing); standaard false */
  loadBearing?: boolean;
  /** buitentoepassing (Pset_*Common IsExternal); standaard false */
  isExternal?: boolean;
  /** IFC-entiteit waarnaar dit component exporteert */
  ifcEntity: "IfcWall" | "IfcBeam" | "IfcPlate";
  params: ParamDef[];
  defaults: ParamValues;
  /** Genereer de opbouw (boxen) voor een gegeven lengte en parameters. Meters. */
  solids(length: number, p: ParamValues): SolidBox[];
  /** Totale dikte van het element (voor placering/weergave). Meters. */
  depth(p: ParamValues): number;
  /** Kleur voor de 3D-weergave */
  color(p: ParamValues): string;
  /** Naam en inhoud van de property set die mee-geëxporteerd wordt */
  psetName: string;
  psetProps(length: number, p: ParamValues): Record<string, number | string>;
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

/** Eén afdrukvenster op een sheet: aanzicht + schaal (noemer, bv. 50 = 1:50). */
export interface SheetViewport {
  view: ViewName;
  scale: number;
}

/** Tekeningblad met formaat, oriëntatie en afdrukvensters. */
export interface Sheet {
  id: string;
  name: string;
  number: string;
  format: "A4" | "A3" | "A2" | "A1";
  landscape: boolean;
  viewports: SheetViewport[];
}
