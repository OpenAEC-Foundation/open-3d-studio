import * as WebIFC from "web-ifc";
import type { PlacedElement, Storey } from "./types";
import { getTemplate } from "../catalog/registry";
import { getIfcApi, newIfcGuid } from "./ifcCommon";

const { IFC4 } = WebIFC;

/** Structural view-export (v0.5-S4).
 *
 *  Levert een zelfstandig IFC4-aspectmodel met:
 *   - IfcStructuralAnalysisModel                          (project-wortel)
 *   - IfcStructuralCurveMember (RIGID_JOINED)             voor dragende balken/kolommen
 *   - IfcStructuralSurfaceMember (SHELL)                  voor dragende wanden/vloeren/daken
 *   - IfcRelAssignsToGroup                                koppelt members aan het model
 *
 *  Coördinaten: three.js (y-omhoog) → IFC (z-omhoog).
 *  Bewust géén load conditions / boundary conditions in v0.5 — Scia/RFEM importeren
 *  de geometrie en de gebruiker vult loads in de solver. Dat is standaard praktijk
 *  omdat elke rekenkern eigen belastingsklassen hanteert. */

const CURVE_ENTITIES = new Set(["IfcBeam", "IfcColumn", "IfcMember"]);
const SURFACE_ENTITIES = new Set(["IfcWall", "IfcSlab", "IfcRoof", "IfcPlate"]);

