import * as THREE from "three";
import DxfParser from "dxf-parser";

/** DXF-import als onderlegger.
 *
 * Ondersteunt LINE, LWPOLYLINE/POLYLINE (incl. bulge-bogen), CIRCLE, ARC,
 * ELLIPSE en INSERT (blokverwijzingen, recursief, incl. spiegeling en
 * niet-uniforme schaal via affiene matrices). Tekst en arceringen volgen later.
 *
 * Coördinaten: DXF (x=oost, y=noord) -> three.js (x, hoogte, -y), meters.
 * DWG is een gesloten formaat: converteer eerst naar DXF (bv. via ODA File Converter).
 */

export interface DxfImportResult {
  group: THREE.Group;
  name: string;
  entityCount: number;
  skipped: number;
}

const UNIT_TO_M: Record<number, number> = {
  1: 0.0254, // inch
  2: 0.3048, // feet
  4: 0.001, // mm
  5: 0.01, // cm
  6: 1, // m
};

type Pt = { x: number; y: number; z?: number; bulge?: number };

/** Affiene 2D-transformatie: x' = a·x + b·y + e ; y' = c·x + d·y + f.
 *  Matrices componeren correct, ook bij spiegeling en niet-uniforme schaal. */
interface Mat {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

const IDENTITY: Mat = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

function apply(m: Mat, p: { x: number; y: number }): { x: number; y: number } {
  return { x: m.a * p.x + m.b * p.y + m.e, y: m.c * p.x + m.d * p.y + m.f };
}

/** m2 ∘ m1: eerst m1, dan m2. */
function multiply(m2: Mat, m1: Mat): Mat {
  return {
    a: m2.a * m1.a + m2.b * m1.c,
    b: m2.a * m1.b + m2.b * m1.d,
    c: m2.c * m1.a + m2.d * m1.c,
    d: m2.c * m1.b + m2.d * m1.d,
    e: m2.a * m1.e + m2.b * m1.f + m2.e,
    f: m2.c * m1.e + m2.d * m1.f + m2.f,
  };
}

/** INSERT-transformatie: wereld = insertPos + R·S·(p − basispunt). */
function insertMatrix(
  insert: { x: number; y: number },
  base: { x: number; y: number },
  scaleX: number,
  scaleY: number,
  rotationRad: number,
): Mat {
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);
  // R·S
  const a = cos * scaleX;
  const b = -sin * scaleY;
  const c = sin * scaleX;
  const d = cos * scaleY;
  // e/f = insert − R·S·base
  return {
    a, b, c, d,
    e: insert.x - (a * base.x + b * base.y),
    f: insert.y - (c * base.x + d * base.y),
  };
}

