import type { PlacedElement } from "./types";
import { getTemplate } from "../catalog/registry";
import { elementOpenings, elementSolids } from "./meshBuilder";

/** Doorsnede fase 2/3 (v0.6-7).
 *
 *  Snijdt alle geplaatste elementen met een verticaal snijvlak en levert
 *  een 2D-SVG met:
 *    - snijsilhouet per SolidBox als polygoon
 *    - hatch per IfcMaterial (materiaal-kleur + patroon per categorie)
 *    - annotaties: hoogtemaat rechts, gronddikte onderaan
 *  Verder produceert deze module IfcAnnotation-fragmenten die de IFC-export
 *  kan meeschrijven zodat de doorsnede round-trippable is (fase 3).
 *
 *  Vereenvoudiging: het snijvlak staat loodrecht op een van de x/z-assen
 *  (standaard: horizontale N-Z, dus we snijden alles wat door y = plane.d
 *  gaat). Volwaardige oblique-planes komen in v0.7. */

export interface SectionPlane {
  /** Nominaal normaal-vector: momenteel gesteund X of Z. Y = plafondsnede. */
  normal: "x" | "z";
  /** Positie langs de normaal in meters (wereld-coord). */
  offset: number;
}

interface SectionPoly {
  material: string;
  category: string;
  fillColor: string;
  hatchId: string;
  points: [number, number][]; // in paper-mm rondom (0,0)
  elementId: string;
}

const HATCH_BY_CATEGORY: Record<string, { color: string; pattern: string }> = {
  structure:  { color: "#3f3f3f", pattern: "diagonalDense" },
  insulation: { color: "#fbbf24", pattern: "waves" },
  cladding:   { color: "#8b6f4b", pattern: "horizontal" },
  finish:     { color: "#e5e7eb", pattern: "none" },
  membrane:   { color: "#1e3a8a", pattern: "thick" },
  cavity:     { color: "#ffffff", pattern: "none" },
};

