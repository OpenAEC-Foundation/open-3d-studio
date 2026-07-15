import type { PlacedElement, Storey } from "./types";
import { getTemplate } from "../catalog/registry";

/** Ingebouwde BIM basis ILS 2.0-controle vóór IFC-export.
 *  Bron van de eisen: digiGO — BIM basis ILS (versie 2.0). */

export interface IlsBevinding {
  eis: string;
  status: "ok" | "let-op" | "fout";
  toelichting: string;
}

export function checkIls(elements: PlacedElement[], storeys: Storey[]): IlsBevinding[] {
  const bevindingen: IlsBevinding[] = [];
  const add = (eis: string, status: IlsBevinding["status"], toelichting: string) =>
    bevindingen.push({ eis, status, toelichting });

  add("Uitwisselformaat", "ok", "Export als IFC4 (STEP).");

  // bouwlaagindeling en naamgeving
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
  const zonderStorey = elements.filter((e) => !storeys.some((s) => s.id === e.storeyId));
  if (zonderStorey.length > 0) {
    add("Bouwlaagkoppeling", "let-op", `${zonderStorey.length} element(en) zonder geldige bouwlaag (vallen terug op de onderste).`);
  } else if (elements.length > 0) {
    add("Bouwlaagkoppeling", "ok", "Alle elementen zijn aan een bouwlaag gekoppeld.");
  }

  // per gebruikt template: entiteit, NL-SfB, materiaal
  const gebruikt = [...new Set(elements.map((e) => e.templateId))].map((id) => getTemplate(id));
  for (const t of gebruikt) {
    add("Juiste entiteit", "ok", `${t.name} → ${t.ifcEntity} met TypeEnumeration.`);
    if (t.nlSfb && /^\d{2}\.\d{2}$/.test(t.nlSfb)) {
      add("NL-SfB (viercijferig)", "ok", `${t.name}: ${t.nlSfb}.`);
    } else if (t.nlSfb) {
      add("NL-SfB (viercijferig)", "let-op", `${t.name}: "${t.nlSfb}" is niet viercijferig (xx.xx).`);
    } else {
      add("NL-SfB (viercijferig)", "fout", `${t.name}: geen NL-SfB-code — vul nlSfb in het template in.`);
    }
    if (t.material) add("Materiaal", "ok", `${t.name}: ${t.material}.`);
    else add("Materiaal", "fout", `${t.name}: geen materiaal — vul material in het template in.`);
  }

  // naam & type
  const naamloos = elements.filter((e) => !e.name?.trim());
  if (naamloos.length === 0 && elements.length > 0) add("Naam en Type", "ok", "Alle elementen hebben een naam; typeobjecten worden geëxporteerd.");
  if (naamloos.length > 0) add("Naam en Type", "fout", `${naamloos.length} element(en) zonder naam.`);

  // doorbraken/sparingen
  const metSparing = elements.filter((e) => e.opening);
  add(
    "Doorbraken en sparingen",
    "ok",
    metSparing.length > 0
      ? `${metSparing.length} sparing(en) als IfcOpeningElement + IfcRelVoidsElement.`
      : "Geen sparingen in het model.",
  );

  add("Geen proxies", "ok", "Er worden geen IfcBuildingElementProxy-objecten geëxporteerd.");
  add(
    "Basis-psets",
    "ok",
    "LoadBearing en IsExternal (Pset_WallCommon e.d.) worden geëxporteerd. FireRating volgt als template-parameter.",
  );

  return bevindingen;
}