export async function exportStructuralView(
  elements: PlacedElement[],
  opts: { projectName?: string; storeys?: Storey[] } = {},
): Promise<Uint8Array> {
  const projectName = opts.projectName ?? "Open 3D Studio — structural view";
  const api = await getIfcApi();

  const modelID = api.CreateModel({
    schema: WebIFC.Schemas.IFC4,
    name: projectName,
    authors: ["Open 3D Studio"],
    organizations: ["OpenAEC"],
    authorization: "none",
  });

  const label = (v: string) => new IFC4.IfcLabel(v);
  const text = (v: string) => new IFC4.IfcText(v);
  const ident = (v: string) => new IFC4.IfcIdentifier(v);
  const len = (v: number) => new IFC4.IfcLengthMeasure(v);
  const real = (v: number) => new IFC4.IfcReal(v);
  const guid = () => new IFC4.IfcGloballyUniqueId(newIfcGuid());
  const pt3 = (x: number, y: number, z: number) =>
    new IFC4.IfcCartesianPoint([len(x), len(y), len(z)]);

  const person = new IFC4.IfcPerson(null, label("Open 3D Studio"), null, null, null, null, null, null);
  const organization = new IFC4.IfcOrganization(null, label("OpenAEC"), null, null, null);
  const personOrg = new IFC4.IfcPersonAndOrganization(person, organization, null);
  const application = new IFC4.IfcApplication(
    organization, label("0.5.0"),
    label("Open 3D Studio — structural view"),
    ident("open-3d-studio.struct"),
  );
  const ownerHistory = new IFC4.IfcOwnerHistory(
    personOrg, application, null,
    IFC4.IfcChangeActionEnum.ADDED,
    null, null, null,
    new IFC4.IfcTimeStamp(Math.floor(Date.now() / 1000)),
  );

  const units = new IFC4.IfcUnitAssignment([
    new IFC4.IfcSIUnit(IFC4.IfcUnitEnum.LENGTHUNIT, null, IFC4.IfcSIUnitName.METRE),
    new IFC4.IfcSIUnit(IFC4.IfcUnitEnum.AREAUNIT, null, IFC4.IfcSIUnitName.SQUARE_METRE),
    new IFC4.IfcSIUnit(IFC4.IfcUnitEnum.PLANEANGLEUNIT, null, IFC4.IfcSIUnitName.RADIAN),
  ]);
  const worldOrigin = new IFC4.IfcAxis2Placement3D(pt3(0, 0, 0), null, null);
  const context = new IFC4.IfcGeometricRepresentationContext(
    null, label("Model"), new IFC4.IfcDimensionCount(3), real(1e-5), worldOrigin, null,
  );

  const project = new IFC4.IfcProject(
    guid(), ownerHistory, label(projectName), null, null, null, null, [context], units,
  );

  const structuralModel = new IFC4.IfcStructuralAnalysisModel(
    guid(), ownerHistory,
    label("Structural analysis model"),
    text("Draagconstructie geëxtraheerd uit Open 3D Studio"),
    null,
    IFC4.IfcAnalysisModelTypeEnum.LOADING_3D,
    null, null, null, null,
  );

  const members: (
    | InstanceType<typeof IFC4.IfcStructuralCurveMember>
    | InstanceType<typeof IFC4.IfcStructuralSurfaceMember>
  )[] = [];

  for (const el of elements) {
    let template;
    try { template = getTemplate(el.templateId); } catch { continue; }
    if (template.loadBearing === false) continue; // niet-dragend overslaan
    const dx = el.end.x - el.start.x;
    const dz = el.end.z - el.start.z;
    const length = Math.hypot(dx, dz);

    if (CURVE_ENTITIES.has(template.ifcEntity)) {
      if (length < 0.05) continue;
      // Startpunt in bouwkundig assenstelsel (three (x, y, z) -> IFC (x, -z, y))
      const poly = new IFC4.IfcPolyline([
        pt3(el.start.x, -el.start.z, el.start.y),
        pt3(el.end.x, -el.end.z, el.end.y),
      ]);
      const topo = new IFC4.IfcTopologyRepresentation(
        context, label("Reference"), label("Edge"), [poly],
      );
      const shape = new IFC4.IfcProductDefinitionShape(null, null, [topo]);
      members.push(
        new IFC4.IfcStructuralCurveMember(
          guid(), ownerHistory, label(el.name),
          text(`${template.name} — ${template.ifcPredefinedType ?? ""}`), null,
          new IFC4.IfcLocalPlacement(null, worldOrigin),
          shape,
          IFC4.IfcStructuralCurveMemberTypeEnum.RIGID_JOINED_MEMBER,
          new IFC4.IfcDirection([real(0), real(0), real(1)]),
        ),
      );
    } else if (SURFACE_ENTITIES.has(template.ifcEntity)) {
      // Rechthoekige surface (grondvlak van wand/vloer) — voor Scia/RFEM voldoende.
      // Voor wanden: verticaal vlak met breedte = length, hoogte = params.hoogte.
      // Voor vloeren/daken: horizontaal vlak met breedte × diepte.
      const hoogteMm = typeof el.params.hoogte === "number" ? el.params.hoogte : 3000;
      const isSlab = template.ifcEntity === "IfcSlab" || template.ifcEntity === "IfcRoof";
      let corners: [number, number, number][];
      if (isSlab) {
        const wm = Math.max(2, length || 5);
        const dm = Math.max(2, template.depth(el.params) || 5);
        corners = [
          [el.start.x, -el.start.z, el.start.y],
          [el.start.x + wm, -el.start.z, el.start.y],
          [el.start.x + wm, -(el.start.z - dm), el.start.y],
          [el.start.x, -(el.start.z - dm), el.start.y],
        ];
      } else {
        const zTop = el.start.y + hoogteMm / 1000;
        corners = [
          [el.start.x, -el.start.z, el.start.y],
          [el.end.x, -el.end.z, el.end.y],
          [el.end.x, -el.end.z, zTop],
          [el.start.x, -el.start.z, zTop],
        ];
      }
      const loop = new IFC4.IfcPolyLoop(corners.map((c) => pt3(c[0], c[1], c[2])));
      const face = new IFC4.IfcFace([new IFC4.IfcFaceOuterBound(loop, new IFC4.IfcBoolean(true))]);
      const shell = new IFC4.IfcConnectedFaceSet([face]);
      const topo = new IFC4.IfcTopologyRepresentation(
        context, label("Reference"), label("Face"), [shell],
      );
      const shape = new IFC4.IfcProductDefinitionShape(null, null, [topo]);
      members.push(
        new IFC4.IfcStructuralSurfaceMember(
          guid(), ownerHistory, label(el.name),
          text(`${template.name} — draagvlak`), null,
          new IFC4.IfcLocalPlacement(null, worldOrigin),
          shape,
          IFC4.IfcStructuralSurfaceMemberTypeEnum.SHELL,
          new IFC4.IfcPositiveLengthMeasure(template.depth(el.params) || 0.2),
        ),
      );
    }
  }

  api.WriteLine(modelID, project);
  try {
    api.WriteLine(modelID, structuralModel);
  } catch (err) {
    console.warn("IfcStructuralAnalysisModel serialization niet ondersteund door deze web-ifc build:", err);
  }
  // Members één-voor-één schrijven: als een specifieke entity-type niet gedekt
  // wordt door web-ifc's serializer, slaan we hem over en gaan we door.
  // De groep verwijst uitsluitend naar members die daadwerkelijk zijn geschreven —
  // anders bevat het STEP-bestand bungelende referenties.
  const written: typeof members = [];
  for (const m of members) {
    try {
      api.WriteLine(modelID, m);
      written.push(m);
    } catch (err) {
      console.warn("Structural member niet geserialiseerd:", err);
    }
  }
  if (written.length > 0) {
    try {
      api.WriteLine(
        modelID,
        new IFC4.IfcRelAssignsToGroup(
          guid(), ownerHistory,
          label("Dragende elementen"),
          text("Alle door Open 3D Studio als LoadBearing gemarkeerde onderdelen"),
          written, null, structuralModel,
        ),
      );
    } catch (err) {
      console.warn("IfcRelAssignsToGroup niet geserialiseerd:", err);
    }
  }

  const bytes = api.SaveModel(modelID);
  api.CloseModel(modelID);
  return bytes;
}
