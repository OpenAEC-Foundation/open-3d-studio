import * as THREE from "three";
import type { MeasureSegment, Sheet, SheetViewport, ViewName } from "./types";

/** Sheets: tekeningbladen met afdrukvensters op ware schaal en een titelblok.
 *
 * Elk venster wordt orthografisch gerenderd met een frustum dat exact past bij
 * papiermaat × schaal, zodat 1:50 op papier ook echt 1:50 is.
 */

export interface SheetRenderContext {
  scene: THREE.Scene;
  /** omhullende doos van de te tekenen inhoud (wereld, meters) */
  contentBox: THREE.Box3;
  /** objecten die niet mee-geprint worden (raster, assenkruis, voorbeeld) */
  hide: THREE.Object3D[];
  /** groepen waarvan lijnkleuren tijdelijk donker worden op wit papier */
  darkenLines: THREE.Object3D[];
  /** maatvoering uit het model, als vector op de bladen getekend */
  measures: MeasureSegment[];
  projectName: string;
}

/** Schermassen (rechts/omhoog) van een aanzicht, voor projectie wereld -> papier. */
function viewBasis(view: ViewName): { right: THREE.Vector3; up: THREE.Vector3 } {
  switch (view) {
    case "top":
      return { right: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 0, -1) };
    case "front":
      return { right: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 1, 0) };
    case "back":
      return { right: new THREE.Vector3(-1, 0, 0), up: new THREE.Vector3(0, 1, 0) };
    case "right":
      return { right: new THREE.Vector3(0, 0, -1), up: new THREE.Vector3(0, 1, 0) };
    case "left":
      return { right: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0) };
    default:
      return { right: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 1, 0) };
  }
}

const PAPER_MM: Record<Sheet["format"], [number, number]> = {
  A4: [297, 210],
  A3: [420, 297],
  A2: [594, 420],
  A1: [841, 594],
};

const VIEW_LABEL: Record<ViewName, string> = {
  iso: "3D-weergave",
  top: "Bovenaanzicht",
  front: "Vooraanzicht",
  back: "Achteraanzicht",
  left: "Linkeraanzicht",
  right: "Rechteraanzicht",
};

const DPI = 150;
const mmToPx = (mm: number) => Math.round((mm * DPI) / 25.4);

function viewCamera(
  view: ViewName,
  center: THREE.Vector3,
  worldW: number,
  worldH: number,
  distance: number,
): THREE.OrthographicCamera {
  const cam = new THREE.OrthographicCamera(
    -worldW / 2,
    worldW / 2,
    worldH / 2,
    -worldH / 2,
    0.1,
    distance * 4,
  );
  const offsets: Record<ViewName, [THREE.Vector3, THREE.Vector3]> = {
    top: [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1)],
    front: [new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)],
    back: [new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0)],
    right: [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)],
    left: [new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0)],
    iso: [new THREE.Vector3(1, 0.8, 1).normalize(), new THREE.Vector3(0, 1, 0)],
  };
  const [dir, up] = offsets[view];
  cam.position.copy(center).addScaledVector(dir, distance);
  cam.up.copy(up);
  cam.lookAt(center);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
  return cam;
}

