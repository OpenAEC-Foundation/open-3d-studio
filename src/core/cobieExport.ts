import type { PlacedElement, Storey } from "./types";
import { getTemplate } from "../catalog/registry";

/** COBie-compatible export (v0.5-S5).
 *
 *  Produceert een ZIP met vier core-tabbladen van COBie 2.4 als CSV:
 *    - Facility.csv    : één rij per project (gebouw)
 *    - Floor.csv       : één rij per verdieping (IfcBuildingStorey)
 *    - Type.csv        : één rij per template + type-params-combinatie
 *    - Component.csv   : één rij per geplaatst element
 *  Contact, Space, System, Zone, Assembly volgen in v0.6. De headers volgen de
 *  COBie 2.4 UK-BIM-Alliance CSV-specificatie zodat de output door BIM-servers
 *  (Autodesk Construction Cloud, Solibri) direct te importeren is. */

export interface CobieOptions {
  projectName?: string;
  siteName?: string;
  contactEmail?: string;
}

export async function exportCobieZip(
  elements: PlacedElement[],
  storeys: Storey[],
  opts: CobieOptions = {},
): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const isoNow = new Date().toISOString();
  const projectName = opts.projectName ?? "Open 3D Studio project";
  const siteName = opts.siteName ?? "OpenAEC-terrein";
  const contact = opts.contactEmail ?? "info@openaec.nl";

  zip.file("Contact.csv", makeContactCsv(contact, isoNow));
  zip.file("Facility.csv", makeFacilityCsv(projectName, siteName, contact, isoNow));
  zip.file("Floor.csv", makeFloorCsv(storeys, contact, isoNow));
  const { types, byType } = groupByType(elements);
  zip.file("Type.csv", makeTypeCsv(types, contact, isoNow));
  zip.file("Component.csv", makeComponentCsv(elements, storeys, byType, contact, isoNow));
  zip.file("System.csv", makeSystemCsv(types, contact, isoNow));
  zip.file(
    "README.txt",
    [
      "COBie 2.4 export uit Open 3D Studio v0.5.",
      "Deze ZIP bevat de kern-tabbladen van de COBie-workbook als CSV.",
      "Voor Excel-import: alle CSV's in één workbook plakken; delimiter is komma.",
      "",
      `Aantal elementen: ${elements.length}`,
      `Aantal typen:      ${types.length}`,
      `Aantal verdiepingen: ${storeys.length}`,
    ].join("\r\n"),
  );

  return await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

// ------- helpers -------

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvLine(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvEscape).join(",");
}

function makeContactCsv(contact: string, now: string): string {
  return [
    csvLine(["Email", "CreatedBy", "CreatedOn", "Category", "Company", "Phone"]),
    csvLine([contact, contact, now, "roles:Modeller", "OpenAEC", ""]),
  ].join("\r\n");
}

function makeFacilityCsv(project: string, site: string, contact: string, now: string): string {
  return [
    csvLine([
      "Name", "CreatedBy", "CreatedOn", "Category", "ProjectName", "SiteName",
      "LinearUnits", "AreaUnits", "VolumeUnits", "CurrencyUnit",
      "AreaMeasurement", "ExternalSystem", "ExternalProjectObject", "ExternalProjectIdentifier",
    ]),
    csvLine([
      project, contact, now, "n/a", project, site,
      "meters", "square meters", "cubic meters", "EUR",
      "NEN 2580", "Open 3D Studio", project, "",
    ]),
  ].join("\r\n");
}

function makeFloorCsv(storeys: Storey[], contact: string, now: string): string {
  const rows = [csvLine(["Name", "CreatedBy", "CreatedOn", "Category", "ExtSystem", "ExtObject", "ExtIdentifier", "Description", "Elevation", "Height"])];
  for (const s of storeys) {
    rows.push(csvLine([
      s.name, contact, now, "Floor", "Open 3D Studio", "IfcBuildingStorey", s.id,
      "", s.elevation, "",
    ]));
  }
  return rows.join("\r\n");
}

interface TypeGroup {
  key: string;
  name: string;
  category: string;
  manufacturer: string;
  ifcEntity: string;
  nlSfb: string;
  material: string;
}

