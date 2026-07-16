import * as THREE from "three";
import type { ComponentTemplate, Opening, ParamValues, SolidBox } from "./types";

/** Past één rechthoekige sparing toe: doorsnijdt volumes binnen het gebied
 *  [x0,x1] × [z0,z1] (as-richting × hoogte). Basisbouwsteen voor alle vormen. */
function cutRect(solids: SolidBox[], x0: number, x1: number, z0: number, z1: number): SolidBox[] {
  const out: SolidBox[] = [];
  for (const original of solids) {
    let s = original;
    const sx0 = s.cx - s.dx / 2;
    const sx1 = s.cx + s.dx / 2;
    const szTop = s.zBottom + s.dz;
    if (sx1 <= x0 || sx0 >= x1 || s.zBottom >= z1 || szTop <= z0) {
      out.push(s);
      continue;
    }
    if (szTop > z1) {
      out.push({ ...s, zBottom: z1, dz: szTop - z1 }); // boven de sparing
      s = { ...s, dz: z1 - s.zBottom };
    }
    if (s.zBottom < z0) {
      out.push({ ...s, dz: z0 - s.zBottom }); // onder de sparing (borstwering)
      s = { ...s, zBottom: z0, dz: s.zBottom + s.dz - z0 };
    }
    if (sx0 < x0) out.push({ ...s, cx: (sx0 + x0) / 2, dx: x0 - sx0 });
    if (sx1 > x1) out.push({ ...s, cx: (x1 + sx1) / 2, dx: sx1 - x1 });
  }
  return out.filter((s) => s.dx > 0.001 && s.dz > 0.001);
}

/** Rechthoekig gat in het vlak (vloer/dak): doorsnijdt in x (as) én y (dwars),
 *  door de volledige dikte. */
function cutPlanRect(solids: SolidBox[], x0: number, x1: number, y0: number, y1: number): SolidBox[] {
  const out: SolidBox[] = [];
  for (const original of solids) {
    let s = original;
    const sx0 = s.cx - s.dx / 2;
    const sx1 = s.cx + s.dx / 2;
    const sy0 = s.cy - s.dy / 2;
    const sy1 = s.cy + s.dy / 2;
    if (sx1 <= x0 || sx0 >= x1 || sy1 <= y0 || sy0 >= y1) {
      out.push(s);
      continue;
    }
    // strook boven het gat (y > y1)
    if (sy1 > y1) {
      out.push({ ...s, cy: (y1 + sy1) / 2, dy: sy1 - y1 });
      s = { ...s, cy: (sy0 + y1) / 2, dy: y1 - sy0 };
    }
    // strook onder het gat (y < y0)
    const curY0 = s.cy - s.dy / 2;
    if (curY0 < y0) {
      out.push({ ...s, cy: (curY0 + y0) / 2, dy: y0 - curY0 });
      const curY1 = s.cy + s.dy / 2;
      s = { ...s, cy: (y0 + curY1) / 2, dy: curY1 - y0 };
    }
    // stroken links/rechts van het gat (x)
    if (sx0 < x0) out.push({ ...s, cx: (sx0 + x0) / 2, dx: x0 - sx0 });
    if (sx1 > x1) out.push({ ...s, cx: (x1 + sx1) / 2, dx: sx1 - x1 });
  }
  return out.filter((s) => s.dx > 0.001 && s.dy > 0.001);
}

const ROUND_STRIPS = 12;
const POLY_STRIPS = 16;

/** Scanline-doorsnijding van een simpele polygoon (even-odd): levert per
 *  x-strip de [min,max]-paren van de tweede coördinaat. Werkt ook voor
 *  concave polygonen. */
function polyStripIntervals(points: [number, number][]): { x0: number; x1: number; pairs: [number, number][] }[] {
  if (points.length < 3) return [];
  const xs = points.map((p) => p[0]);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  if (xMax - xMin < 0.002) return [];
  const strips: { x0: number; x1: number; pairs: [number, number][] }[] = [];
  for (let i = 0; i < POLY_STRIPS; i++) {
    const x0 = xMin + ((xMax - xMin) * i) / POLY_STRIPS;
    const x1 = xMin + ((xMax - xMin) * (i + 1)) / POLY_STRIPS;
    const xm = (x0 + x1) / 2;
    // snijpunten van de scanlijn x=xm met de polygonranden
    const crossings: number[] = [];
    for (let k = 0; k < points.length; k++) {
      const [ax, ay] = points[k];
      const [bx, by] = points[(k + 1) % points.length];
      if ((ax <= xm && bx > xm) || (bx <= xm && ax > xm)) {
        const t = (xm - ax) / (bx - ax);
        crossings.push(ay + t * (by - ay));
      }
    }
    crossings.sort((a, b) => a - b);
    const pairs: [number, number][] = [];
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      if (crossings[k + 1] - crossings[k] > 0.002) pairs.push([crossings[k], crossings[k + 1]]);
    }
    if (pairs.length > 0) strips.push({ x0, x1, pairs });
  }
  return strips;
}

/** Past een lijst sparingen toe. `plan` = vlak-element (vloer/dak): gat in het
 *  grondvlak i.p.v. in het opstaande vlak. Rond wordt benaderd met verticale
 *  strips (beslissing v0.7-8: geen CSG-dependency). */
