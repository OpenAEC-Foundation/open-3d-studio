import type { ComponentTemplate, ParamValues } from "./types";

/** Common Property Sets per IFC-entiteit conform BIM basis ILS v2 (eis 7).
 *
 *  Elke factory levert intelligente defaults op basis van de template-eigenschappen
 *  (loadBearing, isExternal, etc.). Templates hoeven alleen te overschrijven wat
 *  afwijkt — via de optionele `commonPset()` op ComponentTemplate.
 *
 *  Gebruik in de export:
 *    const pset = template.commonPset?.(length, params) ?? factoryFor(template).base(t, l, p);
 *
 *  Uitbreiding in v0.5: `ThermalTransmittance` (Rc/U) landt hier via Pset_MaterialThermal
 *  op de MaterialLayer, niet in Pset_*Common. */

type CommonPset = Record<string, string | number | boolean>;

/** Referentie-code voor Pset_*Common.Reference — combineert template-id + hoofdmaten.
 *  Twee elementen met dezelfde referentie zijn instances van hetzelfde IfcType. */
function makeReference(t: ComponentTemplate, length: number, p: ParamValues): string {
  const lm = Math.round(length * 1000);
  const h = typeof p.hoogte === "number" ? Math.round(p.hoogte) : null;
  return h !== null ? `${t.id}-${lm}x${h}` : `${t.id}-${lm}`;
}

/** Standaard-props die op elke Common-Pset horen. */
function base(t: ComponentTemplate, length: number, p: ParamValues): CommonPset {
  return {
    Reference: makeReference(t, length, p),
    LoadBearing: !!t.loadBearing,
    IsExternal: !!t.isExternal,
  };
}

// ============================================================================
// Per-entity factories
// ============================================================================

export function makeWallCommonPset(t: ComponentTemplate, length: number, p: ParamValues): CommonPset {
  // Pset_WallCommon: Reference, LoadBearing, IsExternal, FireRating, AcousticRating,
  //                  ThermalTransmittance, Compartmentation, ExtendToStructure
  return {
    ...base(t, length, p),
    ExtendToStructure: false,
  };
}

export function makeSlabCommonPset(t: ComponentTemplate, length: number, p: ParamValues): CommonPset {
  // Pset_SlabCommon: Reference, LoadBearing (default true voor vloeren), IsExternal,
  //                  FireRating, AcousticRating, PitchAngle, ThermalTransmittance
  return {
    ...base(t, length, p),
    LoadBearing: t.loadBearing !== false, // vloeren zijn default dragend
    PitchAngle: 0,
  };
}

export function makeBeamCommonPset(t: ComponentTemplate, length: number, p: ParamValues): CommonPset {
  // Pset_BeamCommon: Reference, LoadBearing (default true), IsExternal, FireRating, Roll, Span, Slope
  return {
    ...base(t, length, p),
    LoadBearing: t.loadBearing !== false,
    Span: length,
  };
}

export function makeColumnCommonPset(t: ComponentTemplate, length: number, p: ParamValues): CommonPset {
  // Pset_ColumnCommon: Reference, LoadBearing (default true), IsExternal, FireRating, Slope, Roll
  return {
    ...base(t, length, p),
    LoadBearing: t.loadBearing !== false,
  };
}

export function makePlateCommonPset(t: ComponentTemplate, length: number, p: ParamValues): CommonPset {
  // Pset_PlateCommon: Reference, LoadBearing, IsExternal, FireRating, AcousticRating, ThermalTransmittance
  return base(t, length, p);
}

export function makeMemberCommonPset(t: ComponentTemplate, length: number, p: ParamValues): CommonPset {
  // Pset_MemberCommon: Reference, LoadBearing, IsExternal, FireRating, Roll, Slope, Span
  return {
    ...base(t, length, p),
    Span: length,
  };
}

export function makeRoofCommonPset(t: ComponentTemplate, length: number, p: ParamValues): CommonPset {
  // Pset_RoofCommon: Reference, IsExternal (default true), FireRating, AcousticRating,
  //                  TotalArea, ProjectedArea
  return {
    ...base(t, length, p),
    IsExternal: t.isExternal !== false,
  };
}

export function makeStairCommonPset(t: ComponentTemplate, length: number, p: ParamValues): CommonPset {
  // Pset_StairCommon: Reference, IsExternal, FireRating, HandicapAccessible,
  //                   FireExit, HasNonSkidSurface, RequiredHeadroom,
  //                   NumberOfRiser, NumberOfTreads, RiserHeight, TreadLength
  const nRisers = typeof p.aantalTreden === "number" ? p.aantalTreden : undefined;
  const riserH = typeof p.optrede === "number" ? p.optrede / 1000 : undefined;
  const treadL = typeof p.aantrede === "number" ? p.aantrede / 1000 : undefined;
  const out: CommonPset = {
    ...base(t, length, p),
    HandicapAccessible: false,
    FireExit: false,
    HasNonSkidSurface: true,
  };
  if (nRisers !== undefined) out.NumberOfRiser = nRisers;
  if (nRisers !== undefined) out.NumberOfTreads = Math.max(0, nRisers - 1);
  if (riserH !== undefined) out.RiserHeight = riserH;
  if (treadL !== undefined) out.TreadLength = treadL;
  return out;
}