function groupByType(elements: PlacedElement[]): { types: TypeGroup[]; byType: Map<string, TypeGroup> } {
  const map = new Map<string, TypeGroup>();
  for (const el of elements) {
    let template;
    try { template = getTemplate(el.templateId); } catch { continue; }
    const { basisHoogte: _b, ...typeParams } = el.params as Record<string, unknown>;
    const key = `${el.templateId}|${JSON.stringify(typeParams)}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: `${template.name} type`,
        category: template.category,
        manufacturer: template.manufacturer ?? "",
        ifcEntity: template.ifcEntity,
        nlSfb: template.nlSfb ?? "",
        material: template.material ?? "",
      });
    }
  }
  return { types: [...map.values()], byType: map };
}

function makeTypeCsv(types: TypeGroup[], contact: string, now: string): string {
  const rows = [csvLine([
    "Name", "CreatedBy", "CreatedOn", "Category", "Description",
    "AssetType", "Manufacturer", "ModelNumber", "WarrantyGuarantorParts", "WarrantyDurationParts",
    "WarrantyGuarantorLabor", "WarrantyDurationLabor", "WarrantyDurationUnit",
    "ExtSystem", "ExtObject", "ExtIdentifier",
    "ReplacementCost", "ExpectedLife", "DurationUnit",
    "Shape", "Size", "Color", "Finish", "Grade", "Material", "Constituents",
    "Features", "AccessibilityPerformance", "CodePerformance", "SustainabilityPerformance",
  ])];
  for (const t of types) {
    rows.push(csvLine([
      t.name, contact, now, t.nlSfb || "n/a", t.name,
      "Movable", t.manufacturer, "", t.manufacturer || "n/a", "12",
      t.manufacturer || "n/a", "12", "months",
      "Open 3D Studio", `${t.ifcEntity}Type`, t.key,
      "", "50", "years",
      "", "", "", "", "", t.material, "",
      "", "", "", "",
    ]));
  }
  return rows.join("\r\n");
}

function makeComponentCsv(
  elements: PlacedElement[],
  storeys: Storey[],
  byType: Map<string, TypeGroup>,
  contact: string,
  now: string,
): string {
  const storeyNameOf = (id: string | undefined) =>
    storeys.find((s) => s.id === id)?.name ?? storeys[0]?.name ?? "";
  const rows = [csvLine([
    "Name", "CreatedBy", "CreatedOn", "TypeName", "Space",
    "Description", "ExtSystem", "ExtObject", "ExtIdentifier",
    "SerialNumber", "InstallationDate", "WarrantyStartDate", "TagNumber", "BarCode", "AssetIdentifier",
  ])];
  for (const el of elements) {
    let template;
    try { template = getTemplate(el.templateId); } catch { continue; }
    const { basisHoogte: _b, ...typeParams } = el.params as Record<string, unknown>;
    const key = `${el.templateId}|${JSON.stringify(typeParams)}`;
    const type = byType.get(key);
    rows.push(csvLine([
      el.name, contact, now, type?.name ?? el.templateId, storeyNameOf(el.storeyId),
      `${template.name} — merk ${el.merk ?? "-"}`,
      "Open 3D Studio", template.ifcEntity, el.id,
      "", now.slice(0, 10), now.slice(0, 10),
      el.merk ?? "", "", el.id,
    ]));
  }
  return rows.join("\r\n");
}

function makeSystemCsv(types: TypeGroup[], contact: string, now: string): string {
  // Systeem = groepering per NL-SfB-hoofdgroep (2 cijfers). Elementair maar bruikbaar.
  const bySfb = new Map<string, TypeGroup[]>();
  for (const t of types) {
    const g = t.nlSfb.slice(0, 2) || "00";
    const list = bySfb.get(g) ?? [];
    list.push(t);
    bySfb.set(g, list);
  }
  const rows = [csvLine(["Name", "CreatedBy", "CreatedOn", "Category", "ComponentNames", "ExtSystem", "ExtObject", "ExtIdentifier", "Description"])];
  for (const [group, ts] of bySfb) {
    rows.push(csvLine([
      `NL-SfB ${group} systeem`, contact, now, `NL-SfB ${group}`,
      ts.map((t) => t.name).join("; "),
      "Open 3D Studio", "IfcSystem", `system-${group}`,
      `Alle onderdelen in NL-SfB hoofdgroep ${group}`,
    ]));
  }
  return rows.join("\r\n");
}
