import type { PlacedElement } from "./types";
import { getTemplate } from "../catalog/registry";

/** Wapening-generator voor beton (v0.6-4).
 *
 *  Genereert een simpele rebar-cage voor kolommen/balken/vloeren uit onze
 *  catalogus. Levert IFC-fragmenten als data-struct die de IFC-export in v0.7
 *  kan omzetten naar IfcReinforcingBar / IfcReinforcingMesh. Voor v0.6 leveren
 *  we een tekst-rapport (BOM + posities) plus de mogelijkheid het als losse
 *  IFC-aspectmodel te exporteren — voldoende voor input naar constructeurs.
 *
 *  Bewust *niet* op Tekla-detailniveau: geen ontlastingsijzers, geen beugels
 *  om de kop en voet van kolommen; wel hoofdstaven + beugelverdeling. */

const MM = 0.001;

export interface RebarBar {
  templateElementId: string;
  role: "longitudinal" | "stirrup" | "top-mesh" | "bottom-mesh";
  diameterMm: number;
  materialGrade: "B500B";
  positionsMm: { x: number; y: number; z: number }[];
  lengthMm: number;
}

export interface RebarSpec {
  /** Hoofdwapening Ø (staven langs de kolom-/balk-as) */
  longitudinalDiameterMm: number;
  /** Beugels Ø */
  stirrupDiameterMm: number;
  /** Beugelafstand hart-op-hart */
  stirrupSpacingMm: number;
  /** Betondekking rondom */
  coverMm: number;
  /** Aantal hoofdstaven (kolom: 4 minimum; balk: bovenop 2 + onderop 2) */
  numberOfLongitudinal: number;
}

const DEFAULT_SPEC: RebarSpec = {
  longitudinalDiameterMm: 16,
  stirrupDiameterMm: 8,
  stirrupSpacingMm: 200,
  coverMm: 30,
  numberOfLongitudinal: 4,
};

/** Genereer een rebar-cage voor één element. Werkt voor kolommen, balken,
 *  vloeren (mesh). Retourneert alleen data — de IFC-export doet het schrijven. */
