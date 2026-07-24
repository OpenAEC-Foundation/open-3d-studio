import * as WebIFC from "web-ifc";
import type { ComponentTemplate, IfcEntityName } from "./types";
import type { SolidBox } from "./types";

const { IFC4 } = WebIFC;

/** Mapping van IFC-entiteit → constructor + PredefinedType-enum + Pset-naam.
 *
 *  Bevat alle 14+ entiteiten die de v0.4-bibliotheek gebruikt. De factories
 *  accepteren de "algemene" 8 args die alle IfcElement-varianten delen
 *  (guid, ownerHistory, name, description, objectType, placement,
 *  representation, tag) en voegen de entity-specifieke extra args toe.
 *
 *  Web-ifc constructors zijn niet strict getypeerd voor spread — de `ctor()`-helper
 *  wrapt dat af zonder de type-checks van de call sites te verliezen.
 *
 *  Als een template een `ifcPredefinedType` opgeeft die niet in de enum staat,
 *  vallen we terug op `USERDEFINED` + `ifcObjectType`. */

// Constructor-helper — zet de spread-cast op één plek in plaats van op elke call.
// Vult bovendien aan tot de volledige constructor-arity: web-ifc schrijft een
// ontbrekend argument als STEP `*` ("afgeleid attribuut"), en dat is buiten
// afgeleide attributen schema-ongeldig. Gemeten door de IFC-poort
// (tests/validate_ifc.py): IfcDoorType/IfcWindowType misten hun laatste
// attribuut en kregen `*` waar `$` hoort.
function ctor(cls: any, args: any[]): any {
  const filled =
    args.length < cls.length
      ? [...args, ...Array(cls.length - args.length).fill(null)]
      : args;
  return new cls(...filled);
}

export interface EntityMakers {
  product: (common: any[]) => any;
  type: (typeArgs: any[]) => any;
  psetName: string;
  /** Dekking voor `envelope`-berekening: hoogte en breedte in meters (voor Door/Window). */
  needsEnvelope: boolean;
}

function resolveEnum(enumObject: any, key: string | undefined, fallbackKey: string): number {
  if (key && enumObject[key] !== undefined) return enumObject[key];
  return enumObject[fallbackKey];
}

/** Envelope-doos (breedte × hoogte) uit de solids voor Door/Window overall-size. */
function envelope(solids: SolidBox[]): { width: number; height: number } {
  if (!solids.length) return { width: 0, height: 0 };
  let width = 0;
  let height = 0;
  for (const s of solids) {
    width = Math.max(width, Math.abs(s.cx) + s.dx / 2);
    height = Math.max(height, s.zBottom + s.dz);
  }
  return { width, height };
}