export async function renderSheetPdf(ctx: SheetRenderContext, sheet: Sheet): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  let [pw, ph] = PAPER_MM[sheet.format];
  if (!sheet.landscape) [pw, ph] = [ph, pw];

  const doc = new jsPDF({
    orientation: sheet.landscape ? "landscape" : "portrait",
    unit: "mm",
    format: sheet.format.toLowerCase(),
  });

  const margin = 10;
  const titleH = 22;
  const contentW = pw - margin * 2;
  const contentH = ph - margin * 2 - titleH;

  // rasterindeling van de vensters
  const n = Math.max(1, sheet.viewports.length);
  const cols = n > 1 ? 2 : 1;
  const rows = Math.ceil(n / cols);
  const gap = 6;
  const cellW = (contentW - gap * (cols - 1)) / cols;
  const cellH = (contentH - gap * (rows - 1)) / rows;

  // offscreen renderer voor de vensters
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);

  const prevVisibility = ctx.hide.map((o) => o.visible);
  ctx.hide.forEach((o) => (o.visible = false));
  const prevBackground = ctx.scene.background;
  ctx.scene.background = new THREE.Color("#ffffff");

  // lijnwerk tijdelijk donker maken voor wit papier
  const recolored: { mat: THREE.LineBasicMaterial; color: number }[] = [];
  for (const root of ctx.darkenLines) {
    root.traverse((obj) => {
      const line = obj as THREE.Line;
      if ((line as any).isLine) {
        const mat = line.material as THREE.LineBasicMaterial;
        recolored.push({ mat, color: mat.color.getHex() });
        mat.color.setHex(0x2a2a2a);
      }
    });
  }

  try {
    const center = ctx.contentBox.isEmpty()
      ? new THREE.Vector3()
      : ctx.contentBox.getBoundingSphere(new THREE.Sphere()).center;
    const radius = ctx.contentBox.isEmpty()
      ? 5
      : Math.max(1, ctx.contentBox.getBoundingSphere(new THREE.Sphere()).radius);

    sheet.viewports.forEach((vp: SheetViewport, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = margin + col * (cellW + gap);
      const y = margin + row * (cellH + gap);

      // beeldmaat in de wereld: papier-mm × schaal, voor iso: passend (niet op schaal)
      let worldW: number;
      let worldH: number;
      if (vp.view === "iso") {
        const fit = radius * 2.4;
        worldW = fit * (cellW / cellH);
        worldH = fit;
        if (worldW < fit) {
          worldW = fit;
          worldH = fit * (cellH / cellW);
        }
      } else {
        worldW = (cellW / 1000) * vp.scale;
        worldH = (cellH / 1000) * vp.scale;
      }

      renderer.setSize(mmToPx(cellW), mmToPx(cellH));
      const cam = viewCamera(vp.view, center, worldW, worldH, radius * 3 + 10);
      renderer.render(ctx.scene, cam);
      const png = renderer.domElement.toDataURL("image/png");

      doc.addImage(png, "PNG", x, y, cellW, cellH);
      doc.setDrawColor(40);
      doc.setLineWidth(0.3);
      doc.rect(x, y, cellW, cellH);

      // venster-label
      const label =
        vp.view === "iso"
          ? `${VIEW_LABEL[vp.view]} (niet op schaal)`
          : `${VIEW_LABEL[vp.view]}  1:${vp.scale}`;
      doc.setFontSize(9);
      doc.setTextColor(30);
      doc.setFillColor(255, 255, 255);
      doc.rect(x + 1.5, y + cellH - 7, Math.max(40, label.length * 1.8), 5.5, "F");
      doc.text(label, x + 3, y + cellH - 3);

      if (vp.view !== "iso") {
        // projectie wereld -> papier (mm) voor vector-annotaties
        const { right, up } = viewBasis(vp.view);
        const toPaper = (p: THREE.Vector3): [number, number] => {
          const rel = p.clone().sub(center);
          return [
            x + cellW / 2 + (rel.dot(right) * 1000) / vp.scale,
            y + cellH / 2 - (rel.dot(up) * 1000) / vp.scale,
          ];
        };
        const binnen = ([px, py]: [number, number]) =>
          px > x + 1 && px < x + cellW - 1 && py > y + 1 && py < y + cellH - 1;

        // maatvoering als vector
        doc.setDrawColor(180, 90, 10);
        doc.setTextColor(150, 75, 5);
        doc.setLineWidth(0.25);
        doc.setFontSize(7);
        for (const m of ctx.measures) {
          const a = toPaper(m.a);
          const b = toPaper(m.b);
          if (!binnen(a) || !binnen(b)) continue;
          doc.line(a[0], a[1], b[0], b[1]);
          const tick = 0.8;
          doc.line(a[0] - tick, a[1] + tick, a[0] + tick, a[1] - tick);
          doc.line(b[0] - tick, b[1] + tick, b[0] + tick, b[1] - tick);
          doc.text(`${Math.round(m.length * 1000)}`, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 1, {
            align: "center",
          });
        }

        // schaalbalk linksonder (1 m-blokken, totaal ~5 m of passend)
        const blokken = 5;
        const blokPapier = 1000 / vp.scale;
        if (blokPapier * blokken < cellW * 0.5) {
          const sx = x + 4;
          const sy = y + cellH - 11;
          doc.setLineWidth(0.2);
          doc.setDrawColor(30);
          for (let bIdx = 0; bIdx < blokken; bIdx++) {
            if (bIdx % 2 === 0) doc.setFillColor(30, 30, 30);
            else doc.setFillColor(255, 255, 255);
            doc.rect(sx + bIdx * blokPapier, sy, blokPapier, 1.4, "FD");
          }
          doc.setFontSize(6);
          doc.setTextColor(30);
          doc.text("0", sx, sy - 0.8);
          doc.text(`${blokken} m`, sx + blokken * blokPapier, sy - 0.8, { align: "right" });
        }

        // noordpijl (alleen bovenaanzicht; boven = noorden)
        if (vp.view === "top") {
          const nx = x + cellW - 8;
          const ny = y + 10;
          doc.setDrawColor(30);
          doc.setFillColor(30, 30, 30);
          doc.setLineWidth(0.3);
          doc.triangle(nx, ny - 4.5, nx - 2, ny + 2.5, nx + 2, ny + 2.5, "FD");
          doc.setFontSize(8);
          doc.setTextColor(30);
          doc.text("N", nx, ny + 6.5, { align: "center" });
        }
      }
    });

    // titelblok
    const tby = ph - margin - titleH;
    doc.setDrawColor(40);
    doc.setLineWidth(0.4);
    doc.rect(margin, tby, contentW, titleH);
    doc.line(margin + contentW * 0.45, tby, margin + contentW * 0.45, tby + titleH);
    doc.line(margin + contentW * 0.75, tby, margin + contentW * 0.75, tby + titleH);
    doc.line(margin, tby + titleH / 2, margin + contentW, tby + titleH / 2);

    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text(ctx.projectName, margin + 3, tby + 6.5);
    doc.setFontSize(9);
    doc.text("Open 3D Studio — OpenAEC", margin + 3, tby + titleH - 4);

    doc.setFontSize(10);
    doc.text(`Blad: ${sheet.name}`, margin + contentW * 0.45 + 3, tby + 6.5);
    doc.text(`Nummer: ${sheet.number}`, margin + contentW * 0.45 + 3, tby + titleH - 4);

    const schalen = [
      ...new Set(
        sheet.viewports.map((v) => (v.view === "iso" ? "n.o.s." : `1:${v.scale}`)),
      ),
    ].join(", ");
    doc.text(`Formaat: ${sheet.format} ${sheet.landscape ? "liggend" : "staand"}`, margin + contentW * 0.75 + 3, tby + 6.5);
    doc.text(
      `Schaal: ${schalen || "-"}  ·  ${new Date().toLocaleDateString("nl-NL")}`,
      margin + contentW * 0.75 + 3,
      tby + titleH - 4,
    );

    return doc.output("blob");
  } finally {
    ctx.scene.background = prevBackground;
    ctx.hide.forEach((o, i) => (o.visible = prevVisibility[i]));
    for (const { mat, color } of recolored) mat.color.setHex(color);
    renderer.dispose();
  }
}
