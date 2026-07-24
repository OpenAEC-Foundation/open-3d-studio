import * as WebIFC from "web-ifc";
import type { ElementJoin, GridConfig, PlacedElement, ProjectOrigin, Storey, TypeDefinition } from "./types";
import { getTemplate } from "../catalog/registry";
import { elementOpenings, elementSolids } from "./meshBuilder";
import { entityMakers, makeCommonProps } from "./ifcEntityMap";
import { commonPsetFor } from "./psetFactories";
import { materialThermalProps, thermalPsetProps } from "./thermal";
import { getIfcApi, newIfcGuid } from "./ifcCommon";

const { IFC4 } = WebIFC;

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
    /** v0.7-S3: verbindingen → IfcRelConnectsPathElements */
    joins?: ElementJoin[];
    /** v0.7-S5: benoemde typen → IfcType-namen */
    types?: TypeDefinition[];
  } = {},
): Promise<Uint8Array> {
  const projectName = opts.projectName ?? "Open 3D Studio — Storax componenten";
  const origin = opts.origin ?? { x: 0, y: 0, z: 0 };
  const storeys: Storey[] =
    opts.storeys && opts.storeys.length > 0
      ? [...opts.storeys].sort((a, b) => a.elevation - b.elevation)
      : [{ id: "storey-0", name: "00 begane grond", elevation: 0 }];
  const api = await getIfcApi();

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
  // WHERE-regel IfcOwnerHistory.CorrectChangeAction: bij ChangeAction .ADDED.
  // is LastModifiedDate verplicht. Voor een verse export is "laatst gewijzigd"
  // gelijk aan "aangemaakt".
  const created = new IFC4.IfcTimeStamp(Math.floor(Date.now() / 1000));
  const ownerHistory = new IFC4.IfcOwnerHistory(
    personOrg,
    application,
    null,
    IFC4.IfcChangeActionEnum.ADDED,
    created,
    null,
    null,
    created,
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
  // v0.4-productie: index element → product-instantie, gebruikt voor
  // MaterialLayerSet-koppeling en RelFillsElement (kozijnen-hosting).
  const productByElementId = new Map<string, IfcProductInstance>();
  const templateByElementId = new Map<string, ReturnType<typeof getTemplate>>();

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

    // geometrie: dezelfde solids-definitie als de 3D-weergave (incl. sparingen)
    const items: InstanceType<typeof IFC4.IfcExtrudedAreaSolid>[] = [];
    const colorHex = template.color(el.params);
    const solids = elementSolids(template, length, el.params, elementOpenings(el));
    for (const s of solids) {
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
    // Generieke entity-mapper (v0.4-S1) — dekt alle 14 IFC-entiteiten in de v0.4-bibliotheek
    // met correcte PredefinedType en Common-Pset per entity (BIM basis ILS eis 3 en 7).
    const makers = entityMakers(template, solids);
    const product = makers.product([...common] as any[]);
    const commonPsetInfo = commonPsetFor(template, length, el.params);
    // Merge: mapper levert entity-specifieke pset-naam; factory levert de props.
    const commonPset = { name: makers.psetName, props: commonPsetInfo.props };
    products.push(product);
    productByElementId.set(el.id, product);
    templateByElementId.set(el.id, template);
    const storeyKey = el.storeyId && storeyMap.has(el.storeyId) ? el.storeyId : storeys[0].id;
    byStorey.set(storeyKey, [...(byStorey.get(storeyKey) ?? []), product]);

    // type-groepering (IfcTypes): benoemd type (v0.7-S5) wint; anders zelfde
    // template + zelfde type-parameters = zelfde impliciete type
    const { basisHoogte: _b, ...typeParams } = el.params as Record<string, unknown>;
    const typeKey = el.typeId ?? `${el.templateId}|${JSON.stringify(typeParams)}`;
    const typeGroup = byType.get(typeKey) ?? { products: [], template, merk: el.merk ?? "" };
    typeGroup.products.push(product);
    if (el.merk) typeGroup.merk = el.merk;
    byType.set(typeKey, typeGroup);

    // sparingen als IfcOpeningElement (geometrie is al doorgesneden; semantiek conform ILS)
    for (const op of elementOpenings(el)) {
      const depth = template.depth(el.params) + 0.02;
      const zB = op.zBottom ?? 0;
      const openingPlacement = new IFC4.IfcLocalPlacement(
        productPlacement,
        new IFC4.IfcAxis2Placement3D(pt3(op.xPos, op.yPos ?? 0, zB), null, null),
      );
      // rond gat: cilinder-profiel; polygoon (v0.8): arbitrary closed profile
      // in het opstaande vlak, geëxtrudeerd door de dikte; rechthoek: rechthoek.
      let openingSolid: InstanceType<typeof IFC4.IfcExtrudedAreaSolid>;
      if (op.shape === "poly" && op.points && op.points.length >= 3) {
        const profile = new IFC4.IfcArbitraryClosedProfileDef(
          IFC4.IfcProfileTypeEnum.AREA,
          null,
          new IFC4.IfcPolyline([
            ...op.points.map(([x, z]) => pt2(x - op.xPos, z - (op.zBottom ?? 0))),
            pt2(op.points[0][0] - op.xPos, op.points[0][1] - (op.zBottom ?? 0)),
          ]),
        );
        // profiel staat in het x-z-vlak → extruderen in y (door de dikte):
        // plaatsing gekanteld met as = Y, refDirection = X
        openingSolid = new IFC4.IfcExtrudedAreaSolid(
          profile,
          new IFC4.IfcAxis2Placement3D(pt3(0, -depth / 2, 0), dir3(0, -1, 0), dir3(1, 0, 0)),
          dir3(0, 0, 1),
          plen(depth),
        );
      } else {
        const profile =
          op.shape === "round"
            ? new IFC4.IfcCircleProfileDef(
                IFC4.IfcProfileTypeEnum.AREA,
                null,
                new IFC4.IfcAxis2Placement2D(pt2(0, 0), null),
                plen(op.breedte / 2),
              )
            : new IFC4.IfcRectangleProfileDef(
                IFC4.IfcProfileTypeEnum.AREA,
                null,
                new IFC4.IfcAxis2Placement2D(pt2(0, 0), null),
                plen(op.breedte),
                plen(depth),
              );
        openingSolid = new IFC4.IfcExtrudedAreaSolid(
          profile,
          new IFC4.IfcAxis2Placement3D(pt3(0, 0, 0), null, null),
          dir3(0, 0, 1),
          plen(op.shape === "round" ? op.breedte : op.hoogte),
        );
      }
      const openingElement = new IFC4.IfcOpeningElement(
        guid(),
        ownerHistory,
        label(`Sparing ${el.name}${op.kind ? ` (${op.kind})` : ""}`),
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
    // De kale materiaalkoppeling alleen wanneer er verderop geen rijkere komt:
    // elementen met materiaallagen of een profiel krijgen daar hun eigen
    // IfcRelAssociatesMaterial (LayerSet/ProfileSetUsage), en IfcBuildingElement
    // staat er maximaal één toe (WHERE-regel MaxOneMaterialAssociation).
    if (template.material && !template.materialLayers?.length && !template.profileSpec) {
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
      openings: elementOpenings(el),
      phase: el.phase ?? "new",
      hostId: el.hostId ?? null,
      typeId: el.typeId ?? null,
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
      // Fasering expliciet in de IFC zodat sloop/bestaand herkenbaar blijft
      // voor ontvangers (renovatieprojecten): "new"/"existing"/"demolished"/"temporary".
      new IFC4.IfcPropertySingleValue(ident("Fase"), null, label(el.phase ?? "new"), null),
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

    // standaard-pset (LoadBearing/IsExternal/FireRating/…) conform BIM basis ILS v2.
    // Waardetypen: string→IfcLabel, number→IfcReal, boolean→IfcBoolean.
    const commonProps = makeCommonProps(commonPset.props).map(
      ({ key, value }) => new IFC4.IfcPropertySingleValue(ident(key), null, value, null),
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

  // -- v0.4-productie: MaterialLayerSet voor meerlaagse elementen (BIM basis ILS eis 6) --
  const materialCache = new Map<string, InstanceType<typeof IFC4.IfcMaterial>>();
  const getIfcMaterial = (materialName: string) => {
    if (!materialCache.has(materialName)) {
      materialCache.set(materialName, new IFC4.IfcMaterial(label(materialName), null, null));
    }
    return materialCache.get(materialName)!;
  };
  // v0.5: verzamel alle unieke λ-waarden over alle templates zodat we per IfcMaterial
  // één Pset_MaterialThermal kunnen aanmaken. Doen we later, na de layer-loop.
  const materialThermal = new Map<string, number>();
  for (const el of elements) {
    const template = templateByElementId.get(el.id);
    const product = productByElementId.get(el.id);
    if (!template || !product) continue;
    if (!template.materialLayers || template.materialLayers.length === 0) continue;
    const layers = template.materialLayers.map(
      (layer) =>
        new IFC4.IfcMaterialLayer(
          getIfcMaterial(layer.material),
          plen(layer.thicknessMm * MM),
          layer.isVentilated !== undefined ? new IFC4.IfcLogical(layer.isVentilated) : null,
          label(layer.material),
          null,
          layer.category ? label(layer.category) : null,
          null,
        ),
    );
    const layerSet = new IFC4.IfcMaterialLayerSet(layers, label(`${template.name} lagen`), null);
    const usage = new IFC4.IfcMaterialLayerSetUsage(
      layerSet,
      IFC4.IfcLayerSetDirectionEnum.AXIS2,
      IFC4.IfcDirectionSenseEnum.POSITIVE,
      new IFC4.IfcLengthMeasure(-template.depth(el.params) / 2),
      null,
    );
    relRoots.push(
      new IFC4.IfcRelAssociatesMaterial(
        guid(),
        ownerHistory,
        label("MaterialLayerSet"),
        null,
        [product],
        usage,
      ),
    );
    // v0.5: λ per materiaal in de layerset registreren voor Pset_MaterialThermal
    for (const [name, { lambda }] of materialThermalProps(template.materialLayers)) {
      if (!materialThermal.has(name)) materialThermal.set(name, lambda);
    }
    // v0.5: Storax_Thermal (Rc/Rsi/Rse/U) op elk element met een berekende Rc,
    // plus Pset_WallCommon.ThermalTransmittance (U) waar mogelijk.
    const thermalProps = thermalPsetProps(template);
    if (thermalProps) {
      const props = Object.entries(thermalProps).map(([key, value]) =>
        new IFC4.IfcPropertySingleValue(
          ident(key), null,
          typeof value === "number" ? real(value) : label(String(value)),
          null,
        ),
      );
      relRoots.push(
        new IFC4.IfcRelDefinesByProperties(guid(), ownerHistory, null, null, [product],
          new IFC4.IfcPropertySet(guid(), ownerHistory, label("Storax_Thermal"), null, props),
        ),
      );
    }
  }

  // -- v0.5: Pset_MaterialThermal op elk IfcMaterial met λ --
  for (const [materialName, lambda] of materialThermal) {
    const material = getIfcMaterial(materialName);
    const props = [
      new IFC4.IfcPropertySingleValue(
        ident("ThermalConductivity"), null, real(lambda), null,
      ),
      new IFC4.IfcPropertySingleValue(
        ident("SpecificHeatCapacity"), null, real(1000), null,
      ),
    ];
    api.WriteLine(
      modelID,
      new IFC4.IfcMaterialProperties(
        label("Pset_MaterialThermal"), null, props, material,
      ),
    );
  }

  // -- v0.4-productie: MaterialProfileSetUsage voor staal/hout/beton profielen --
  for (const el of elements) {
    const template = templateByElementId.get(el.id);
    const product = productByElementId.get(el.id);
    if (!template || !product) continue;
    if (!template.profileSpec) continue;
    const spec = template.profileSpec;
    const d = spec.dimensions;
    const p2 = new IFC4.IfcAxis2Placement2D(pt2(0, 0), null);
    let profileDef: any;
    switch (spec.shape) {
      case "IShape":
        profileDef = new IFC4.IfcIShapeProfileDef(
          IFC4.IfcProfileTypeEnum.AREA, label(spec.designation), p2,
          plen((d.OverallWidth ?? 100) * MM),
          plen((d.OverallDepth ?? 200) * MM),
          plen((d.WebThickness ?? 6) * MM),
          plen((d.FlangeThickness ?? 10) * MM),
          d.FilletRadius ? plen(d.FilletRadius * MM) : null,
          null, null,
        );
        break;
      case "UShape":
        profileDef = new IFC4.IfcUShapeProfileDef(
          IFC4.IfcProfileTypeEnum.AREA, label(spec.designation), p2,
          plen((d.OverallDepth ?? 100) * MM),
          plen((d.FlangeWidth ?? 50) * MM),
          plen((d.WebThickness ?? 6) * MM),
          plen((d.FlangeThickness ?? 10) * MM),
          d.FilletRadius ? plen(d.FilletRadius * MM) : null,
          null, null,
        );
        break;
      case "LShape":
        profileDef = new IFC4.IfcLShapeProfileDef(
          IFC4.IfcProfileTypeEnum.AREA, label(spec.designation), p2,
          plen((d.Depth ?? 50) * MM),
          plen((d.Width ?? 50) * MM),
          plen((d.Thickness ?? 5) * MM),
          d.FilletRadius ? plen(d.FilletRadius * MM) : null,
          null, null,
        );
        break;
      case "RectangleHollow":
        profileDef = new IFC4.IfcRectangleHollowProfileDef(
          IFC4.IfcProfileTypeEnum.AREA, label(spec.designation), p2,
          plen((d.XDim ?? 100) * MM),
          plen((d.YDim ?? 100) * MM),
          plen((d.WallThickness ?? 5) * MM),
          null, null,
        );
        break;
      case "CircleHollow":
        profileDef = new IFC4.IfcCircleHollowProfileDef(
          IFC4.IfcProfileTypeEnum.AREA, label(spec.designation), p2,
          plen((d.Radius ?? 100) * MM),
          plen((d.WallThickness ?? 5) * MM),
        );
        break;
      case "Rectangle":
        profileDef = new IFC4.IfcRectangleProfileDef(
          IFC4.IfcProfileTypeEnum.AREA, label(spec.designation), p2,
          plen((d.XDim ?? 200) * MM),
          plen((d.YDim ?? 100) * MM),
        );
        break;
      case "Circle":
        profileDef = new IFC4.IfcCircleProfileDef(
          IFC4.IfcProfileTypeEnum.AREA, label(spec.designation), p2,
          plen((d.Radius ?? 100) * MM),
        );
        break;
      default:
        continue;
    }
    const materialName = template.material ?? "Staal S235";
    const matProfile = new IFC4.IfcMaterialProfile(
      label(spec.designation), null, getIfcMaterial(materialName), profileDef, null, null,
    );
    const matProfileSet = new IFC4.IfcMaterialProfileSet(
      label(`${spec.designation} set`), null, [matProfile], null,
    );
    const usage = new IFC4.IfcMaterialProfileSetUsage(matProfileSet, null, null);
    relRoots.push(
      new IFC4.IfcRelAssociatesMaterial(
        guid(),
        ownerHistory,
        label("MaterialProfileSetUsage"),
        null,
        [product],
        usage,
      ),
    );
  }

  // -- v0.4-productie: hosting-relatie voor deuren/ramen (IfcRelFillsElement) --
  for (const el of elements) {
    if (!el.hostId) continue;
    const template = templateByElementId.get(el.id);
    if (!template) continue;
    if (template.ifcEntity !== "IfcDoor" && template.ifcEntity !== "IfcWindow") continue;
    const filling = productByElementId.get(el.id);
    const host = productByElementId.get(el.hostId);
    const hostTemplate = templateByElementId.get(el.hostId);
    if (!filling || !host || !hostTemplate) continue;

    // Opening in de host-wand: rechthoekige uitsparing met kozijn-envelope-maten.
    const solids = elementSolids(template, 1, el.params, elementOpenings(el));
    let width = 0, height = 0;
    for (const s of solids) {
      width = Math.max(width, s.dx);
      height = Math.max(height, s.zBottom + s.dz);
    }
    if (width < 0.05 || height < 0.05) continue;
    const hostDepth = hostTemplate.depth(el.params) + 0.02;
    // Positioneer opening op midden van het kozijn geprojecteerd op de wand-as.
    const openingPlacement = new IFC4.IfcLocalPlacement(
      host.ObjectPlacement ?? null,
      new IFC4.IfcAxis2Placement3D(pt3(width / 2, 0, 0), null, null),
    );
    const openingSolid = new IFC4.IfcExtrudedAreaSolid(
      new IFC4.IfcRectangleProfileDef(
        IFC4.IfcProfileTypeEnum.AREA, null,
        new IFC4.IfcAxis2Placement2D(pt2(0, 0), null),
        plen(width), plen(hostDepth),
      ),
      new IFC4.IfcAxis2Placement3D(pt3(0, 0, 0), null, null),
      dir3(0, 0, 1), plen(height),
    );
    const openingElement = new IFC4.IfcOpeningElement(
      guid(), ownerHistory,
      label(`Sparing voor ${el.name}`), null, null,
      openingPlacement,
      new IFC4.IfcProductDefinitionShape(null, null, [
        new IFC4.IfcShapeRepresentation(context, label("Body"), label("SweptSolid"), [openingSolid]),
      ]),
      null,
      IFC4.IfcOpeningElementTypeEnum.OPENING,
    );
    relRoots.push(
      new IFC4.IfcRelVoidsElement(guid(), ownerHistory, null, null, host, openingElement),
    );
    relRoots.push(
      new IFC4.IfcRelFillsElement(guid(), ownerHistory, null, null, openingElement, filling),
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

  // -- IfcTypes: benoemd type (v0.7-S5) krijgt zijn eigen naam; impliciete typen
  //    (template + typeparameters) een volgnummer. Géén merk als typenaam — een merk
  //    hangt (via lengte) aan instanties en één type kan meerdere merken omvatten. --
  const namedTypes = new Map((opts.types ?? []).map((t) => [t.id, t]));
  const typeCounters = new Map<string, number>();
  for (const [typeKey, group] of byType) {
    const t = group.template;
    const named = namedTypes.get(typeKey);
    let name: string;
    if (named) {
      name = named.name;
    } else {
      const nr = (typeCounters.get(t.id) ?? 0) + 1;
      typeCounters.set(t.id, nr);
      name = `${t.name} type ${String(nr).padStart(2, "0")}`;
    }
    const typeArgs = [
      guid(), ownerHistory, label(name), null, null, null, null, null, label(t.name),
    ] as const;
    // Generieke type-factory via entity-mapper (v0.4-S1).
    const typeMakers = entityMakers(t, t.solids(1, t.defaults));
    const typeEntity = typeMakers.type([...typeArgs] as any[]);
    // Entiteiten zonder typebegrip in IFC4 (sparingen) leveren geen type.
    if (!typeEntity) continue;
    api.WriteLine(
      modelID,
      new IFC4.IfcRelDefinesByType(guid(), ownerHistory, null, null, group.products, typeEntity),
    );
  }

  // -- v0.7-S3: verbindingen als IfcRelConnectsPathElements (L: ATSTART/ATEND, T: ATPATH) --
  const connEnum = (end: "start" | "end" | "path") =>
    end === "start"
      ? IFC4.IfcConnectionTypeEnum.ATSTART
      : end === "end"
        ? IFC4.IfcConnectionTypeEnum.ATEND
        : IFC4.IfcConnectionTypeEnum.ATPATH;
  for (const j of opts.joins ?? []) {
    const a = productByElementId.get(j.aId);
    const b = productByElementId.get(j.bId);
    if (!a || !b) continue;
    try {
      api.WriteLine(
        modelID,
        new IFC4.IfcRelConnectsPathElements(
          guid(), ownerHistory,
          label("Verbinding"), null, null,
          a as any, b as any,
          [], [],
          // arg-volgorde in IFC4: RelatedConnectionType (b) vóór RelatingConnectionType (a)
          connEnum(j.bEnd), connEnum(j.aEnd),
        ),
      );
    } catch (err) {
      console.warn("IfcRelConnectsPathElements niet geserialiseerd:", err);
    }
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
