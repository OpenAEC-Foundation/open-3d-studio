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
function ctor(cls: any, args: any[]): any {
  return new cls(...args);
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
        type: (a) => ctor(IFC4.IfcDoorType, [...a, preEnum(), opEnum(), null]),
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
        type: (a) => ctor(IFC4.IfcWindowType, [...a, preEnum(), partEnum(), null]),
        psetName: "Pset_WindowCommon",
        needsEnvelope: true,
      };
    }
    case "IfcSpace": {
      const preEnum = () => resolveEnum(IFC4.IfcSpaceTypeEnum, preName, "INTERNAL");
      const compEnum = () => resolveEnum(IFC4.IfcElementCompositionEnum, undefined, "ELEMENT");
      return {
        product: (c) => ctor(IFC4.IfcSpace, [...c, compEnum(), preEnum(), null]),
        type: (a) => ctor(IFC4.IfcSpaceType, [...a, preEnum()]),
        psetName: "Pset_SpaceCommon",
        needsEnvelope: false,
      };
    }
    case "IfcOpeningElement": {
      const preEnum = () => resolveEnum(IFC4.IfcOpeningElementTypeEnum, preName, "OPENING");
      return {
        product: (c) => ctor(IFC4.IfcOpeningElement, [...c, preEnum()]),
        type: (a) => ctor(IFC4.IfcOpeningElement, [...a, preEnum()]),
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
