import * as THREE from "three";
import type { ComponentTemplate, ParamValues, ProfileSpec } from "./types";

/** Echte doorsnede-geometrie voor constructieprofielen (geometrie-stap 1).
 *
 *  Tot v0.8 was elk profiel een enveloppe-doos: een IPE-ligger wás een
 *  rechthoek, in de 3D-weergave én in de IFC-body. Dit bestand levert de échte
 *  doorsnede als THREE.Shape — met fillet-bogen waar de norm ze heeft en met
 *  gaten voor kokers en buizen — in het (u,v)-vlak: u = dwars op de elementas,
 *  v = omhoog, gecentreerd op het midden van de omhullende. Eenheid: meters.
 *
 *  De IFC-kant heeft deze contour niet nodig (IfcProfileDef is parametrisch);
 *  de mesh (meshBuilder) en het volume-orakel (tests/headless) wel. Bewust
 *  geen web-ifc-import hier: dit blijft zuiver three + rekenwerk. */

const MM = 0.001;

/** Profiel voor dít element: parametrisch (`profileSpecFor`) wint van het
 *  statische template-veld. Eén resolutieplek voor mesh én export. */
export function resolveProfileSpec(
  template: Pick<ComponentTemplate, "profileSpec" | "profileSpecFor">,
  params: ParamValues,
): ProfileSpec | undefined {
  return template.profileSpecFor?.(params) ?? template.profileSpec;
}

/** Hoogte van de doorsnede in meters (v-richting) — nodig om het gecentreerde
 *  profiel op onderkant = 0 te leggen, zoals de enveloppe-doos dat deed. */
export function profileHeight(spec: ProfileSpec): number {
  const d = spec.dimensions;
  switch (spec.shape) {
    case "IShape":
    case "UShape":
      return (d.OverallDepth ?? 200) * MM;
    case "LShape":
      return (d.Depth ?? 100) * MM;
    case "RectangleHollow":
    case "Rectangle":
      // Conventie van de templates (envelope/solids): XDim is de hoogte.
      return (d.XDim ?? 200) * MM;
    case "CircleHollow":
    case "Circle":
      return (d.Radius ?? 100) * 2 * MM;
    default:
      return 0.2;
  }
}

/** Kwart-fillet met de klok mee, van `fromAngle` naar `toAngle` (radialen). */
function fillet(
  shape: THREE.Shape,
  cx: number,
  cy: number,
  r: number,
  fromAngle: number,
  toAngle: number,
): void {
  if (r > 0) shape.absarc(cx, cy, r, fromAngle, toAngle, true);
}

/** De doorsnede als THREE.Shape (holes inbegrepen), of null voor een vorm
 *  zonder contourdefinitie. Alle vormen uit de profielcatalogus worden gedekt. */
