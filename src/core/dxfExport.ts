import type { LineSegment, MeasureSegment, PlacedElement, TextLabel } from "./types";
import { getTemplate } from "../catalog/registry";

/** 2D-DXF-export (bovenaanzicht) in millimeters.
 *
 * Coördinaten: three (x, y-omhoog, z) -> DXF (x, -z) — noorden is +Y in het DXF.
 * Elementen worden als gesloten contour (footprint) met merklabel geschreven,
 * elk op een laag per categorie. Leesbaar in AutoCAD/BricsCAD/QCAD (R12-stijl).
 */

const M2MM = 1000;

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}

class DxfWriter {
  private parts: string[] = [];
  readonly layers = new Set<string>();

  line(layer: string, x1: number, y1: number, x2: number, y2: number) {
    this.layers.add(layer);
    this.parts.push(
      "0", "LINE", "8", layer,
      "10", fmt(x1), "20", fmt(y1), "30", "0",
      "11", fmt(x2), "21", fmt(y2), "31", "0",
    );
  }

  text(layer: string, x: number, y: number, height: number, value: string) {
    this.layers.add(layer);
    this.parts.push(
      "0", "TEXT", "8", layer,
      "10", fmt(x), "20", fmt(y), "30", "0",
      "40", fmt(height), "1", value.replace(/[\r\n]/g, " "),
    );
  }

  toString(): string {
    const header = ["0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "4", "0", "ENDSEC"];
    const tables = [
      "0", "SECTION", "2", "TABLES", "0", "TABLE", "2", "LAYER",
      "70", String(this.layers.size),
      ...[...this.layers].flatMap((name) => [
        "0", "LAYER", "2", name, "70", "0", "62", "7", "6", "CONTINUOUS",
      ]),
      "0", "ENDTAB", "0", "ENDSEC",
    ];
    return [
      ...header,
      ...tables,
      "0", "SECTION", "2", "ENTITIES",
      ...this.parts,
      "0", "ENDSEC", "0", "EOF",
    ].join("\r\n");
  }
}

export function exportTopViewDxf(data: {
  elements: PlacedElement[];
  lines: LineSegment[];
  measures: MeasureSegment[];
  texts: TextLabel[];
}): string {
  const dxf = new DxfWriter();
  const X = (v: { x: number }) => v.x * M2MM;
  const Y = (v: { z: number }) => -v.z * M2MM;

  for (const el of data.elements) {
    const template = getTemplate(el.templateId);
    const depth = template.depth(el.params);
    const dx = el.end.x - el.start.x;
    const dz = el.end.z - el.start.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) continue;
    // footprint: rechthoek om de as, halve dikte naar weerszijden
    const ux = dx / len;
    const uz = dz / len;
    const nx = uz * (depth / 2);
    const nz = -ux * (depth / 2);
    const c = [
      { x: el.start.x + nx, z: el.start.z + nz },
      { x: el.end.x + nx, z: el.end.z + nz },
      { x: el.end.x - nx, z: el.end.z - nz },
      { x: el.start.x - nx, z: el.start.z - nz },
    ];
    for (let i = 0; i < 4; i++) {
      dxf.line(template.category, X(c[i]), Y(c[i]), X(c[(i + 1) % 4]), Y(c[(i + 1) % 4]));
    }
    const mid = { x: (el.start.x + el.end.x) / 2, z: (el.start.z + el.end.z) / 2 };
    dxf.text(template.category, X(mid), Y(mid) + depth * M2MM, 100, el.merk ?? el.name);
  }

  for (const l of data.lines) dxf.line("Lijnen", X(l.a), Y(l.a), X(l.b), Y(l.b));

  for (const m of data.measures) {
    dxf.line("Maatvoering", X(m.a), Y(m.a), X(m.b), Y(m.b));
    const mid = { x: (m.a.x + m.b.x) / 2, z: (m.a.z + m.b.z) / 2 };
    dxf.text("Maatvoering", X(mid), Y(mid) + 60, 80, `${Math.round(m.length * 1000)} mm`);
  }

  for (const t of data.texts) dxf.text("Teksten", X(t.position), Y(t.position), 120, t.text);

  return dxf.toString();
}