export function importDxf(text: string, name: string): DxfImportResult {
  const parser = new DxfParser();
  const dxf: any = parser.parseSync(text);
  if (!dxf) throw new Error("DXF kon niet worden gelezen");

  const unit = UNIT_TO_M[dxf.header?.$INSUNITS as number] ?? 0.001; // standaard mm
  const group = new THREE.Group();
  const material = new THREE.LineBasicMaterial({ color: 0xb9b2a9 });
  let entityCount = 0;
  let skipped = 0;

  const toThree = (p: { x: number; y: number }, z = 0) =>
    new THREE.Vector3(p.x * unit, z * unit, -p.y * unit);

  const addPolyline = (pts: { x: number; y: number }[]) => {
    if (pts.length < 2) return;
    const geometry = new THREE.BufferGeometry().setFromPoints(pts.map((p) => toThree(p)));
    group.add(new THREE.Line(geometry, material));
    entityCount++;
  };

  /** Bulge tussen twee punten omzetten naar boogsegmenten.
   *  Het middelpunt ligt op afstand r·cos(θ/2) van het koordemidden (mét teken:
   *  negatief voor bogen > 180°), langs de linksnormaal × sign(θ). */
  const bulgeArc = (a: Pt, b: Pt, bulge: number): { x: number; y: number }[] => {
    const theta = 4 * Math.atan(bulge);
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    if (dist < 1e-12 || Math.abs(theta) < 1e-9) return [a, b];
    const radius = dist / (2 * Math.sin(Math.abs(theta) / 2));
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const dir = { x: (b.x - a.x) / dist, y: (b.y - a.y) / dist };
    // getekende apothema: cos(θ/2) wordt vanzelf negatief voor |θ| > π
    const apothem = radius * Math.cos(theta / 2) * Math.sign(theta);
    const center = { x: mid.x - dir.y * apothem, y: mid.y + dir.x * apothem };
    const a0 = Math.atan2(a.y - center.y, a.x - center.x);
    const steps = Math.max(4, Math.ceil(Math.abs(theta) / (Math.PI / 16)));
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const ang = a0 + (theta * i) / steps;
      pts.push({ x: center.x + radius * Math.cos(ang), y: center.y + radius * Math.sin(ang) });
    }
    return pts;
  };

  const circlePts = (cx: number, cy: number, r: number, a0: number, a1: number) => {
    while (a1 <= a0) a1 += Math.PI * 2;
    const steps = Math.max(8, Math.ceil((a1 - a0) / (Math.PI / 24)));
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const ang = a0 + ((a1 - a0) * i) / steps;
      pts.push({ x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
    }
    return pts;
  };

  const asRad = (v: number | undefined, fallback: number) => {
    if (v === undefined || v === null) return fallback;
    // dxf-parser geeft hoeken meestal in radialen; waarden > 2π duiden op graden
    return Math.abs(v) > Math.PI * 2 + 0.01 ? (v * Math.PI) / 180 : v;
  };

  const handleEntities = (entities: any[], t: Mat, depth: number) => {
    if (!entities || depth > 5) return;
    for (const e of entities) {
      try {
        switch (e.type) {
          case "LINE": {
            const v = e.vertices ?? [];
            if (v.length >= 2) addPolyline([apply(t, v[0]), apply(t, v[1])]);
            else skipped++;
            break;
          }
          case "LWPOLYLINE":
          case "POLYLINE": {
            const verts: Pt[] = e.vertices ?? [];
            if (verts.length < 2) {
              skipped++;
              break;
            }
            const pts: { x: number; y: number }[] = [];
            const closed = !!e.shape || !!(e.flags & 1);
            const n = closed ? verts.length : verts.length - 1;
            for (let i = 0; i < n; i++) {
              const a = verts[i];
              const b = verts[(i + 1) % verts.length];
              const seg = a.bulge ? bulgeArc(a, b, a.bulge) : [a, b];
              for (const p of i === 0 ? seg : seg.slice(1)) pts.push(p);
            }
            addPolyline(pts.map((p) => apply(t, p)));
            break;
          }
          case "CIRCLE": {
            addPolyline(
              circlePts(e.center.x, e.center.y, e.radius, 0, Math.PI * 2).map((p) => apply(t, p)),
            );
            break;
          }
          case "ARC": {
            const a0 = asRad(e.startAngle, 0);
            const a1 = asRad(e.endAngle, Math.PI * 2);
            addPolyline(circlePts(e.center.x, e.center.y, e.radius, a0, a1).map((p) => apply(t, p)));
            break;
          }
          case "ELLIPSE": {
            const major = { x: e.majorAxisEndPoint?.x ?? 1, y: e.majorAxisEndPoint?.y ?? 0 };
            const rMajor = Math.hypot(major.x, major.y);
            const rMinor = rMajor * (e.axisRatio ?? 1);
            const rot = Math.atan2(major.y, major.x);
            const a0 = asRad(e.startAngle, 0);
            let a1 = asRad(e.endAngle, Math.PI * 2);
            while (a1 <= a0) a1 += Math.PI * 2; // boog die parameter 0 kruist
            const steps = 48;
            const pts: { x: number; y: number }[] = [];
            for (let i = 0; i <= steps; i++) {
              const ang = a0 + ((a1 - a0) * i) / steps;
              const ex = rMajor * Math.cos(ang);
              const ey = rMinor * Math.sin(ang);
              pts.push({
                x: e.center.x + ex * Math.cos(rot) - ey * Math.sin(rot),
                y: e.center.y + ex * Math.sin(rot) + ey * Math.cos(rot),
              });
            }
            addPolyline(pts.map((p) => apply(t, p)));
            break;
          }
          case "INSERT": {
            const block = dxf.blocks?.[e.name];
            if (!block?.entities) {
              skipped++;
              break;
            }
            const local = insertMatrix(
              { x: e.position?.x ?? 0, y: e.position?.y ?? 0 },
              { x: block.position?.x ?? 0, y: block.position?.y ?? 0 },
              e.xScale ?? 1,
              e.yScale ?? 1,
              ((e.rotation ?? 0) * Math.PI) / 180,
            );
            handleEntities(block.entities, multiply(t, local), depth + 1);
            break;
          }
          default:
            skipped++;
        }
      } catch {
        skipped++;
      }
    }
  };

  handleEntities(dxf.entities ?? [], IDENTITY, 0);
  group.userData.dxfName = name;
  return { group, name, entityCount, skipped };
}
