import type { PlacedElement, Storey } from "./types";
import { getTemplate } from "../catalog/registry";
import { parseIdsXml } from "./ids/parser";
import { runIds } from "./ids/engine";
import { IDS_PRESETS } from "./ids/presets";

/** Ingebouwde controle vóór IFC-export. Sinds v0.5 gedreven door een IDS-engine
 *  (buildingSMART IDS v1.0) i.p.v. hardcoded regels. Default: BIM basis ILS 2.0.
 *  Een geïmporteerd IDS-XML kan als vervanging of aanvulling gedraaid worden.
 *
 *  Naast de IDS-specificaties draait áltijd een vaste set model-structuurchecks
 *  (`basisChecks`): eisen die IDS-facets niet kunnen uitdrukken omdat ze over
 *  het model als geheel gaan (verdiepingsnaamgeving, wees-elementen, gereserveerde
 *  pset-prefix, dragend/NL-SfB-consistentie, ontbrekende templates). Deze
 *  bestonden al in v0.4 en mogen bij de IDS-migratie niet verloren gaan. */

export interface IlsBevinding {
  eis: string;
  status: "ok" | "let-op" | "fout";
  toelichting: string;
}

/** Model-structuurchecks die buiten het bereik van IDS-facets vallen. */
export function basisChecks(elements: PlacedElement[], storeys: Storey[]): IlsBevinding[] {
  const out: IlsBevinding[] = [];
  const add = (eis: string, status: IlsBevinding["status"], toelichting: string) =>
    out.push({ eis, status, toelichting });

  // 1. Bouwlaagnaamgeving ("00 begane grond")
  const slechteNamen = storeys.filter((s) => !/^\d{2} /.test(s.name));
  if (slechteNamen.length === 0) {
    add("Bouwlaagindeling", "ok", `${storeys.length} bouwlaag/-lagen, naamgeving conform ("00 begane grond").`);
  } else {
    add(
      "Bouwlaagindeling",
      "let-op",
      `Naamgeving hoort te beginnen met twee cijfers: ${slechteNamen.map((s) => `"${s.name}"`).join(", ")}.`,
    );
  }

  // 2. Elementen zonder geldige bouwlaag
  const zonderStorey = elements.filter((e) => !storeys.some((s) => s.id === e.storeyId));
  if (zonderStorey.length > 0) {
    add("Bouwlaagkoppeling", "let-op", `${zonderStorey.length} element(en) zonder geldige bouwlaag (vallen terug op de onderste).`);
  } else if (elements.length > 0) {
    add("Bouwlaagkoppeling", "ok", "Alle elementen zijn aan een bouwlaag gekoppeld.");
  }

  // 3-5. Per gebruikt template: pset-prefix, dragend/NL-SfB, bestaan van het template
  const onbekend: string[] = [];
  const gebruikt = [...new Set(elements.map((e) => e.templateId))]
    .map((id) => {
      try {
        return getTemplate(id);
      } catch {
        onbekend.push(id);
        return null;
      }
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);
  if (onbekend.length > 0) {
    add(
      "Templates aanwezig",
      "fout",
      `${onbekend.length} element(en) verwijzen naar een onbekend template (${onbekend.slice(0, 3).join(", ")}${onbekend.length > 3 ? " …" : ""}) — laad de bijbehorende .o3st/plugin/bibliotheek. Deze elementen worden door de IDS-controle overgeslagen.`,
    );
  }
  for (const t of gebruikt) {
    if (/^Pset_/i.test(t.psetName)) {
      add("Pset-naamgeving", "fout", `${t.name}: eigen property set "${t.psetName}" gebruikt de gereserveerde prefix "Pset_".`);
    }
    if (t.loadBearing && t.nlSfb?.startsWith("22.2")) {
      add("Consistentie dragend/NL-SfB", "let-op", `${t.name}: LoadBearing=true maar NL-SfB ${t.nlSfb} (niet-constructieve binnenwanden).`);
    }
  }
  return out;
}

/** Backwards-compatible entry point: draait de default preset (BIM basis ILS 2.0). */
export function checkIls(elements: PlacedElement[], storeys: Storey[]): IlsBevinding[] {
  return checkWithPreset("bim-basis-ils-2", elements, storeys);
}

/** Draai één van de ingebouwde presets. */
export function checkWithPreset(
  presetId: string,
  elements: PlacedElement[],
  storeys: Storey[],
): IlsBevinding[] {
  const preset = IDS_PRESETS[presetId];
  if (!preset) {
    return [{ eis: "IDS-preset onbekend", status: "fout", toelichting: `Preset "${presetId}" bestaat niet.` }];
  }
  try {
    return [...basisChecks(elements, storeys), ...runIds(parseIdsXml(preset.xml), elements, storeys)];
  } catch (err) {
    return [{
      eis: preset.title,
      status: "fout",
      toelichting: `IDS-preset "${preset.title}" kon niet worden gedraaid: ${err instanceof Error ? err.message : String(err)}`,
    }];
  }
}

/** Draai een zelfaangeleverd IDS-XML (bestand-picker in de UI). */
export function checkWithIdsXml(
  idsXml: string,
  elements: PlacedElement[],
  storeys: Storey[],
): IlsBevinding[] {
  try {
    return [...basisChecks(elements, storeys), ...runIds(parseIdsXml(idsXml), elements, storeys)];
  } catch (err) {
    return [{
      eis: "IDS-bestand",
      status: "fout",
      toelichting: `Kan IDS-XML niet lezen: ${err instanceof Error ? err.message : String(err)}`,
    }];
  }
}

/** Titel + IDs van alle beschikbare presets (voor de UI-dropdown). */
export function listPresets(): { id: string; title: string }[] {
  return Object.entries(IDS_PRESETS).map(([id, { title }]) => ({ id, title }));
}
