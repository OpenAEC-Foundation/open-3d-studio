import * as THREE from "three";
import { findProfile } from "../../src/catalog/_shared/profiles";
import { getTemplate } from "../../src/catalog/registry";
import { buildElementGroup } from "../../src/core/meshBuilder";
import { profileExtrusion } from "../../src/core/profileGeometry";
import type { ProfileSpec } from "../../src/core/types";

/** Volume-orakel voor de echte profielgeometrie (geometrie-stap 1).
 *
 *  Toetst zonder scherm en zonder schema: het volume van de getrianguleerde
 *  extrusie, gedeeld door de lengte, moet de doorsnede-oppervlakte geven.
 *  De verwachting komt uit een ónafhankelijke analytische formule per vorm
 *  (staalconstructieleer, niet profileToShape zelf) op dezelfde EN-maten —
 *  ter ijking: IPE 200 geeft 2848 mm² waar de norm 28,5 cm² zegt, CHS
 *  193,7×6,3 geeft 3709 mm² waar de norm 37,1 cm² zegt.
 *
 *  Daarnaast twee integratietoetsen op buildElementGroup: een profiel-element
 *  levert één geëxtrudeerde mesh met de juiste omhullende en onderkant op 0;
 *  hetzelfde element mét sparing valt terug op de gesneden enveloppe-dozen.
 *
 *  Exit 0 = alles binnen de lat (1%). Exit 1 = ten minste één meting erbuiten. */

const LENGTH = 5.4;
const TOLERANTIE = 0.01;

/** Doorsnede-oppervlakte in m² — onafhankelijk van profileToShape. */
function analyticArea(spec: ProfileSpec): number {
  const d = spec.dimensions;
  const kwartFillet = (r: number) => (1 - Math.PI / 4) * r * r;
  let mm2: number;
  switch (spec.shape) {
    case "IShape": {
      const h = d.OverallDepth ?? 0, b = d.OverallWidth ?? 0;
      const tw = d.WebThickness ?? 0, tf = d.FlangeThickness ?? 0, r = d.FilletRadius ?? 0;
      mm2 = 2 * b * tf + (h - 2 * tf) * tw + 4 * kwartFillet(r);
      break;
    }
    case "UShape": {
      const h = d.OverallDepth ?? 0, b = d.FlangeWidth ?? 0;
      const tw = d.WebThickness ?? 0, tf = d.FlangeThickness ?? 0, r = d.FilletRadius ?? 0;
      mm2 = 2 * b * tf + (h - 2 * tf) * tw + 2 * kwartFillet(r);
      break;
    }
    case "LShape": {
      const h = d.Depth ?? 0, w = d.Width ?? 0, t = d.Thickness ?? 0, r = d.FilletRadius ?? 0;
      mm2 = t * (h + w - t) + kwartFillet(r);
      break;
    }
    case "RectangleHollow": {
      const h = d.XDim ?? 0, b = d.YDim ?? 0, t = d.WallThickness ?? 0;
      mm2 = h * b - (h - 2 * t) * (b - 2 * t);
      break;
    }
    case "CircleHollow": {
      const R = d.Radius ?? 0, t = d.WallThickness ?? 0;
      mm2 = Math.PI * (R * R - (R - t) * (R - t));
      break;
    }
    case "Rectangle":
      mm2 = (d.XDim ?? 0) * (d.YDim ?? 0);
      break;
    case "Circle":
      mm2 = Math.PI * (d.Radius ?? 0) * (d.Radius ?? 0);
      break;
    default:
      return NaN;
  }
  return mm2 * 1e-6;
}

/** Volume van een gesloten getrianguleerde mesh via de signed-tetraëder-som. */
function meshVolume(geometry: THREE.BufferGeometry): number {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = g.getAttribute("position");
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let zesV = 0;
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    zesV += a.dot(new THREE.Vector3().crossVectors(b, c));
  }
  return Math.abs(zesV) / 6;
}

