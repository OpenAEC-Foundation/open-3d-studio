/** Interne representatie van een buildingSMART IDS-specificatie (v1.0).
 *
 *  We modelleren alleen de deelmenge die zinvol is voor Open 3D Studio's model:
 *  entiteit (`IfcEntity`), classificatie (NL-SfB/bSDD), materiaal, property (Pset)
 *  en attribuut (`Name`, `PredefinedType`). Voldoende voor BIM basis ILS 2.0 en
 *  de ILS O&E-templates. Volledige IDS-Cardinality / bounds volgen in v0.6. */

export type FacetKind = "entity" | "classification" | "material" | "property" | "attribute";

/** Match-strategie op een string-waarde. `equal` is default; `pattern` is een RegExp-bron. */
export interface ValueMatch {
  equal?: string;
  pattern?: string;
  /** Als lijst is opgegeven telt "matcht ten minste één van". */
  oneOf?: string[];
}

/** Numerieke bounds (voor ThermalTransmittance, Rc, GlazingAreaFraction). */
export interface RangeMatch {
  min?: number;
  minInclusive?: boolean;
  max?: number;
  maxInclusive?: boolean;
}

/** Facet: één losse eis. */
export type Facet =
  | { kind: "entity"; name: ValueMatch; predefinedType?: ValueMatch }
  | { kind: "classification"; system: ValueMatch; value?: ValueMatch }
  | { kind: "material"; value?: ValueMatch }
  | {
      kind: "property";
      pset: ValueMatch;
      name: ValueMatch;
      value?: ValueMatch;
      range?: RangeMatch;
      dataType?: "IfcBoolean" | "IfcLabel" | "IfcReal" | "IfcThermalTransmittanceMeasure";
    }
  | { kind: "attribute"; name: ValueMatch; value?: ValueMatch };

/** Cardinality zoals in IDS v1.0. */
export type Cardinality = "required" | "optional" | "prohibited";

/** Één IDS-specificatie: welke elementen dit betreft (`applicability`) en waaraan
 *  ze moeten voldoen (`requirements`). */
export interface Specification {
  /** Menselijke naam, komt in het rapport. */
  name: string;
  /** Toelichting voor het rapport. */
  description?: string;
  /** IDS-cardinality voor deze specificatie. Default `required`. */
  cardinality?: Cardinality;
  /** Filter: welke elementen zijn van toepassing? Alle facets moeten kloppen. */
  applicability: Facet[];
  /** Wat moeten deze elementen hebben? Alle facets moeten kloppen. */
  requirements: Facet[];
  /** Optioneel: link naar de norm-tekst voor in het rapport. */
  reference?: string;
}

/** Wortel: volledige IDS-configuratie. */
export interface IdsDocument {
  title: string;
  description?: string;
  author?: string;
  version?: string;
  /** Voor ILS O&E: welke fase deze IDS afdekt (SO/VO/DO/TO/UO). */
  phase?: "SO" | "VO" | "DO" | "TO" | "UO" | "ILS";
  specifications: Specification[];
}
