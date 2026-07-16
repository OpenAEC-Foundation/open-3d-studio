import * as THREE from "three";
import type { ComponentTemplate, Opening, ParamValues, SolidBox } from "./types";

/** Past een sparing toe op de opbouw: doorsnijdt alle volumes binnen het sparingsgebied.
 *  Wordt door de 3D-weergave én de IFC-export gebruikt, zodat beide identiek blijven. */
export function applyOpening(solids: SolidBox[], opening: Opening): SolidBox[] {
  const x0 = opening.xPos - opening.breedte / 2;
  const x1 = opening.xPos + opening.breedte / 2;
  const out: SolidBox[] = [];
  for (const original of solids) {
    let s = original;
    const sx0 = s.cx - s.dx / 2;
    const sx1 = s.cx + s.dx / 2;
    if (sx1 <= x0 || sx0 >= x1 || s.zBottom >= opening.hoogte) {
      out.push(s);
      continue;
    }
    const zTop = s.zBottom + s.dz;
    if (zTop > opening.hoogte) {
      // bovenste deel steekt boven de sparing uit en blijft staan
      out.push({ ...s, zBottom: opening.hoogte, dz: zTop - opening.hoogte });
      s = { ...s, dz: opening.hoogte - s.zBottom };
    }
    if (sx0 < x0) out.push({ ...s, cx: (sx0 + x0) / 2, dx: x0 - sx0 });
    if (sx1 > x1) out.push({ ...s, cx: (x1 + sx1) / 2, dx: sx1 - x1 });
  }
  return out.filter((s) => s.dx > 0.001 && s.dz > 0.001);
}

/** Opbouw van een element inclusief eventuele sparing. */
export function elementSolids(
  template: ComponentTemplate,
  length: number,
  params: ParamValues,
  opening?: Opening | null,
): SolidBox[] {
  const solids = template.solids(length, params);
  return opening ? applyOpening(solids, opening) : solids;
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
  opening?: Opening | null,
): THREE.Group {
  const group = new THREE.Group();
  const solids = elementSolids(template, length, params, opening);

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