export function makeRailingCommonPset(t: ComponentTemplate, length: number, p: ParamValues): CommonPset {
  // Pset_RailingCommon: Reference, IsExternal, FireRating, Height, HandicapAccessible
  const heightMm = typeof p.hoogte === "number" ? p.hoogte : undefined;
  const out: CommonPset = {
    ...base(t, length, p),
    HandicapAccessible: false,
  };
  if (heightMm !== undefined) out.Height = heightMm / 1000;
  return out;
}

export function makeCoveringCommonPset(t: ComponentTemplate, length: number, p: ParamValues): CommonPset {
  // Pset_CoveringCommon: Reference, IsExternal, FireRating, AcousticRating,
  //                     FlammabilityRating, SurfaceSpreadOfFlame, Combustible, ThermalTransmittance
  return base(t, length, p);
}

export function makeDoorCommonPset(t: ComponentTemplate, length: number, p: ParamValues): CommonPset {
  // Pset_DoorCommon: Reference, IsExternal, FireRating, AcousticRating,
  //                  SecurityRating, DurabilityRating, HygrothermalRating,
  //                  WaterTightnessRating, MechanicalLoadRating, WindLoadRating,
  //                  HandicapAccessible, FireExit, SelfClosing, SmokeStop,
  //                  ThermalTransmittance, GlazingAreaFraction
  return {
    ...base(t, length, p),
    HandicapAccessible: false,
    FireExit: false,
    SelfClosing: false,
    SmokeStop: false,
  };
}

export function makeWindowCommonPset(t: ComponentTemplate, length: number, p: ParamValues): CommonPset {
  // Pset_WindowCommon: Reference, IsExternal (default true), FireRating,
  //                    AcousticRating, SecurityRating, ThermalTransmittance,
  //                    GlazingAreaFraction, Infiltration, HasSillExternal, HasSillInternal
  return {
    ...base(t, length, p),
    IsExternal: t.isExternal !== false,
    HasSillExternal: true,
    HasSillInternal: true,
  };
}

export function makeFootingCommonPset(t: ComponentTemplate, length: number, p: ParamValues): CommonPset {
  // Pset_FootingCommon: Reference, LoadBearingCapacity (default 0), Slope
  return {
    ...base(t, length, p),
    LoadBearing: true,
  };
}

export function makePileCommonPset(t: ComponentTemplate, length: number, p: ParamValues): CommonPset {
  // Pset_PileCommon: Reference, PileHeadElevation, PileToeElevation, EmbedmentLength,
  //                  DrainHoles, Slope
  return {
    ...base(t, length, p),
    LoadBearing: true,
  };
}

// ============================================================================
// Selector — kies de juiste factory op basis van ifcEntity
// ============================================================================

/** Kies de juiste Common-Pset-factory op basis van de IFC-entiteit van het template.
 *  Fallback: `base()` (Reference + LoadBearing + IsExternal) voor onbekende entiteiten. */
export function commonPsetFor(
  t: ComponentTemplate,
  length: number,
  p: ParamValues,
): { name: string; props: CommonPset } {
  // Template heeft eigen implementatie? Die krijgt voorrang; wij vullen alleen aan.
  const templateProps = t.commonPset?.(length, p);
  const factoryProps = defaultsFor(t, length, p);
  return {
    name: factoryProps.name,
    props: { ...factoryProps.props, ...(templateProps ?? {}) },
  };
}

function defaultsFor(
  t: ComponentTemplate,
  length: number,
  p: ParamValues,
): { name: string; props: CommonPset } {
  switch (t.ifcEntity) {
    case "IfcWall":
      return { name: "Pset_WallCommon", props: makeWallCommonPset(t, length, p) };
    case "IfcSlab":
      return { name: "Pset_SlabCommon", props: makeSlabCommonPset(t, length, p) };
    case "IfcBeam":
      return { name: "Pset_BeamCommon", props: makeBeamCommonPset(t, length, p) };
    case "IfcColumn":
      return { name: "Pset_ColumnCommon", props: makeColumnCommonPset(t, length, p) };
    case "IfcPlate":
      return { name: "Pset_PlateCommon", props: makePlateCommonPset(t, length, p) };
    case "IfcMember":
      return { name: "Pset_MemberCommon", props: makeMemberCommonPset(t, length, p) };
    case "IfcRoof":
      return { name: "Pset_RoofCommon", props: makeRoofCommonPset(t, length, p) };
    case "IfcStair":
    case "IfcStairFlight":
      return { name: "Pset_StairCommon", props: makeStairCommonPset(t, length, p) };
    case "IfcRailing":
      return { name: "Pset_RailingCommon", props: makeRailingCommonPset(t, length, p) };
    case "IfcCovering":
      return { name: "Pset_CoveringCommon", props: makeCoveringCommonPset(t, length, p) };
    case "IfcDoor":
      return { name: "Pset_DoorCommon", props: makeDoorCommonPset(t, length, p) };
    case "IfcWindow":
      return { name: "Pset_WindowCommon", props: makeWindowCommonPset(t, length, p) };
    case "IfcFooting":
      return { name: "Pset_FootingCommon", props: makeFootingCommonPset(t, length, p) };
    case "IfcPile":
      return { name: "Pset_PileCommon", props: makePileCommonPset(t, length, p) };
    default:
      return { name: "Pset_ElementCommon", props: base(t, length, p) };
  }
}