const PROFIELEN = [
  "IPE 200",
  "HEA 160",
  "UNP 200",
  "RHS 200x100x6",
  "CHS Ø193.7x6.3",
  "L 100x100x10",
  "Glulam 400x240",
  "Beton Ø400",
];

let fouten = 0;
const meld = (regel: string) => console.log(regel);

for (const naam of PROFIELEN) {
  const spec = findProfile(naam);
  if (!spec) {
    meld(`FOUT  ${naam}: niet in de catalogus — het orakel toetst dan niets.`);
    fouten++;
    continue;
  }
  const geometry = profileExtrusion(spec, LENGTH);
  if (!geometry) {
    meld(`FOUT  ${naam}: profileExtrusion leverde geen geometrie.`);
    fouten++;
    continue;
  }
  const gemeten = meshVolume(geometry) / LENGTH;
  const verwacht = analyticArea(spec);
  const afwijking = Math.abs(gemeten - verwacht) / verwacht;
  const status = afwijking <= TOLERANTIE ? "ok   " : "FOUT ";
  if (afwijking > TOLERANTIE) fouten++;
  meld(
    `${status}${naam.padEnd(16)} A=${(verwacht * 1e6).toFixed(1).padStart(8)} mm²  ` +
      `mesh=${(gemeten * 1e6).toFixed(1).padStart(8)} mm²  afwijking ${(afwijking * 100).toFixed(3)}%`,
  );
}

// -- integratie 1: profiel-element → één geëxtrudeerde mesh, juiste omhullende --
const staal = getTemplate("staalprofiel-nen10365");
if (!staal) {
  meld("FOUT  staalprofiel-nen10365 niet in de catalogus.");
  fouten++;
} else {
  const group = buildElementGroup(staal, LENGTH, { ...staal.defaults, profiel: "HEA 160" });
  const meshes: THREE.Mesh[] = [];
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  const bbox = new THREE.Box3().setFromObject(group);
  const maat = new THREE.Vector3();
  bbox.getSize(maat);
  // HEA 160: h = 152 mm (kleiner dan de naam), b = 160 mm.
  const ok =
    meshes.length === 1 &&
    meshes[0].geometry.type === "ExtrudeGeometry" &&
    Math.abs(maat.x - LENGTH) < 0.001 &&
    Math.abs(maat.y - 0.152) < 0.001 &&
    Math.abs(maat.z - 0.16) < 0.001 &&
    Math.abs(bbox.min.y) < 0.001;
  if (!ok) fouten++;
  meld(
    `${ok ? "ok   " : "FOUT "}buildElementGroup HEA 160: ${meshes.length} mesh (${meshes[0]?.geometry.type}), ` +
      `bbox ${maat.x.toFixed(3)}×${maat.y.toFixed(3)}×${maat.z.toFixed(3)} m, onderkant y=${bbox.min.y.toFixed(4)}`,
  );

  // -- integratie 2: mét sparing → terugval op gesneden enveloppe-dozen --
  const metGat = buildElementGroup(staal, LENGTH, { ...staal.defaults }, {}, [
    { xPos: LENGTH / 2, breedte: 0.5, hoogte: 0.1, zBottom: 0.05 },
  ]);
  const dozen: THREE.Mesh[] = [];
  metGat.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) dozen.push(o as THREE.Mesh);
  });
  const alleDozen = dozen.length >= 3 && dozen.every((m) => m.geometry.type === "BoxGeometry");
  if (!alleDozen) fouten++;
  meld(
    `${alleDozen ? "ok   " : "FOUT "}buildElementGroup met sparing: ${dozen.length} dozen ` +
      `(${[...new Set(dozen.map((m) => m.geometry.type))].join(", ")})`,
  );
}

if (fouten > 0) {
  meld(`GEOMETRIE-ORAKEL ROOD — ${fouten} meting(en) buiten de lat.`);
  process.exit(1);
}
meld(`GEOMETRIE-ORAKEL GROEN — ${PROFIELEN.length} profielen binnen ${TOLERANTIE * 100}% + 2 integratietoetsen.`);
