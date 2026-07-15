import type { ComponentTemplate, PlacedElement, SolidBox } from "./types";
import { getTemplate } from "../catalog/registry";
import { elementSolids } from "./meshBuilder";

/** Elementeren (HSBcad-principe): een wandvormig element opdelen in
 *  productiepanelen met een maximale breedte, met per paneel een zaag-/stuklijst. */

export interface PaneelOnderdeel {
  /** afmeting L×B×H in mm */
  omschrijving: string;
  aantal: number;
}

export interface Paneel {
  nummer: string;
  breedteMm: number;
  onderdelen: PaneelOnderdeel[];
}

export interface ElementeerResultaat {
  element: PlacedElement;
  template: ComponentTemplate;
  merk: string;
  totaleLengteMm: number;
  panelen: Paneel[];
}

function onderdelenVanSolids(solids: SolidBox[]): PaneelOnderdeel[] {
  const groepen = new Map<string, number>();
  for (const s of solids) {
    const l = Math.round(s.dx * 1000);
    const b = Math.round(s.dy * 1000);
    const h = Math.round(s.dz * 1000);
    // sorteer de twee kleinste maten zodat gelijke profielen samenvallen
    const key = `${Math.max(l, h)} × ${Math.min(l, h)} × ${b} mm`;
    groepen.set(key, (groepen.get(key) ?? 0) + 1);
  }
  return [...groepen.entries()]
    .map(([omschrijving, aantal]) => ({ omschrijving, aantal }))
    .sort((a, b) => b.aantal - a.aantal);
}

export function elementeer(el: PlacedElement, maxPaneelbreedteMm: number): ElementeerResultaat {
  const template = getTemplate(el.templateId);
  const totale = Math.hypot(el.end.x - el.start.x, el.end.z - el.start.z);
  const maxB = Math.max(0.3, maxPaneelbreedteMm / 1000);
  const aantalPanelen = Math.max(1, Math.ceil(totale / maxB));
  const paneelBreedte = totale / aantalPanelen;

  const panelen: Paneel[] = [];
  for (let i = 0; i < aantalPanelen; i++) {
    // sparing geldt alleen voor het paneel waarin die valt (vereenvoudigd: hele wand-solids
    // per paneel opnieuw genereren op paneelbreedte, sparing alleen meenemen indien binnen bereik)
    const van = i * paneelBreedte;
    const opening =
      el.opening && el.opening.xPos > van && el.opening.xPos < van + paneelBreedte
        ? { ...el.opening, xPos: el.opening.xPos - van }
        : null;
    const solids = elementSolids(template, paneelBreedte, el.params, opening);
    panelen.push({
      nummer: `${el.merk ?? "E"}-${String(i + 1).padStart(2, "0")}`,
      breedteMm: Math.round(paneelBreedte * 1000),
      onderdelen: onderdelenVanSolids(solids),
    });
  }

  return {
    element: el,
    template,
    merk: el.merk ?? "",
    totaleLengteMm: Math.round(totale * 1000),
    panelen,
  };
}

/** Productierapport (PDF, A4 staand) met per element de panelen en zaag-/stuklijsten. */
export async function maakElementeerRapport(
  elements: PlacedElement[],
  maxPaneelbreedteMm: number,
  projectName = "Open 3D Studio — Storax componenten",
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 15;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = margin;

  const kop = () => {
    doc.setFontSize(14);
    doc.setTextColor(20);
    doc.text("Elementeer- en productierapport", margin, y);
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(
      `${projectName} · max. paneelbreedte ${maxPaneelbreedteMm} mm · ${new Date().toLocaleDateString("nl-NL")}`,
      margin,
      y + 5,
    );
    y += 12;
  };
  const nieuwePaginaIndienNodig = (nodig: number) => {
    if (y + nodig > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  kop();
  for (const el of elements) {
    const res = elementeer(el, maxPaneelbreedteMm);
    nieuwePaginaIndienNodig(20);
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text(`${res.merk ? `[${res.merk}] ` : ""}${el.name} — ${res.totaleLengteMm} mm, ${res.panelen.length} paneel/panelen`, margin, y);
    y += 6;
    for (const p of res.panelen) {
      nieuwePaginaIndienNodig(12 + p.onderdelen.length * 5);
      doc.setFontSize(10);
      doc.setTextColor(40);
      doc.text(`Paneel ${p.nummer} — breedte ${p.breedteMm} mm`, margin + 4, y);
      y += 5;
      doc.setFontSize(9);
      doc.setTextColor(80);
      for (const o of p.onderdelen) {
        doc.text(`${o.aantal} ×`, margin + 10, y, { align: "left" });
        doc.text(o.omschrijving, margin + 22, y);
        y += 4.5;
      }
      y += 2;
    }
    doc.setDrawColor(200);
    doc.line(margin, y, pageW - margin, y);
    y += 5;
  }

  return doc.output("blob");
}