export function entityMakers(
  template: ComponentTemplate,
  solids: SolidBox[],
): EntityMakers {
  const entity: IfcEntityName = template.ifcEntity;
  const preName = template.ifcPredefinedType;

  switch (entity) {
    case "IfcWall": {
      const preEnum = () => resolveEnum(IFC4.IfcWallTypeEnum, preName, "USERDEFINED");
      return {
        product: (c) => ctor(IFC4.IfcWall, [...c, preEnum()]),
        type: (a) => ctor(IFC4.IfcWallType, [...a, preEnum()]),
        psetName: "Pset_WallCommon",
        needsEnvelope: false,
      };
    }
    case "IfcSlab": {
      const preEnum = () => resolveEnum(IFC4.IfcSlabTypeEnum, preName, "FLOOR");
      return {
        product: (c) => ctor(IFC4.IfcSlab, [...c, preEnum()]),
        type: (a) => ctor(IFC4.IfcSlabType, [...a, preEnum()]),
        psetName: "Pset_SlabCommon",
        needsEnvelope: false,
      };
    }
    case "IfcBeam": {
      const preEnum = () => resolveEnum(IFC4.IfcBeamTypeEnum, preName, "BEAM");
      return {
        product: (c) => ctor(IFC4.IfcBeam, [...c, preEnum()]),
        type: (a) => ctor(IFC4.IfcBeamType, [...a, preEnum()]),
        psetName: "Pset_BeamCommon",
        needsEnvelope: false,
      };
    }
    case "IfcColumn": {
      const preEnum = () => resolveEnum(IFC4.IfcColumnTypeEnum, preName, "COLUMN");
      return {
        product: (c) => ctor(IFC4.IfcColumn, [...c, preEnum()]),
        type: (a) => ctor(IFC4.IfcColumnType, [...a, preEnum()]),
        psetName: "Pset_ColumnCommon",
        needsEnvelope: false,
      };
    }
    case "IfcPlate": {
      const preEnum = () => resolveEnum(IFC4.IfcPlateTypeEnum, preName, "USERDEFINED");
      return {
        product: (c) => ctor(IFC4.IfcPlate, [...c, preEnum()]),
        type: (a) => ctor(IFC4.IfcPlateType, [...a, preEnum()]),
        psetName: "Pset_PlateCommon",
        needsEnvelope: false,
      };
    }
    case "IfcMember": {
      const preEnum = () => resolveEnum(IFC4.IfcMemberTypeEnum, preName, "MEMBER");
      return {
        product: (c) => ctor(IFC4.IfcMember, [...c, preEnum()]),
        type: (a) => ctor(IFC4.IfcMemberType, [...a, preEnum()]),
        psetName: "Pset_MemberCommon",
        needsEnvelope: false,
      };
    }
    case "IfcRoof": {
      const preEnum = () => resolveEnum(IFC4.IfcRoofTypeEnum, preName, "FLAT_ROOF");
      return {
        product: (c) => ctor(IFC4.IfcRoof, [...c, preEnum()]),
        type: (a) => ctor(IFC4.IfcRoofType, [...a, preEnum()]),
        psetName: "Pset_RoofCommon",
        needsEnvelope: false,
      };
    }
    case "IfcStair": {
      const preEnum = () => resolveEnum(IFC4.IfcStairTypeEnum, preName, "STRAIGHT_RUN_STAIR");
      return {
        product: (c) => ctor(IFC4.IfcStair, [...c, preEnum()]),
        type: (a) => ctor(IFC4.IfcStairType, [...a, preEnum()]),
        psetName: "Pset_StairCommon",
        needsEnvelope: false,
      };
    }
    case "IfcRailing": {
      const preEnum = () => resolveEnum(IFC4.IfcRailingTypeEnum, preName, "BALUSTRADE");
      return {
        product: (c) => ctor(IFC4.IfcRailing, [...c, preEnum()]),
        type: (a) => ctor(IFC4.IfcRailingType, [...a, preEnum()]),
        psetName: "Pset_RailingCommon",
        needsEnvelope: false,
      };
    }
    case "IfcCovering": {
      const preEnum = () => resolveEnum(IFC4.IfcCoveringTypeEnum, preName, "CLADDING");
      return {
        product: (c) => ctor(IFC4.IfcCovering, [...c, preEnum()]),
        type: (a) => ctor(IFC4.IfcCoveringType, [...a, preEnum()]),
        psetName: "Pset_CoveringCommon",
        needsEnvelope: false,
      };
    }
    case "IfcFooting": {
      const preEnum = () => resolveEnum(IFC4.IfcFootingTypeEnum, preName, "STRIP_FOOTING");
      return {
        product: (c) => ctor(IFC4.IfcFooting, [...c, preEnum()]),
        type: (a) => ctor(IFC4.IfcFootingType, [...a, preEnum()]),
        psetName: "Pset_FootingCommon",
        needsEnvelope: false,
      };
    }
    case "IfcPile": {
      const preEnum = () => resolveEnum(IFC4.IfcPileTypeEnum, preName, "COHESION");
      const constructionEnum = () =>
        resolveEnum(IFC4.IfcPileConstructionEnum, undefined, "CAST_IN_PLACE");
      return {
        product: (c) => ctor(IFC4.IfcPile, [...c, preEnum(), constructionEnum()]),
        type: (a) => ctor(IFC4.IfcPileType, [...a, preEnum()]),
        psetName: "Pset_PileCommon",
        needsEnvelope: false,
      };
    }
    case "IfcDoor": {
      const env = envelope(solids);
      const overallHeight = env.height > 0 ? new IFC4.IfcPositiveLengthMeasure(env.height) : null;
      const overallWidth = env.width > 0 ? new IFC4.IfcPositiveLengthMeasure(env.width) : null;
      const preEnum = () => resolveEnum(IFC4.IfcDoorTypeEnum, preName, "DOOR");
      const opEnum = () => resolveEnum(IFC4.IfcDoorTypeOperationEnum, undefined, "NOTDEFINED");
      return {
        product: (c) => ctor(IFC4.IfcDoor, [...c, overallHeight, overallWidth, preEnum(), opEnum(), null]),
        // 4 staartargumenten: PredefinedType, OperationType, ParameterTakesPrecedence,
        // UserDefinedOperationType — de laatste ontbrak en werd `*` in de STEP.
        type: (a) => ctor(IFC4.IfcDoorType, [...a, preEnum(), opEnum(), null, null]),
        psetName: "Pset_DoorCommon",
        needsEnvelope: true,
      };
    }
    case "IfcWindow": {
      const env = envelope(solids);
      const overallHeight = env.height > 0 ? new IFC4.IfcPositiveLengthMeasure(env.height) : null;
      const overallWidth = env.width > 0 ? new IFC4.IfcPositiveLengthMeasure(env.width) : null;
      const preEnum = () => resolveEnum(IFC4.IfcWindowTypeEnum, preName, "WINDOW");
      const partEnum = () => resolveEnum(IFC4.IfcWindowTypePartitioningEnum, undefined, "NOTDEFINED");
      return {
        product: (c) => ctor(IFC4.IfcWindow, [...c, overallHeight, overallWidth, preEnum(), partEnum(), null]),
        // 4 staartargumenten: PredefinedType, PartitioningType, ParameterTakesPrecedence,
        // UserDefinedPartitioningType — de laatste ontbrak en werd `*` in de STEP.
        type: (a) => ctor(IFC4.IfcWindowType, [...a, preEnum(), partEnum(), null, null]),
        psetName: "Pset_WindowCommon",
        needsEnvelope: true,
      };
    }
    case "IfcSpace": {
      const preEnum = () => resolveEnum(IFC4.IfcSpaceTypeEnum, preName, "INTERNAL");
      const compEnum = () => resolveEnum(IFC4.IfcElementCompositionEnum, undefined, "ELEMENT");
      return {
        product: (c) => ctor(IFC4.IfcSpace, [...c, compEnum(), preEnum(), null]),
        // IfcSpaceType heeft na PredefinedType nog LongName (11 attributen).
        type: (a) => ctor(IFC4.IfcSpaceType, [...a, preEnum(), null]),
        psetName: "Pset_SpaceCommon",
        needsEnvelope: false,
      };
    }
    case "IfcOpeningElement": {
      const preEnum = () => resolveEnum(IFC4.IfcOpeningElementTypeEnum, preName, "OPENING");
      return {
        product: (c) => ctor(IFC4.IfcOpeningElement, [...c, preEnum()]),
        // IFC4 kent géén IfcOpeningElementType (gemeten: web-ifc heeft de klasse
        // niet). De vorige versie schreef hier een tweede IfcOpeningElement met
        // type-argumenten in product-slots. Sparingen krijgen geen type; de
        // export slaat een null-type over.
        type: () => null,
        psetName: "Pset_OpeningElementCommon",
        needsEnvelope: false,
      };
    }
    case "IfcElementAssembly": {
      const placeEnum = () => resolveEnum(IFC4.IfcAssemblyPlaceEnum, undefined, "FACTORY");
      const preEnum = () => resolveEnum(IFC4.IfcElementAssemblyTypeEnum, preName, "USERDEFINED");
      return {
        product: (c) => ctor(IFC4.IfcElementAssembly, [...c, placeEnum(), preEnum()]),
        type: (a) => ctor(IFC4.IfcElementAssemblyType, [...a, preEnum()]),
        psetName: "Pset_ElementAssemblyCommon",
        needsEnvelope: false,
      };
    }
    case "IfcBuildingElementProxy": {
      const preEnum = () => resolveEnum(IFC4.IfcBuildingElementProxyTypeEnum, preName, "ELEMENT");
      return {
        product: (c) => ctor(IFC4.IfcBuildingElementProxy, [...c, preEnum()]),
        type: (a) => ctor(IFC4.IfcBuildingElementProxyType, [...a, preEnum()]),
        psetName: "Pset_BuildingElementProxyCommon",
        needsEnvelope: false,
      };
    }
    // v0.6-3: MEP-basisset. Alle MEP-entiteiten volgen hetzelfde patroon:
    // product krijgt PredefinedType, type krijgt hetzelfde. De Pset-namen
    // volgen buildingSMART-conventies (Pset_<Entity>Common).
    case "IfcPipeSegment": {
      const preEnum = () => resolveEnum(IFC4.IfcPipeSegmentTypeEnum, preName, "RIGIDSEGMENT");
      return {
        product: (c) => ctor(IFC4.IfcPipeSegment, [...c, preEnum()]),
        type: (a) => ctor(IFC4.IfcPipeSegmentType, [...a, preEnum()]),
        psetName: "Pset_PipeSegmentTypeCommon",
        needsEnvelope: false,
      };
    }
    case "IfcPipeFitting": {
      const preEnum = () => resolveEnum(IFC4.IfcPipeFittingTypeEnum, preName, "BEND");
      return {
        product: (c) => ctor(IFC4.IfcPipeFitting, [...c, preEnum()]),
        type: (a) => ctor(IFC4.IfcPipeFittingType, [...a, preEnum()]),
        psetName: "Pset_PipeFittingTypeCommon",
        needsEnvelope: false,
      };
    }
    case "IfcDuctSegment": {
      const preEnum = () => resolveEnum(IFC4.IfcDuctSegmentTypeEnum, preName, "RIGIDSEGMENT");
      return {
        product: (c) => ctor(IFC4.IfcDuctSegment, [...c, preEnum()]),
        type: (a) => ctor(IFC4.IfcDuctSegmentType, [...a, preEnum()]),
        psetName: "Pset_DuctSegmentTypeCommon",
        needsEnvelope: false,
      };
    }
    case "IfcDuctFitting": {
      const preEnum = () => resolveEnum(IFC4.IfcDuctFittingTypeEnum, preName, "BEND");
      return {
        product: (c) => ctor(IFC4.IfcDuctFitting, [...c, preEnum()]),
        type: (a) => ctor(IFC4.IfcDuctFittingType, [...a, preEnum()]),
        psetName: "Pset_DuctFittingTypeCommon",
        needsEnvelope: false,
      };
    }
    case "IfcCableSegment": {
      const preEnum = () => resolveEnum(IFC4.IfcCableSegmentTypeEnum, preName, "CABLESEGMENT");
      return {
        product: (c) => ctor(IFC4.IfcCableSegment, [...c, preEnum()]),
        type: (a) => ctor(IFC4.IfcCableSegmentType, [...a, preEnum()]),
        psetName: "Pset_CableSegmentTypeCommon",
        needsEnvelope: false,
      };
    }
    case "IfcCableCarrierSegment": {
      const preEnum = () => resolveEnum(IFC4.IfcCableCarrierSegmentTypeEnum, preName, "CABLELADDERSEGMENT");
      return {
        product: (c) => ctor(IFC4.IfcCableCarrierSegment, [...c, preEnum()]),
        type: (a) => ctor(IFC4.IfcCableCarrierSegmentType, [...a, preEnum()]),
        psetName: "Pset_CableCarrierSegmentTypeCommon",
        needsEnvelope: false,
      };
    }
    case "IfcAirTerminal": {
      const preEnum = () => resolveEnum(IFC4.IfcAirTerminalTypeEnum, preName, "DIFFUSER");
      return {
        product: (c) => ctor(IFC4.IfcAirTerminal, [...c, preEnum()]),
        type: (a) => ctor(IFC4.IfcAirTerminalType, [...a, preEnum()]),
        psetName: "Pset_AirTerminalTypeCommon",
        needsEnvelope: false,
      };
    }
    case "IfcSpaceHeater": {
      const preEnum = () => resolveEnum(IFC4.IfcSpaceHeaterTypeEnum, preName, "RADIATOR");
      return {
        product: (c) => ctor(IFC4.IfcSpaceHeater, [...c, preEnum()]),
        type: (a) => ctor(IFC4.IfcSpaceHeaterType, [...a, preEnum()]),
        psetName: "Pset_SpaceHeaterTypeCommon",
        needsEnvelope: false,
      };
    }
    case "IfcOutlet": {
      const preEnum = () => resolveEnum(IFC4.IfcOutletTypeEnum, preName, "AUDIOVISUALOUTLET");
      return {
        product: (c) => ctor(IFC4.IfcOutlet, [...c, preEnum()]),
        type: (a) => ctor(IFC4.IfcOutletType, [...a, preEnum()]),
        psetName: "Pset_OutletTypeCommon",
        needsEnvelope: false,
      };
    }
    case "IfcSanitaryTerminal": {
      const preEnum = () => resolveEnum(IFC4.IfcSanitaryTerminalTypeEnum, preName, "WASHHANDBASIN");
      return {
        product: (c) => ctor(IFC4.IfcSanitaryTerminal, [...c, preEnum()]),
        type: (a) => ctor(IFC4.IfcSanitaryTerminalType, [...a, preEnum()]),
        psetName: "Pset_SanitaryTerminalTypeCommon",
        needsEnvelope: false,
      };
    }
    case "IfcFlowTerminal": {
      // IfcFlowTerminal is een supertype (abstract in IFC4); voor Open 3D Studio
      // gebruiken we het bewust voor "generieke terminals" die niet in een van
      // de sub-classes vallen. Serialiseren als IfcBuildingElementProxy.
      const preEnum = () => resolveEnum(IFC4.IfcBuildingElementProxyTypeEnum, undefined, "ELEMENT");
      return {
        product: (c) => ctor(IFC4.IfcBuildingElementProxy, [...c, preEnum()]),
        type: (a) => ctor(IFC4.IfcBuildingElementProxyType, [...a, preEnum()]),
        psetName: "Pset_FlowTerminalTypeCommon",
        needsEnvelope: false,
      };
    }
    case "IfcLightFixture": {
      const preEnum = () => resolveEnum(IFC4.IfcLightFixtureTypeEnum, preName, "DIRECTIONSOURCE");
      return {
        product: (c) => ctor(IFC4.IfcLightFixture, [...c, preEnum()]),
        type: (a) => ctor(IFC4.IfcLightFixtureType, [...a, preEnum()]),
        psetName: "Pset_LightFixtureTypeCommon",
        needsEnvelope: false,
      };
    }
    default: {
      // Fallback: onbekende entiteit → als BuildingElementProxy exporteren.
      const preEnum = () =>
        resolveEnum(IFC4.IfcBuildingElementProxyTypeEnum, undefined, "ELEMENT");
      return {
        product: (c) => ctor(IFC4.IfcBuildingElementProxy, [...c, preEnum()]),
        type: (a) => ctor(IFC4.IfcBuildingElementProxyType, [...a, preEnum()]),
        psetName: "Pset_BuildingElementProxyCommon",
        needsEnvelope: false,
      };
    }
  }
}

/** Convert een gemixte Common-Pset-props naar de juiste IfcValue-typed properties. */
export function makeCommonProps(
  props: Record<string, string | number | boolean>,
): Array<{ key: string; value: any }> {
  const out: Array<{ key: string; value: any }> = [];
  for (const [key, val] of Object.entries(props)) {
    if (typeof val === "boolean") {
      out.push({ key, value: new IFC4.IfcBoolean(val) });
    } else if (typeof val === "number") {
      out.push({ key, value: new IFC4.IfcReal(val) });
    } else {
      out.push({ key, value: new IFC4.IfcLabel(val) });
    }
  }
  return out;
}