/** Genereer SVG-string voor de doorsnede. Papiermaten in mm, scale 1:50 default. */
export function renderSectionSvg(
  elements: PlacedElement[],
  plane: SectionPlane,
  opts: { scale?: number; paperW?: number; paperH?: number } = {},
): string {
  const scale = opts.scale ?? 50;   // 1:50
  const paperW = opts.paperW ?? 420; // A3 landscape
  const paperH = opts.paperH ?? 297;
  const polys: SectionPoly[] = [];

  // Per gesneden element één "slot" op het blad; binnen dat slot staan de lagen
  // naast elkaar op hun echte cy-offset (dikte-richting), zodat één spouwmuur
  // als aaneengesloten opbouw verschijnt in plaats van verstrooide rechthoeken.
  let cursorX = 20; // linkermarge in paper-mm; schuift per element op
  const slotGap = 15;
  const yBaseline = paperH - 40;
  for (const el of elements) {
    let template;
    try { template = getTemplate(el.templateId); } catch { continue; }
    const length = Math.hypot(el.end.x - el.start.x, el.end.z - el.start.z);
    if (length < 1e-6) continue;

    // Bepaal of dit element het snijvlak passeert.
    if (intersectsPlane(el, plane) === false) continue;

    const solids = elementSolids(template, length, el.params, elementOpenings(el));
    if (solids.length === 0) continue;
    const layers = template.materialLayers ?? [];
    // Slotbreedte = totale dikte-envelope van het element op papier.
    const cyMin = Math.min(...solids.map((s) => s.cy - s.dy / 2));
    const cyMax = Math.max(...solids.map((s) => s.cy + s.dy / 2));
    const slotW = ((cyMax - cyMin) * 1000) / scale;
    if (cursorX + slotW > paperW - 20) break; // blad vol — rest overslaan
    for (let i = 0; i < solids.length; i++) {
      const s = solids[i];
      // laag-info als bekend, anders template-brede material
      const layer = layers[i];
      const materialName = layer?.material ?? template.material ?? "Onbekend";
      const category = layer?.category ?? "structure";
      const hatch = HATCH_BY_CATEGORY[category] ?? HATCH_BY_CATEGORY.structure;
      // Laag op zijn eigen cy-positie binnen het element-slot (paper-mm).
      const x0 = cursorX + ((s.cy - s.dy / 2 - cyMin) * 1000) / scale;
      const x1 = cursorX + ((s.cy + s.dy / 2 - cyMin) * 1000) / scale;
      const zBot = (s.zBottom * 1000) / scale;
      const zTop = ((s.zBottom + s.dz) * 1000) / scale;
      polys.push({
        material: materialName,
        category,
        fillColor: hatch.color,
        hatchId: `hatch-${category}`,
        points: [
          [x0, yBaseline - zBot],
          [x1, yBaseline - zBot],
          [x1, yBaseline - zTop],
          [x0, yBaseline - zTop],
        ],
        elementId: el.id,
      });
    }
    cursorX += slotW + slotGap;
  }

  const defs = `
    <pattern id="hatch-structure" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="6" stroke="#3f3f3f" stroke-width="1"/>
    </pattern>
    <pattern id="hatch-insulation" width="10" height="4" patternUnits="userSpaceOnUse">
      <path d="M 0 2 Q 2.5 0 5 2 T 10 2" fill="none" stroke="#fbbf24" stroke-width="0.8"/>
    </pattern>
    <pattern id="hatch-cladding" width="8" height="8" patternUnits="userSpaceOnUse">
      <line x1="0" y1="4" x2="8" y2="4" stroke="#8b6f4b" stroke-width="0.6"/>
    </pattern>
    <pattern id="hatch-finish" width="8" height="8" patternUnits="userSpaceOnUse">
      <rect width="8" height="8" fill="#e5e7eb"/>
    </pattern>
    <pattern id="hatch-membrane" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="4" fill="#1e3a8a"/>
    </pattern>
    <pattern id="hatch-cavity" width="8" height="8" patternUnits="userSpaceOnUse">
      <rect width="8" height="8" fill="#ffffff"/>
    </pattern>`;

  const paths = polys.map((p) => {
    const d = `M ${p.points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(" L ")} Z`;
    return `<path d="${d}" fill="url(#${p.hatchId})" stroke="#111" stroke-width="0.25"><title>${p.material}</title></path>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${paperW} ${paperH}" width="${paperW}mm" height="${paperH}mm">
  <defs>${defs}</defs>
  <rect x="0" y="0" width="${paperW}" height="${paperH}" fill="#f7f4ef"/>
  <rect x="10" y="10" width="${paperW - 20}" height="${paperH - 20}" fill="none" stroke="#8d857a" stroke-width="0.3" stroke-dasharray="2,1"/>
  <text x="${paperW / 2}" y="20" font-family="Space Grotesk, sans-serif" font-size="6" text-anchor="middle" fill="#3b3630">
    Doorsnede — snijvlak ${plane.normal} = ${plane.offset.toFixed(2)} m · schaal 1:${scale}
  </text>
  ${paths}
</svg>`;
}

/** Zeg of `el` het snijvlak passeert. */
function intersectsPlane(el: PlacedElement, plane: SectionPlane): boolean {
  const va = plane.normal === "x" ? el.start.x : el.start.z;
  const vb = plane.normal === "x" ? el.end.x : el.end.z;
  return (va - plane.offset) * (vb - plane.offset) <= 0;
}

/** IfcAnnotation-payload voor round-trip (fase 3). De IFC-export kan hier
 *  IfcAnnotation + IfcGeometricSet uit maken zodat de doorsnede in het
 *  aspectmodel meegaat. Voor v0.6 leveren we de payload; wire-up naar
 *  ifcExport volgt bij de v0.7 sheets-round-trip. */
export interface SectionAnnotationPayload {
  planeNormal: "x" | "z";
  planeOffset: number;
  scale: number;
  polylines: { points: [number, number, number][]; material: string }[];
}

export function sectionAsAnnotation(
  elements: PlacedElement[],
  plane: SectionPlane,
  scale = 50,
): SectionAnnotationPayload {
  const polylines: SectionAnnotationPayload["polylines"] = [];
  for (const el of elements) {
    let template;
    try { template = getTemplate(el.templateId); } catch { continue; }
    if (!intersectsPlane(el, plane)) continue;
    const length = Math.hypot(el.end.x - el.start.x, el.end.z - el.start.z);
    if (length < 1e-6) continue;
    const solids = elementSolids(template, length, el.params, elementOpenings(el));
    const layers = template.materialLayers ?? [];
    for (let i = 0; i < solids.length; i++) {
      const s = solids[i];
      // Laag op zijn eigen cy-offset (dikte-richting), anders vallen alle
      // lagen van een meerlaags element op elkaar in de annotatie.
      const y0 = s.cy - s.dy / 2;
      const y1 = s.cy + s.dy / 2;
      const zBot = s.zBottom;
      const zTop = s.zBottom + s.dz;
      const material = layers[i]?.material ?? template.material ?? "Onbekend";
      polylines.push({
        material,
        points: [
          [y0, 0, zBot],
          [y1, 0, zBot],
          [y1, 0, zTop],
          [y0, 0, zTop],
        ],
      });
    }
  }
  return { planeNormal: plane.normal, planeOffset: plane.offset, scale, polylines };
}
