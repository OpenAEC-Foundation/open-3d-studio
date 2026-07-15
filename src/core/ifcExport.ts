import * as WebIFC from "web-ifc";
import type { GridConfig, PlacedElement, ProjectOrigin, Storey } from "./types";
import { getTemplate } from "../catalog/registry";
import { elementSolids } from "./meshBuilder";

const { IFC4 } = WebIFC;

/** IFC-GUID: 128 bits gecodeerd als 22 tekens in het IFC-base64-alfabet. */
const GUID_CHARS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";

function newIfcGuid(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let num = 0n;
  for (const b of bytes) num = (num << 8n) | BigInt(b);
  let out = GUID_CHARS[Number(num >> 126n)];
  for (let i = 20; i >= 0; i--) {
    out += GUID_CHARS[Number((num >> BigInt(i * 6)) & 63n)];
  }
  return out;
}

const MM = 0.001;

/** Exporteert de geplaatste elementen als zelfstandig IFC4-aspectmodel.
 *  Coördinaten: three.js (y omhoog) -> IFC (z omhoog): x=x, y=-z, z=y. Meters.
 *  Alle coördinaten worden relatief aan het ingestelde projectnulpunt geschreven.
 */
export async function exportElementsToIfc(
  elements: PlacedElement[],
  opts: {
    origin?: ProjectOrigin;
    projectName?: string;
    storeys?: Storey[];
    grid?: GridConfig;
    /** RD-georeferentie (EPSG:28992), meters */
    geoRef?: { rdX: number; rdY: number; napZ: number };
  } = {},
): Promise<Uint8Array> {
  const projectName = opts.projectName ?? "Open 3D Studio — Storax componenten";
  const origin = opts.origin ?? { x: 0, y: 0, z: 0 };
  const storeys: Storey[] =
    opts.storeys && opts.storeys.length > 0
      ? [...opts.storeys].sort((a, b) => a.elevation - b.elevation)
      : [{ id: "storey-0", name: "00 begane grond", elevation: 0 }];
  const api = new WebIFC.IfcAPI();
  api.SetWasmPath("/wasm/", true);
  await api.Init();

  const modelID = api.CreateModel({
    schema: WebIFC.Schemas.IFC4,
    name: projectName,
    authors: ["Open 3D Studio"],
    organizations: ["OpenAEC"],
    authorization: "none",
  });

  // -- verkorte constructors voor waardetypen --
  const label = (v: string) => new IFC4.IfcLabel(v);
  const text = (v: string) => new IFC4.IfcText(v);
  const ident = (v: string) => new IFC4.IfcIdentifier(v);
  const len = (v: number) => new IFC4.IfcLengthMeasure(v);
  const plen = (v: number) => new IFC4.IfcPositiveLengthMeasure(v);
  const real = (v: number) => new IFC4.IfcReal(v);
  const guid = () => new IFC4.IfcGloballyUniqueId(newIfcGuid());
  const pt3 = (x: number, y: number, z: number) =>
    new IFC4.IfcCartesianPoint([len(x), len(y), len(z)]);
  const pt2 = (x: number, y: number) => new IFC4.IfcCartesianPoint([len(x), len(y)]);
  const dir3 = (x: number, y: number, z: number) =>
    new IFC4.IfcDirection([real(x), real(y), real(z)]);

  // -- eigenaar/historie --
  const person = new IFC4.IfcPerson(null, label("Open 3D Studio"), null, null, null, null, null, null);
  const organization = new IFC4.IfcOrganization(null, label("OpenAEC"), null, null, null);
  const personOrg = new IFC4.IfcPersonAndOrganization(person, organization, null);
  const application = new IFC4.IfcApplication(
    organization,
    label("0.1.0"),
    label("Open 3D Studio"),
    ident("open-3d-studio"),
  );
  const ownerHistory = new IFC4.IfcOwnerHistory(
    personOrg,
    application,
    null,
    IFC4.IfcChangeActionEnum.ADDED,
    null,
    null,
    null,
    new IFC4.IfcTimeStamp(Math.floor(Date.now() / 1000)),
  );

  // -- eenheden (SI, meters) --
  const units = new IFC4.IfcUnitAssignment([
    new IFC4.IfcSIUnit(IFC4.IfcUnitEnum.LENGTHUNIT, null, IFC4.IfcSIUnitName.METRE),
    new IFC4.IfcSIUnit(IFC4.IfcUnitEnum.AREAUNIT, null, IFC4.IfcSIUnitName.SQUARE_METRE),
    new IFC4.IfcSIUnit(IFC4.IfcUnitEnum.VOLUMEUNIT, null, IFC4.IfcSIUnitName.CUBIC_METRE),
    new IFC4.IfcSIUnit(IFC4.IfcUnitEnum.PLANEANGLEUNIT, null, IFC4.IfcSIUnitName.RADIAN),
  ]);

  // -- representatiecontext --
  const worldOrigin = new IFC4.IfcAxis2Placement3D(pt3(0, 0, 0), null, null);
  const context = new IFC4.IfcGeometricRepresentationContext(
    null,
    label("Model"),
    new IFC4.IfcDimensionCount(3),
    real(1e-5),
    worldOrigin,
    null,
  );

  // -- RD-georeferentie (IfcMapConversion, les van Qonic) --
  if (opts.geoRef) {
    const crs = new IFC4.IfcProjectedCRS(
      label("EPSG:28992"),
      text("Amersfoort / RD New — Nederlands stelsel van de Rijksdriehoeksmeting"),
      label("EPSG"),
      label("NAP"),
      null,
      null,
      null,
    );
    api.WriteLine(
      modelID,
      new IFC4.IfcMapConversion(
        context,
        crs,
        len(opts.geoRef.rdX),
        len(opts.geoRef.rdY),
        len(opts.geoRef.napZ),
        real(1),
        real(0),
        real(1),
      ),
    );
  }

  // -- project en ruimtelijke structuur --
  const project = new IFC4.IfcProject(
    guid(),
    ownerHistory,
    label(projectName),
    null,
    null,
    null,
    null,
    [context],
    units,
  );

  const sitePlacement = new IFC4.IfcLocalPlacement(
    null,
    new IFC4.IfcAxis2Placement3D(pt3(0, 0, 0), null, null),
  );
  const site = new IFC4.IfcSite(
    guid(), ownerHistory, label("Terrein"), null, null,
    sitePlacement, null, null,
    IFC4.IfcElementCompositionEnum.ELEMENT,
    null, null, null, null, null,
  );

  const buildingPlacement = new IFC4.IfcLocalPlacement(
    sitePlacement,
    new IFC4.IfcAxis2Placement3D(pt3(0, 0, 0), null, null),
  );
  const building = new IFC4.IfcBuilding(
    guid(), ownerHistory, label("Gebouw"), null, null,
    buildingPlacement, null, null,
    IFC4.IfcElementCompositionEnum.ELEMENT,
    null, null, null,
  );

  // verdiepingen conform BIM basis ILS-naamgeving; peilen relatief aan het nulpunt
  const storeyMap = new Map<
    string,
    {
      entity: InstanceType<typeof IFC4.IfcBuildingStorey>;
      placement: InstanceType<typeof IFC4.IfcLocalPlacement>;
      elevation: number;
    }
  >();
  for (const s of storeys) {
    const elevation = s.elevation - origin.z;
    const placement = new IFC4.IfcLocalPlacement(
      buildingPlacement,
      new IFC4.IfcAxis2Placement3D(pt3(0, 0, elevation), null, null),
    );
    const entity = new IFC4.IfcBuildingStorey(
      guid(), ownerHistory, label(s.name), null, null,
      placement, null, null,
      IFC4.IfcElementCompositionEnum.ELEMENT,
      len(elevation),
    );
    storeyMap.set(s.id, { entity, placement, elevation: s.elevation });
  }
  const firstStorey = storeyMap.get(storeys[0].id)!;

  // -- kleuren: één surface style per unieke kleur --
  const styleCache = new Map<string, InstanceType<typeof IFC4.IfcSurfaceStyle>>();
  const surfaceStyle = (hex: string) => {
    let style = styleCache.get(hex);
    if (!style) {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      const rgb = new IFC4.IfcColourRgb(
        null,
        new IFC4.IfcNormalisedRatioMeasure(r),
        new IFC4.IfcNormalisedRatioMeasure(g),
        new IFC4.IfcNormalisedRatioMeasure(b),
      );
      const shading = new IFC4.IfcSurfaceStyleShading(
        rgb,
        new IFC4.IfcNormalisedRatioMeasure(0),
      );
      style = new IFC4.IfcSurfaceStyle(label(hex), IFC4.IfcSurfaceSide.BOTH, [shading]);
      styleCache.set(hex, style);
    }
    return style;
  };

  // -- elementen --
  type IfcProductInstance =
    | InstanceType<typeof IFC4.IfcWall>
    | InstanceType<typeof IFC4.IfcBeam>
    | InstanceType<typeof IFC4.IfcPlate>;
  const products: IfcProductInstance[] = [];
  const relRoots: WebIFC.IfcLineObject[] = [];
  const styledItems: WebIFC.IfcLineObject[] = [];
  const byNlSfb = new Map<string, IfcProductInstance[]>();
  const byMaterial = new Map<string, IfcProductInstance[]>();
  const byStorey = new Map<string, IfcProductInstance[]>();
  const byType = new Map<string, { products: IfcProductInstance[]; template: ReturnType<typeof getTemplate>; merk: string }>();

  for (const el of elements) {
    const template = getTemplate(el.templateId);
    const dx = el.end.x - el.start.x;
    const dz = el.end.z - el.start.z;
    const length = Math.hypot(dx, dz);
    if (length < 1e-6) continue;

    const storeyRef = storeyMap.get(el.storeyId ?? "") ?? firstStorey;
    const baseZ =
      el.start.y + (typeof el.params.basisHoogte === "number" ? el.params.basisHoogte : 0) * MM;

    // plaatsing: three (x, y-omhoog, z) -> IFC (x, -z, y), relatief aan nulpunt en verdieping
    const productPlacement = new IFC4.IfcLocalPlacement(
      storeyRef.placement,
      new IFC4.IfcAxis2Placement3D(
        pt3(el.start.x - origin.x, -el.start.z - origin.y, baseZ - storeyRef.elevation),
        dir3(0, 0, 1),
        dir3(dx / length, -dz / length, 0),
      ),
    );

    // geometrie: dezelfde solids-definitie als de 3D-weergave (incl. sparing)
    const items: InstanceType<typeof IFC4.IfcExtrudedAreaSolid>[] = [];
    const colorHex = template.color(el.params);
    for (const s of elementSolids(template, length, el.params, el.opening)) {
      const profile = new IFC4.IfcRectangleProfileDef(
        IFC4.IfcProfileTypeEnum.AREA,
        null,
        new IFC4.IfcAxis2Placement2D(pt2(0, 0), null),
        plen(s.dx),
        plen(s.dy),
      );
      const solid = new IFC4.IfcExtrudedAreaSolid(
        profile,
        new IFC4.IfcAxis2Placement3D(pt3(s.cx, s.cy, s.zBottom), null, null),
        dir3(0, 0, 1),
        plen(s.dz),
      );
      items.push(solid);
      styledItems.push(new IFC4.IfcStyledItem(solid, [surfaceStyle(colorHex)], null));
    }

    const bodyRep = new IFC4.IfcShapeRepresentation(
      context,
      label("Body"),
      label("SweptSolid"),
      items,
    );
    const shape = new IFC4.IfcProductDefinitionShape(null, null, [bodyRep]);

    // juiste IFC-entiteit per componenttype (BIM basis ILS)
    const common = [
      guid(),
      ownerHistory,
      label(el.name),
      text(`${template.manufacturer ?? ""} ${template.name}`.trim()),
      label(template.name),
      productPlacement,
      shape,
      null,
    ] as const;
    // LoadBearing/IsExternal per template instelbaar (BIM basis ILS); standaard false
    const loadBearing = template.loadBearing ?? false;
    const isExternal = template.isExternal ?? false;
    let product: IfcProductInstance;
    let commonPset: { name: string; props: Record<string, boolean> };
    switch (template.ifcEntity) {
      case "IfcBeam":
        product = new IFC4.IfcBeam(...common, IFC4.IfcBeamTypeEnum.BEAM);
        commonPset = { name: "Pset_BeamCommon", props: { LoadBearing: loadBearing, IsExternal: isExternal } };
        break;
      case "IfcPlate":
        // USERDEFINED + ObjectType: een roosterpaneel is geen vliesgevelpaneel
        product = new IFC4.IfcPlate(...common, IFC4.IfcPlateTypeEnum.USERDEFINED);
        commonPset = { name: "Pset_PlateCommon", props: { LoadBearing: loadBearing, IsExternal: isExternal } };
        break;
      default:
        product = new IFC4.IfcWall(...common, IFC4.IfcWallTypeEnum.USERDEFINED);
        commonPset = { name: "Pset_WallCommon", props: { LoadBearing: loadBearing, IsExternal: isExternal } };
    }
    products.push(product);
    const storeyKey = el.storeyId && storeyMap.has(el.storeyId) ? el.storeyId : storeys[0].id;
    byStorey.set(storeyKey, [...(byStorey.get(storeyKey) ?? []), product]);

    // type-groepering (IfcTypes): zelfde template + zelfde type-parameters = zelfde type
    const { basisHoogte: _b, ...typeParams } = el.params as Record<string, unknown>;
    const typeKey = `${el.templateId}|${JSON.stringify(typeParams)}`;
    const typeGroup = byType.get(typeKey) ?? { products: [], template, merk: el.merk ?? "" };
    typeGroup.products.push(product);
    if (el.merk) typeGroup.merk = el.merk;
    byType.set(typeKey, typeGroup);

    // sparing als IfcOpeningElement (geometrie is al doorgesneden; semantiek conform ILS)
    if (el.opening) {
      const op = el.opening;
      const depth = template.depth(el.params) + 0.02;
      const openingPlacement = new IFC4.IfcLocalPlacement(
        productPlacement,
        new IFC4.IfcAxis2Placement3D(pt3(op.xPos, 0, 0), null, null),
      );
      const openingSolid = new IFC4.IfcExtrudedAreaSolid(
        new IFC4.IfcRectangleProfileDef(
          IFC4.IfcProfileTypeEnum.AREA,
          null,
          new IFC4.IfcAxis2Placement2D(pt2(0, 0), null),
          plen(op.breedte),
          plen(depth),
        ),
        new IFC4.IfcAxis2Placement3D(pt3(0, 0, 0), null, null),
        dir3(0, 0, 1),
        plen(op.hoogte),
      );
      const openingElement = new IFC4.IfcOpeningElement(
        guid(),
        ownerHistory,
        label(`Sparing ${el.name}`),
        null,
        null,
        openingPlacement,
        new IFC4.IfcProductDefinitionShape(null, null, [
          new IFC4.IfcShapeRepresentation(context, label("Body"), label("SweptSolid"), [openingSolid]),
        ]),
        null,
        IFC4.IfcOpeningElementTypeEnum.OPENING,
      );
      relRoots.push(
        new IFC4.IfcRelVoidsElement(guid(), ownerHistory, null, null, product, openingElement),
      );
    }

    if (template.nlSfb) {
      const list = byNlSfb.get(template.nlSfb) ?? [];
      list.push(product);
      byNlSfb.set(template.nlSfb, list);
    }
    if (template.material) {
      const list = byMaterial.get(template.material) ?? [];
      list.push(product);
      byMaterial.set(template.material, list);
    }

    // property set met alle parameters + merk + round-trip-data
    const o3sStorey = storeys.find((s) => s.id === el.storeyId);
    const o3sData = JSON.stringify({
      templateId: el.templateId,
      name: el.name,
      start: [el.start.x, el.start.y, el.start.z],
      end: [el.end.x, el.end.y, el.end.z],
      params: el.params,
      storeyId: el.storeyId,
      // naam + peil zodat heropenen de verdiepingsindeling kan herstellen
      storeyName: o3sStorey?.name,
      storeyElevation: o3sStorey?.elevation,
      opening: el.opening ?? null,
    });
    const props = [
      ...Object.entries(template.psetProps(length, el.params)).map(
        ([key, value]) =>
          new IFC4.IfcPropertySingleValue(
            ident(key),
            null,
            typeof value === "number" ? real(value) : label(String(value)),
            null,
          ),
      ),
      new IFC4.IfcPropertySingleValue(ident("Merk"), null, label(el.merk ?? ""), null),
      new IFC4.IfcPropertySingleValue(ident("O3S_Data"), null, text(o3sData), null),
    ];
    const pset = new IFC4.IfcPropertySet(
      guid(),
      ownerHistory,
      label(template.psetName),
      null,
      props,
    );
    relRoots.push(
      new IFC4.IfcRelDefinesByProperties(guid(), ownerHistory, null, null, [product], pset),
    );

    // standaard-pset (LoadBearing/IsExternal) conform BIM basis ILS
    const commonProps = Object.entries(commonPset.props).map(
      ([key, value]) =>
        new IFC4.IfcPropertySingleValue(ident(key), null, new IFC4.IfcBoolean(value), null),
    );
    relRoots.push(
      new IFC4.IfcRelDefinesByProperties(
        guid(),
        ownerHistory,
        null,
        null,
        [product],
        new IFC4.IfcPropertySet(guid(), ownerHistory, label(commonPset.name), null, commonProps),
      ),
    );
  }

  // -- NL-SfB-classificatie en materiaal (BIM basis ILS) --
  if (byNlSfb.size > 0) {
    const classification = new IFC4.IfcClassification(
      label("BNA"),
      label("2005"),
      null,
      label("NL-SfB"),
      null,
      null,
      null,
    );
    for (const [code, prods] of byNlSfb) {
      const reference = new IFC4.IfcClassificationReference(
        null,
        ident(code),
        label(`NL-SfB ${code}`),
        classification,
        null,
        null,
      );
      relRoots.push(
        new IFC4.IfcRelAssociatesClassification(
          guid(),
          ownerHistory,
          label("NL-SfB"),
          null,
          prods,
          reference,
        ),
      );
    }
  }
  for (const [name, prods] of byMaterial) {
    relRoots.push(
      new IFC4.IfcRelAssociatesMaterial(
        guid(),
        ownerHistory,
        null,
        null,
        prods,
        new IFC4.IfcMaterial(label(name), null, null),
      ),
    );
  }

  // -- relaties (schrijven vanaf de wortels; WriteLine schrijft genest alles weg) --
  api.WriteLine(modelID, project);
  api.WriteLine(
    modelID,
    new IFC4.IfcRelAggregates(guid(), ownerHistory, null, null, project, [site]),
  );
  api.WriteLine(
    modelID,
    new IFC4.IfcRelAggregates(guid(), ownerHistory, null, null, site, [building]),
  );
  api.WriteLine(
    modelID,
    new IFC4.IfcRelAggregates(
      guid(),
      ownerHistory,
      null,
      null,
      building,
      [...storeyMap.values()].map((s) => s.entity),
    ),
  );
  for (const [storeyId, storeyProducts] of byStorey) {
    if (storeyProducts.length === 0) continue;
    api.WriteLine(
      modelID,
      new IFC4.IfcRelContainedInSpatialStructure(
        guid(),
        ownerHistory,
        label("Elementen op verdieping"),
        null,
        storeyProducts,
        storeyMap.get(storeyId)!.entity,
      ),
    );
  }

  // -- IfcTypes: template + typeparameters = één type, instanties gekoppeld via RelDefinesByType.
  //    NB: het type krijgt een eigen volgnummer, géén merk — een merk hangt (via lengte)
  //    aan instanties en één type kan meerdere merken omvatten. --
  const typeCounters = new Map<string, number>();
  for (const [, group] of byType) {
    const t = group.template;
    const nr = (typeCounters.get(t.id) ?? 0) + 1;
    typeCounters.set(t.id, nr);
    const typeName = label(`${t.name} type ${String(nr).padStart(2, "0")}`);
    const typeArgs = [
      guid(), ownerHistory, typeName, null, null, null, null, null, label(t.name),
    ] as const;
    let typeEntity;
    switch (t.ifcEntity) {
      case "IfcBeam":
        typeEntity = new IFC4.IfcBeamType(...typeArgs, IFC4.IfcBeamTypeEnum.BEAM);
        break;
      case "IfcPlate":
        typeEntity = new IFC4.IfcPlateType(...typeArgs, IFC4.IfcPlateTypeEnum.USERDEFINED);
        break;
      default:
        typeEntity = new IFC4.IfcWallType(...typeArgs, IFC4.IfcWallTypeEnum.USERDEFINED);
    }
    api.WriteLine(
      modelID,
      new IFC4.IfcRelDefinesByType(guid(), ownerHistory, null, null, group.products, typeEntity),
    );
  }

  // -- stramien (IfcGrid) op de onderste bouwlaag --
  if (opts.grid?.enabled) {
    const g = opts.grid;
    const lenX = (g.countX - 1) * g.spacingX;
    const lenY = (g.countY - 1) * g.spacingY;
    const margin = 1.2;
    const axis = (tag: string, a: [number, number], b: [number, number]) =>
      new IFC4.IfcGridAxis(
        label(tag),
        new IFC4.IfcPolyline([pt2(a[0] - origin.x, a[1] - origin.y), pt2(b[0] - origin.x, b[1] - origin.y)]),
        new IFC4.IfcBoolean(true),
      );
    const uAxes = [];
    for (let i = 0; i < g.countX; i++) {
      uAxes.push(axis(String(i + 1), [i * g.spacingX, -margin], [i * g.spacingX, lenY + margin]));
    }
    const vAxes = [];
    for (let j = 0; j < g.countY; j++) {
      vAxes.push(axis(String.fromCharCode(65 + j), [-margin, j * g.spacingY], [lenX + margin, j * g.spacingY]));
    }
    const gridEntity = new IFC4.IfcGrid(
      guid(), ownerHistory, label("Stramien"), null, null,
      new IFC4.IfcLocalPlacement(firstStorey.placement, new IFC4.IfcAxis2Placement3D(pt3(0, 0, 0), null, null)),
      null, uAxes, vAxes, null, null,
    );
    api.WriteLine(
      modelID,
      new IFC4.IfcRelContainedInSpatialStructure(
        guid(), ownerHistory, label("Stramien"), null, [gridEntity], firstStorey.entity,
      ),
    );
  }
  for (const rel of relRoots) api.WriteLine(modelID, rel);
  for (const styled of styledItems) api.WriteLine(modelID, styled);

  const bytes = api.SaveModel(modelID);
  api.CloseModel(modelID);
  return bytes;
}