export function generateRebar(
  el: PlacedElement,
  spec: Partial<RebarSpec> = {},
): RebarBar[] {
  const s = { ...DEFAULT_SPEC, ...spec };
  const t = getTemplate(el.templateId);
  const isColumn = t.ifcEntity === "IfcColumn";
  const isBeam = t.ifcEntity === "IfcBeam";
  const isSlab = t.ifcEntity === "IfcSlab" || t.ifcEntity === "IfcRoof";
  if (!isColumn && !isBeam && !isSlab) return [];
  if (t.material?.toLowerCase().includes("hout")) return []; // hout wordt niet gewapend
  if (t.material?.toLowerCase().includes("staal") && !t.material?.toLowerCase().includes("beton")) return [];

  const bars: RebarBar[] = [];
  const dx = el.end.x - el.start.x;
  const dz = el.end.z - el.start.z;
  const length = Math.hypot(dx, dz);
  const dm = t.profileSpec?.dimensions ?? {};
  const width = ((dm.OverallWidth ?? dm.Width ?? dm.XDim ?? 300) as number);
  const depth = ((dm.OverallDepth ?? dm.Depth ?? dm.YDim ?? 300) as number);
  const numParam = (key: string, fallback: number): number => {
    const v = el.params[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = parseFloat(v); // select-params (bv. VBI-dikte "200") zijn strings
      if (Number.isFinite(n)) return n;
    }
    return fallback;
  };

  if (isColumn || isBeam) {
    // Doorsnede altijd uit de profielmaten (mm) — nooit uit de plan-lengte.
    const cx = s.coverMm + s.longitudinalDiameterMm / 2;
    const cy = s.coverMm + s.longitudinalDiameterMm / 2;
    const w = width - 2 * cx;
    const h = depth - 2 * cy;
    if (w <= 0 || h <= 0) return []; // profiel te klein voor dekking — geen kooi
    // Staaflengte: kolom = hoogte-parameter (verticaal), balk = plan-lengte.
    const barLengthMm = isColumn
      ? Math.round(numParam("hoogte", 2800))
      : Math.round(length * 1000);
    const columnPositions = [
      { x: -w / 2, y: -h / 2 },
      { x:  w / 2, y: -h / 2 },
      { x: -w / 2, y:  h / 2 },
      { x:  w / 2, y:  h / 2 },
    ];
    bars.push({
      templateElementId: el.id,
      role: "longitudinal",
      diameterMm: s.longitudinalDiameterMm,
      materialGrade: "B500B",
      lengthMm: barLengthMm,
      positionsMm: columnPositions.map((p) => ({ x: p.x, y: p.y, z: 0 })),
    });
    // Beugels verdeeld over de staaflengte (kolomhoogte resp. balklengte).
    const nStirrups = Math.max(1, Math.floor(barLengthMm / s.stirrupSpacingMm));
    const stirrupLen = 2 * (w + h) + 4 * s.longitudinalDiameterMm; // rondgang
    bars.push({
      templateElementId: el.id,
      role: "stirrup",
      diameterMm: s.stirrupDiameterMm,
      materialGrade: "B500B",
      lengthMm: Math.round(stirrupLen),
      positionsMm: Array.from({ length: nStirrups + 1 }, (_, i) => ({
        x: 0, y: 0, z: i * s.stirrupSpacingMm,
      })),
    });
  }

  if (isSlab) {
    // Onder- en boven-mesh Ø8-150 tweezijdig. Surface-plaatsing: start/end zijn
    // tegenoverliggende rechthoek-hoekpunten, dus de zijden zijn |dx| en |dz|
    // (de diagonaal is GEEN maat). Vloerbreedte kan ook als parameter bestaan.
    const sideA = Math.max(Math.abs(dx), 0.5);
    const sideB = Math.max(Math.abs(dz), numParam("breedte", 500) / 1000, 0.5);
    const areaM2 = sideA * sideB;
    const meshSpacingM = 0.150; // Ø8-150
    // Afgewikkelde lengte per mesh: tweezijdig, staven h.o.h. 150 mm.
    const unrolledMm = Math.round((areaM2 / meshSpacingM) * 2 * 1000);
    const slabThicknessMm = numParam("dikte", numParam("totaalDikte", 200));
    bars.push({
      templateElementId: el.id,
      role: "bottom-mesh",
      diameterMm: 8,
      materialGrade: "B500B",
      lengthMm: unrolledMm,
      positionsMm: [{ x: 0, y: 0, z: s.coverMm }],
    });
    bars.push({
      templateElementId: el.id,
      role: "top-mesh",
      diameterMm: 8,
      materialGrade: "B500B",
      lengthMm: unrolledMm,
      positionsMm: [{ x: 0, y: 0, z: Math.max(s.coverMm, slabThicknessMm - s.coverMm) }],
    });
  }
  return bars;
}

/** BOM-rapport (CSV) van alle wapening in de tekening. */
export function rebarBomCsv(elements: PlacedElement[], spec?: Partial<RebarSpec>): string {
  const rows: string[] = ["Element;Rol;Aantal;Ø mm;Lengte mm;Materiaal;Totaal m"];
  for (const el of elements) {
    const bars = generateRebar(el, spec);
    for (const b of bars) {
      const total = (b.positionsMm.length * b.lengthMm) / 1000;
      rows.push(`${el.name};${b.role};${b.positionsMm.length};${b.diameterMm};${b.lengthMm};${b.materialGrade};${total.toFixed(2)}`);
    }
  }
  return rows.join("\r\n");
}

/** Totalen per Ø (voor stuklijsten en kg-berekening). */
export function rebarTotalsByDiameter(
  elements: PlacedElement[],
  spec?: Partial<RebarSpec>,
): Map<number, { totalMeters: number; totalKg: number }> {
  const out = new Map<number, { totalMeters: number; totalKg: number }>();
  for (const el of elements) {
    for (const b of generateRebar(el, spec)) {
      const totalM = (b.positionsMm.length * b.lengthMm) / 1000;
      // Massa: π/4 · Ø² · ρ waar ρ_staal ≈ 7850 kg/m³
      const areaMm2 = Math.PI * (b.diameterMm / 2) ** 2;
      const kgPerM = (areaMm2 * 1e-6) * 7850;
      const existing = out.get(b.diameterMm) ?? { totalMeters: 0, totalKg: 0 };
      existing.totalMeters += totalM;
      existing.totalKg += totalM * kgPerM;
      out.set(b.diameterMm, existing);
    }
  }
  return out;
}