export function profileToShape(spec: ProfileSpec): THREE.Shape | null {
  const d = spec.dimensions;
  const shape = new THREE.Shape();
  switch (spec.shape) {
    case "IShape": {
      const h = (d.OverallDepth ?? 200) * MM;
      const b = (d.OverallWidth ?? 100) * MM;
      const tw = (d.WebThickness ?? 6) * MM;
      const tf = (d.FlangeThickness ?? 10) * MM;
      const r = (d.FilletRadius ?? 0) * MM;
      // Rechtsom vanaf rechtsonder; vier binnenhoeken lijf/flens met radius r.
      shape.moveTo(b / 2, -h / 2);
      shape.lineTo(b / 2, -h / 2 + tf);
      shape.lineTo(tw / 2 + r, -h / 2 + tf);
      fillet(shape, tw / 2 + r, -h / 2 + tf + r, r, -Math.PI / 2, -Math.PI);
      shape.lineTo(tw / 2, h / 2 - tf - r);
      fillet(shape, tw / 2 + r, h / 2 - tf - r, r, Math.PI, Math.PI / 2);
      shape.lineTo(b / 2, h / 2 - tf);
      shape.lineTo(b / 2, h / 2);
      shape.lineTo(-b / 2, h / 2);
      shape.lineTo(-b / 2, h / 2 - tf);
      shape.lineTo(-tw / 2 - r, h / 2 - tf);
      fillet(shape, -tw / 2 - r, h / 2 - tf - r, r, Math.PI / 2, 0);
      shape.lineTo(-tw / 2, -h / 2 + tf + r);
      fillet(shape, -tw / 2 - r, -h / 2 + tf + r, r, 0, -Math.PI / 2);
      shape.lineTo(-b / 2, -h / 2 + tf);
      shape.lineTo(-b / 2, -h / 2);
      shape.closePath();
      return shape;
    }
    case "UShape": {
      const h = (d.OverallDepth ?? 200) * MM;
      const b = (d.FlangeWidth ?? 80) * MM;
      const tw = (d.WebThickness ?? 6) * MM;
      const tf = (d.FlangeThickness ?? 10) * MM;
      const r = (d.FilletRadius ?? 0) * MM;
      // Lijf links, flenzen naar rechts; twee binnenhoeken met radius r.
      shape.moveTo(-b / 2, -h / 2);
      shape.lineTo(b / 2, -h / 2);
      shape.lineTo(b / 2, -h / 2 + tf);
      shape.lineTo(-b / 2 + tw + r, -h / 2 + tf);
      fillet(shape, -b / 2 + tw + r, -h / 2 + tf + r, r, -Math.PI / 2, -Math.PI);
      shape.lineTo(-b / 2 + tw, h / 2 - tf - r);
      fillet(shape, -b / 2 + tw + r, h / 2 - tf - r, r, Math.PI, Math.PI / 2);
      shape.lineTo(b / 2, h / 2 - tf);
      shape.lineTo(b / 2, h / 2);
      shape.lineTo(-b / 2, h / 2);
      shape.closePath();
      return shape;
    }
    case "LShape": {
      const h = (d.Depth ?? 100) * MM;
      const w = (d.Width ?? 100) * MM;
      const t = (d.Thickness ?? 10) * MM;
      const r = (d.FilletRadius ?? 0) * MM;
      // Verticale poot links, horizontale poot onder; één binnenhoek.
      shape.moveTo(-w / 2, -h / 2);
      shape.lineTo(w / 2, -h / 2);
      shape.lineTo(w / 2, -h / 2 + t);
      shape.lineTo(-w / 2 + t + r, -h / 2 + t);
      fillet(shape, -w / 2 + t + r, -h / 2 + t + r, r, -Math.PI / 2, -Math.PI);
      shape.lineTo(-w / 2 + t, h / 2);
      shape.lineTo(-w / 2, h / 2);
      shape.closePath();
      return shape;
    }
    case "RectangleHollow": {
      // Conventie van de templates: XDim = hoogte (v), YDim = breedte (u).
      const h = (d.XDim ?? 200) * MM;
      const b = (d.YDim ?? 100) * MM;
      const t = (d.WallThickness ?? 5) * MM;
      shape.moveTo(-b / 2, -h / 2);
      shape.lineTo(b / 2, -h / 2);
      shape.lineTo(b / 2, h / 2);
      shape.lineTo(-b / 2, h / 2);
      shape.closePath();
      const hole = new THREE.Path();
      hole.moveTo(-b / 2 + t, -h / 2 + t);
      hole.lineTo(b / 2 - t, -h / 2 + t);
      hole.lineTo(b / 2 - t, h / 2 - t);
      hole.lineTo(-b / 2 + t, h / 2 - t);
      hole.closePath();
      shape.holes.push(hole);
      return shape;
    }
    case "Rectangle": {
      const h = (d.XDim ?? 200) * MM;
      const b = (d.YDim ?? 100) * MM;
      shape.moveTo(-b / 2, -h / 2);
      shape.lineTo(b / 2, -h / 2);
      shape.lineTo(b / 2, h / 2);
      shape.lineTo(-b / 2, h / 2);
      shape.closePath();
      return shape;
    }
    case "CircleHollow": {
      const r = (d.Radius ?? 100) * MM;
      const t = (d.WallThickness ?? 5) * MM;
      shape.absarc(0, 0, r, 0, Math.PI * 2, false);
      const hole = new THREE.Path();
      hole.absarc(0, 0, Math.max(r - t, 0.001), 0, Math.PI * 2, true);
      shape.holes.push(hole);
      return shape;
    }
    case "Circle": {
      const r = (d.Radius ?? 100) * MM;
      shape.absarc(0, 0, r, 0, Math.PI * 2, false);
      return shape;
    }
    default:
      return null;
  }
}

/** Segmenten per curve. Fillets zijn kwartcirkels — 12 volstaat (oppervlakte-
 *  fout ~0,03%). Maar een volle cirkel (buis, ronde kolom) is in THREE één
 *  curve: bij 12 wordt dat een twaalfhoek met 4,5% oppervlaktefout, gemeten
 *  in het volume-orakel. Rond krijgt daarom 96 (fout ~0,07%). */
function curveSegmentsFor(spec: ProfileSpec): number {
  return spec.shape === "Circle" || spec.shape === "CircleHollow" ? 96 : 12;
}

/** Geëxtrudeerde profielgeometrie langs de elementas: doorsnede in het
 *  (dwars, omhoog)-vlak, lengte langs +x, onderkant op v = 0 verlegd door de
 *  aanroeper (profielhart ligt hier op de oorsprong). */
export function profileExtrusion(spec: ProfileSpec, length: number): THREE.BufferGeometry | null {
  const shape = profileToShape(spec);
  if (!shape) return null;
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: length,
    bevelEnabled: false,
    curveSegments: curveSegmentsFor(spec),
  });
  // Extrusie loopt langs +z; de elementas is +x (three-lokaal). Na deze
  // rotatie: x = as, y = omhoog (profiel-v), z = -dwars (profiel-u negatief).
  geometry.rotateY(Math.PI / 2);
  return geometry;
}
