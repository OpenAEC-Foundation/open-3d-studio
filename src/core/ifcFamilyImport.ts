import * as WebIFC from "web-ifc";
import type { ComponentTemplate, SolidBox } from "./types";
import { registerRuntimeTemplate } from "../catalog/registry";

/** IFC-family-import als IfcBuildingElementProxy (v0.6-2).
 *
 *  Leest een IFC uit een fabrikant-bibliotheek (Ubbink, Rockpanel, Kingspan,
 *  Simpson, Wienerberger, VBI …) en converteert elk IfcProduct met geometrie
 *  tot een read-only proxy-template. De proxy heeft:
 *   - één enkel volume gelijk aan de bounding-box van de originele mesh
 *   - IfcEntity = IfcBuildingElementProxy
 *   - vaste dimensies (geen configurabele params)
 *   - hergebruikte NL-SfB/materiaal indien de bron ze meegeeft
 *
 *  Zo verschijnt bijvoorbeeld "Rockpanel-plaat 2500×1200×8" in de dropdown
 *  en kan de gebruiker hem plaatsen zonder eigen geometrie te modelleren.
 *
 *  Voor hi-fi families (Speckle, complexe geometrie): via v0.6-5 speckle-connector. */

const { IFC4 } = WebIFC;

export interface FamilyImportResult {
  proxies: ComponentTemplate[];
  skipped: number;
  sourceName: string;
}

export async function importIfcFamily(file: File): Promise<FamilyImportResult> {
  const api = new WebIFC.IfcAPI();
  api.SetWasmPath("/wasm/", true);
  await api.Init();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const modelID = api.OpenModel(bytes);

  const proxies: ComponentTemplate[] = [];
  let skipped = 0;
  const sourceName = file.name.replace(/\.ifc$/i, "");

  // Doorloop alle producten die als bouwelement kunnen dienen.
  // Deze constanten leven op het WebIFC-toplevel (schema-onafhankelijk).
  const W = WebIFC as any;
  const productTypes = [
    W.IFCWALL, W.IFCSLAB, W.IFCBEAM, W.IFCCOLUMN, W.IFCPLATE,
    W.IFCROOF, W.IFCCOVERING, W.IFCDOOR, W.IFCWINDOW,
    W.IFCFURNISHINGELEMENT, W.IFCBUILDINGELEMENTPROXY,
  ].filter((t) => typeof t === "number");

  try {
    for (const type of productTypes) {
      const lines = api.GetLineIDsWithType(modelID, type);
      for (let i = 0; i < lines.size(); i++) {
        const productId = lines.get(i);
        try {
          const proxy = extractProxyTemplate(api, modelID, productId, sourceName, proxies.length);
          if (proxy) proxies.push(proxy);
          else skipped++;
        } catch {
          skipped++;
        }
      }
    }
  } finally {
    api.CloseModel(modelID);
  }

  // Registreer de templates zelf (met de gemeten bounding-box-geometrie) in de
  // runtime-registry zodat ze in de dropdown verschijnen. NB: bewust géén
  // .o3st-round-trip — het o3st-formaat kan vaste bounding-box-maten (nog)
  // niet uitdrukken en zou de geometrie degraderen tot defaults.
  for (const t of proxies) registerRuntimeTemplate(t);

  return { proxies, skipped, sourceName };
}

function extractProxyTemplate(
  api: WebIFC.IfcAPI,
  modelID: number,
  productId: number,
  sourceName: string,
  index: number,
): ComponentTemplate | null {
  const product: any = api.GetLine(modelID, productId, true);
  const rawName: string = product?.Name?.value ?? `Import ${index + 1}`;
  const desc: string = product?.Description?.value ?? "";
  // Bounding box uit de eerste geometrische representatie.
  const box = boundingBoxFromRepresentation(api, modelID, product);
  if (!box) return null;
  const [dx, dy, dz] = box;
  if (dx < 0.005 || dy < 0.005 || dz < 0.005) return null;

  const id = `import-${sourceName}-${index + 1}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const template: ComponentTemplate = {
    id,
    name: `${rawName} (${sourceName})`,
    category: `Import — ${sourceName}`,
    manufacturer: sourceName,
    ifcEntity: "IfcBuildingElementProxy",
    ifcPredefinedType: "USERDEFINED",
    ifcObjectType: rawName,
    placementKind: "point",
    params: [
      { key: "basisHoogte", label: "Peil", type: "length", min: -5000, max: 20000, step: 10 },
    ],
    defaults: { basisHoogte: 0 },
    solids: (): SolidBox[] => [
      { cx: dx / 2, cy: 0, zBottom: 0, dx, dy, dz },
    ],
    depth: () => dy,
    color: () => "#8d857a",
    psetName: "Import_Family",
    psetProps: () => ({
      Manufacturer: sourceName,
      SourceEntity: product?.constructor?.name ?? "Ifc?",
      OriginalName: rawName,
      Description: desc,
      Bounding_dx_mm: Math.round(dx * 1000),
      Bounding_dy_mm: Math.round(dy * 1000),
      Bounding_dz_mm: Math.round(dz * 1000),
    }),
  };
  return template;
}

function boundingBoxFromRepresentation(
  api: WebIFC.IfcAPI, modelID: number, product: any,
): [number, number, number] | null {
  try {
    const flatMesh: any = api.GetFlatMesh(modelID, product.expressID);
    if (!flatMesh || !flatMesh.geometries) return null;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    const geoms: any = flatMesh.geometries;
    const count = typeof geoms.size === "function" ? geoms.size() : geoms.length;
    for (let i = 0; i < count; i++) {
      const g = typeof geoms.get === "function" ? geoms.get(i) : geoms[i];
      const geom = api.GetGeometry(modelID, g.geometryExpressID);
      const verts = api.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize());
      // Vertexdata: elke 6 waarden = x,y,z,nx,ny,nz. IFC -> three.js: (x,y,z) -> (x, z, -y).
      const flat = new Float32Array(verts as unknown as ArrayBuffer);
      for (let k = 0; k < flat.length; k += 6) {
        const x = flat[k];
        const y = flat[k + 1];
        const z = flat[k + 2];
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
      }
    }
    if (!Number.isFinite(minX)) return null;
    return [maxX - minX, maxY - minY, maxZ - minZ];
  } catch {
    return null;
  }
}