export function applyOpenings(solids: SolidBox[], openings: Opening[], plan = false): SolidBox[] {
  let out = solids;
  for (const op of openings) {
    const zBottom = op.zBottom ?? 0;
    if (op.shape === "poly" && op.points && op.points.length >= 3) {
      // vrije polygoon (v0.8): scanline-strips, ook concaaf correct (even-odd)
      for (const strip of polyStripIntervals(op.points)) {
        for (const [c0, c1] of strip.pairs) {
          out = plan
            ? cutPlanRect(out, strip.x0, strip.x1, c0, c1)
            : cutRect(out, strip.x0, strip.x1, c0, c1);
        }
      }
    } else if (op.shape === "round") {
      const r = op.breedte / 2;
      for (let i = 0; i < ROUND_STRIPS; i++) {
        const xa = -r + (2 * r * i) / ROUND_STRIPS;
        const xb = -r + (2 * r * (i + 1)) / ROUND_STRIPS;
        const xm = (xa + xb) / 2;
        const half = Math.sqrt(Math.max(0, r * r - xm * xm));
        if (half < 0.001) continue;
        if (plan) {
          out = cutPlanRect(out, op.xPos + xa, op.xPos + xb, (op.yPos ?? 0) - half, (op.yPos ?? 0) + half);
        } else {
          const zc = zBottom + r; // rond gat: zBottom = onderkant cirkel
          out = cutRect(out, op.xPos + xa, op.xPos + xb, zc - half, zc + half);
        }
      }
    } else {
      const x0 = op.xPos - op.breedte / 2;
      const x1 = op.xPos + op.breedte / 2;
      if (plan) {
        const h = op.hoogte > 0 ? op.hoogte : op.breedte; // hoogte = dwarsmaat bij vlak
        out = cutPlanRect(out, x0, x1, (op.yPos ?? 0) - h / 2, (op.yPos ?? 0) + h / 2);
      } else {
        out = cutRect(out, x0, x1, zBottom, zBottom + op.hoogte);
      }
    }
  }
  return out;
}

/** Sparingen van een element: v0.7-array + legacy enkelvoudig veld samengevoegd. */
export function elementOpenings(el: { opening?: Opening | null; openings?: Opening[] }): Opening[] {
  const list = [...(el.openings ?? [])];
  if (el.opening) list.push(el.opening);
  return list;
}

/** Opbouw van een element inclusief sparingen. Accepteert zowel de v0.7-lijst
 *  als het legacy enkelvoudige veld. */
export function elementSolids(
  template: ComponentTemplate,
  length: number,
  params: ParamValues,
  openings?: Opening | Opening[] | null,
): SolidBox[] {
  const solids = template.solids(length, params);
  const list = Array.isArray(openings) ? openings : openings ? [openings] : [];
  if (list.length === 0) return solids;
  return applyOpenings(solids, list, template.placementKind === "surface");
}

/** Bouwt de three.js-weergave van een component uit dezelfde solids-definitie
 *  die ook voor de IFC-export wordt gebruikt.
 *
 *  Wand-lokale coördinaten (IFC-conventie): x = langs de wand, y = dikte, z = omhoog.
 *  three.js: x = langs de wand, y = omhoog, z = -dikte.
 */
export function buildElementGroup(
  template: ComponentTemplate,
  length: number,
  params: ParamValues,
  opts: {
    preview?: boolean;
    selected?: boolean;
    /** Grafische override op basis van bouwkundige fase (v0.5).
     *  Kleur overschrijft template.color; opacity werkt bovenop preview-alpha. */
    phaseColor?: string;
    phaseOpacity?: number;
    /** Streeplijnstijl (bv. te slopen): rendert extra wireframe over de mesh. */
    phaseWireframe?: boolean;
  } = {},
  openings?: Opening | Opening[] | null,
): THREE.Group {
  const group = new THREE.Group();
  const solids = elementSolids(template, length, params, openings);

  const baseColor = opts.phaseColor ?? template.color(params);
  const opacityRaw = (opts.preview ? 0.55 : 1) * (opts.phaseOpacity ?? 1);
  const transparent = opts.preview || (opts.phaseOpacity !== undefined && opts.phaseOpacity < 1);
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(baseColor),
    roughness: 0.55,
    metalness: 0.35,
    transparent,
    opacity: opacityRaw,
    emissive: opts.selected ? new THREE.Color("#d97706") : new THREE.Color("#000000"),
    emissiveIntensity: opts.selected ? 0.45 : 0,
  });

  for (const s of solids) {
    const geometry = new THREE.BoxGeometry(s.dx, s.dz, s.dy);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(s.cx, s.zBottom + s.dz / 2, -s.cy);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
    if (opts.phaseWireframe) {
      const edges = new THREE.EdgesGeometry(geometry);
      const line = new THREE.LineSegments(
        edges,
        new THREE.LineDashedMaterial({
          color: new THREE.Color(baseColor).offsetHSL(0, 0.2, -0.1),
          dashSize: 0.15,
          gapSize: 0.08,
        }),
      );
      line.position.copy(mesh.position);
      line.computeLineDistances();
      group.add(line);
    }
  }

  return group;
}

export function disposeGroup(group: THREE.Object3D) {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    const disposeMat = (m: THREE.Material) => {
      const map = (m as THREE.MeshStandardMaterial).map;
      if (map) map.dispose();
      m.dispose();
    };
    if (Array.isArray(mat)) mat.forEach(disposeMat);
    else if (mat) disposeMat(mat);
  });
}
