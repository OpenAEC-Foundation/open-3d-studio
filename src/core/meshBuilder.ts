import * as THREE from "three";
import type { ComponentTemplate, ParamValues } from "./types";

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
  opts: { preview?: boolean; selected?: boolean } = {},
): THREE.Group {
  const group = new THREE.Group();
  const solids = template.solids(length, params);

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(template.color(params)),
    roughness: 0.55,
    metalness: 0.35,
    transparent: !!opts.preview,
    opacity: opts.preview ? 0.55 : 1,
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
