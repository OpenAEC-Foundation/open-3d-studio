import { useEffect, useRef, useState } from "react";
import type { Sheet, SheetAnnotation, SheetViewport, ViewName } from "../core/types";

/** Sheet-preview (v0.5-S3: annotaties + associatieve maten).
 *
 *  Toont een SVG-papiervel op ware verhouding met daarop viewport-kaders
 *  (sleepbaar) en per viewport optionele annotaties: dimensies en callouts.
 *  Callout-refs (detailnr + sheet) worden getoond; associatieve dimensies
 *  worden op basis van paper-afstand × schaalnoemer teruggerekend naar mm.
 *
 *  Volledige offscreen-renderer per viewport landt in v0.6. Voor nu deelt elke
 *  viewport dezelfde 3D-snapshot; de layout + annotaties zijn wel productie-echt. */

const PAPER_MM: Record<Sheet["format"], [number, number]> = {
  A4: [297, 210],
  A3: [420, 297],
  A2: [594, 420],
  A1: [841, 594],
};

const VIEW_LABEL: Record<ViewName, string> = {
  iso: "3D",
  top: "Bovenaanzicht",
  front: "Vooraanzicht",
  back: "Achteraanzicht",
  left: "Linkeraanzicht",
  right: "Rechteraanzicht",
};

export function SheetPreview(props: {
  sheet: Sheet;
  onViewportsChange: (viewports: SheetViewport[]) => void;
  captureSnapshot: () => string | null;
}) {
  const { sheet, onViewportsChange, captureSnapshot } = props;
  const svgRef = useRef<SVGSVGElement>(null);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ index: number; dx: number; dy: number } | null>(null);
  const [tool, setTool] = useState<"select" | "dim" | "callout">("select");
  const [dimStart, setDimStart] = useState<{ vpIndex: number; x: number; y: number } | null>(null);

  const [pw, ph] = sheet.landscape ? PAPER_MM[sheet.format] : PAPER_MM[sheet.format].slice().reverse() as [number, number];

  useEffect(() => {
    setSnapshotUrl(captureSnapshot());
  }, [sheet.id, sheet.viewports.length, captureSnapshot]);

  const laidOut = normalizedViewports(sheet.viewports, pw, ph);

  function svgPointFromEvent(e: React.PointerEvent | PointerEvent | React.MouseEvent): { x: number; y: number } {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    return { x: nx * pw, y: ny * ph };
  }

  function beginDrag(e: React.PointerEvent, i: number) {
    if (tool !== "select") return;
    const p = svgPointFromEvent(e);
    const vp = laidOut[i];
    setDragging({ index: i, dx: p.x - (vp.paper_x_mm ?? 0), dy: p.y - (vp.paper_y_mm ?? 0) });
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onMove(e: React.PointerEvent) {
    if (!dragging) return;
    const p = svgPointFromEvent(e);
    const next = laidOut.map((vp, i) => {
      if (i !== dragging.index) return vp;
      const newX = Math.max(0, Math.min(pw - (vp.paper_w_mm ?? 100), Math.round((p.x - dragging.dx) / 5) * 5));
      const newY = Math.max(0, Math.min(ph - (vp.paper_h_mm ?? 100), Math.round((p.y - dragging.dy) / 5) * 5));
      // Annotaties staan in absolute paper-mm — schuif ze mee met de viewport,
      // anders blijven maten/callouts zweven boven de oude locatie.
      const shiftX = newX - (vp.paper_x_mm ?? 0);
      const shiftY = newY - (vp.paper_y_mm ?? 0);
      const annotations = (vp.annotations ?? []).map((ann) =>
        ann.kind === "dimension"
          ? {
              ...ann,
              a: { x: ann.a.x + shiftX, y: ann.a.y + shiftY },
              b: { x: ann.b.x + shiftX, y: ann.b.y + shiftY },
            }
          : { ...ann, pos: { x: ann.pos.x + shiftX, y: ann.pos.y + shiftY } },
      );
      return { ...vp, paper_x_mm: newX, paper_y_mm: newY, annotations };
    });
    onViewportsChange(next);
  }

  function endDrag(e: React.PointerEvent) {
    setDragging(null);
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  }

  /** Klik op een viewport in dim- of callout-tool. */
  function onViewportClick(e: React.MouseEvent, i: number) {
    if (tool === "select") return;
    e.stopPropagation();
    const p = svgPointFromEvent(e);
    if (tool === "callout") {
      const detailNr = window.prompt("Detailnummer:", "1") ?? "1";
      const refSheet = window.prompt("Verwijst naar sheet-nummer:", "S-02") ?? "";
      updateAnnotations(i, [
        ...(laidOut[i].annotations ?? []),
        { kind: "callout", pos: { x: p.x, y: p.y }, detailNr, refSheet },
      ]);
      setTool("select");
      return;
    }
    if (tool === "dim") {
      if (!dimStart) {
        setDimStart({ vpIndex: i, x: p.x, y: p.y });
        return;
      }
      if (dimStart.vpIndex !== i) {
        setDimStart(null);
        return;
      }
      updateAnnotations(i, [
        ...(laidOut[i].annotations ?? []),
        { kind: "dimension", a: { x: dimStart.x, y: dimStart.y }, b: { x: p.x, y: p.y } },
      ]);
      setDimStart(null);
      setTool("select");
    }
  }

  function updateAnnotations(vpIndex: number, annotations: SheetAnnotation[]) {
    const next = laidOut.map((vp, i) => (i === vpIndex ? { ...vp, annotations } : vp));
    onViewportsChange(next);
  }

  function removeAnnotation(vpIndex: number, annIndex: number) {
    const next = laidOut.map((vp, i) =>
      i === vpIndex
        ? { ...vp, annotations: (vp.annotations ?? []).filter((_, j) => j !== annIndex) }
        : vp,
    );
    onViewportsChange(next);
  }

  return (
    <div className="sheet-preview-wrap">
      <div className="sheet-preview-toolbar">
        <button
          className={tool === "select" ? "mini active" : "mini"}
          onClick={() => { setTool("select"); setDimStart(null); }}
          title="Selecteer/versleep viewports"
        >⌖ Selecteren</button>
        <button
          className={tool === "dim" ? "mini active" : "mini"}
          onClick={() => { setTool("dim"); setDimStart(null); }}
          title="Klik twee punten binnen dezelfde viewport voor een maat"
        >⟷ Maat</button>
        <button
          className={tool === "callout" ? "mini active" : "mini"}
          onClick={() => { setTool("callout"); setDimStart(null); }}
          title="Plaats een detailverwijzing"
        >◎ Callout</button>
      </div>
      <svg
        ref={svgRef}
        className="sheet-preview-svg"
        viewBox={`0 0 ${pw} ${ph}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerMove={onMove}
        onPointerUp={endDrag}
      >
        <rect x={0} y={0} width={pw} height={ph} fill="#f7f4ef" stroke="#8d857a" strokeWidth={0.5} />
        <rect x={10} y={10} width={pw - 20} height={ph - 20} fill="none" stroke="#c0b8a8" strokeWidth={0.2} strokeDasharray="2,1" />
        <g>
          <rect x={10} y={ph - 32} width={pw - 20} height={22} fill="none" stroke="#8d857a" strokeWidth={0.4} />
          <text x={13} y={ph - 24} fontSize={4} fill="#3b3630" fontFamily="Space Grotesk, sans-serif">Open 3D Studio · OpenAEC</text>
          <text x={13} y={ph - 14} fontSize={3.2} fill="#3b3630">{sheet.number} — {sheet.name}</text>
          <text x={pw - 13} y={ph - 14} fontSize={3} fill="#3b3630" textAnchor="end">{sheet.format} · {sheet.landscape ? "L" : "P"}</text>
        </g>
        {laidOut.map((vp, i) => (
          <g key={i}>
            {snapshotUrl && (
              <image
                href={snapshotUrl}
                x={vp.paper_x_mm}
                y={vp.paper_y_mm}
                width={vp.paper_w_mm}
                height={vp.paper_h_mm}
                preserveAspectRatio="xMidYMid slice"
                opacity={0.85}
              />
            )}
            <rect
              x={vp.paper_x_mm}
              y={vp.paper_y_mm}
              width={vp.paper_w_mm}
              height={vp.paper_h_mm}
              fill={snapshotUrl ? "none" : "#e8e2d6"}
              stroke="#d97706"
              strokeWidth={0.4}
              style={{ cursor: tool === "select" ? "grab" : "crosshair" }}
              onPointerDown={(e) => beginDrag(e, i)}
              onClick={(e) => onViewportClick(e, i)}
            />
            <text
              x={(vp.paper_x_mm ?? 0) + 2}
              y={(vp.paper_y_mm ?? 0) + (vp.paper_h_mm ?? 0) - 2}
              fontSize={3}
              fill="#b45309"
              fontFamily="JetBrains Mono, monospace"
              pointerEvents="none"
            >
              {VIEW_LABEL[vp.view]}  {vp.view === "iso" ? "n.o.s." : `1:${vp.scale}`}
            </text>
            {(vp.annotations ?? []).map((ann, j) =>
              ann.kind === "dimension"
                ? renderDimension(ann, vp.scale, j, () => removeAnnotation(i, j))
                : renderCallout(ann, j, () => removeAnnotation(i, j)),
            )}
            {tool === "dim" && dimStart && dimStart.vpIndex === i && (
              <circle cx={dimStart.x} cy={dimStart.y} r={1.2} fill="#d97706" pointerEvents="none" />
            )}
          </g>
        ))}
      </svg>
      <p className="muted sheet-preview-hint">
        Sleep viewports om te positioneren (5 mm snap). Maten en callouts plaatsen: kies gereedschap en klik binnen een viewport.
      </p>
    </div>
  );
}

function renderDimension(ann: Extract<SheetAnnotation, { kind: "dimension" }>, scale: number, key: number, onRemove: () => void) {
  const dxMm = ann.b.x - ann.a.x;
  const dyMm = ann.b.y - ann.a.y;
  const paperLen = Math.hypot(dxMm, dyMm);
  const worldMm = Math.round(paperLen * scale);
  const label = ann.overrideMm !== undefined ? ann.overrideMm : worldMm;
  // Verplaats label naar het midden en zet loodrecht op de lijn (offset 2mm)
  const mx = (ann.a.x + ann.b.x) / 2;
  const my = (ann.a.y + ann.b.y) / 2;
  const angle = (Math.atan2(dyMm, dxMm) * 180) / Math.PI;
  return (
    <g key={`d${key}`}>
      <line x1={ann.a.x} y1={ann.a.y} x2={ann.b.x} y2={ann.b.y} stroke="#3b3630" strokeWidth={0.25} />
      {/* eindtekens */}
      <line
        x1={ann.a.x} y1={ann.a.y}
        x2={ann.a.x + Math.cos((angle + 90) * Math.PI / 180) * 1.5}
        y2={ann.a.y + Math.sin((angle + 90) * Math.PI / 180) * 1.5}
        stroke="#3b3630" strokeWidth={0.25}
      />
      <line
        x1={ann.b.x} y1={ann.b.y}
        x2={ann.b.x + Math.cos((angle + 90) * Math.PI / 180) * 1.5}
        y2={ann.b.y + Math.sin((angle + 90) * Math.PI / 180) * 1.5}
        stroke="#3b3630" strokeWidth={0.25}
      />
      <text
        x={mx} y={my - 1.5}
        fontSize={2.8} fill="#3b3630"
        transform={`rotate(${angle} ${mx} ${my})`}
        textAnchor="middle"
        fontFamily="JetBrains Mono, monospace"
      >
        {label} mm
      </text>
      <circle
        cx={ann.b.x} cy={ann.b.y}
        r={1.4}
        fill="transparent"
        style={{ cursor: "pointer" }}
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
      >
        <title>Klik op eindpunt om de maat te verwijderen</title>
      </circle>
    </g>
  );
}

function renderCallout(ann: Extract<SheetAnnotation, { kind: "callout" }>, key: number, onRemove: () => void) {
  return (
    <g key={`c${key}`}
       style={{ cursor: "pointer" }}
       onClick={(e) => { e.stopPropagation(); onRemove(); }}>
      <circle cx={ann.pos.x} cy={ann.pos.y} r={4} fill="#fef3c7" stroke="#d97706" strokeWidth={0.4} />
      <line x1={ann.pos.x - 4} y1={ann.pos.y} x2={ann.pos.x + 4} y2={ann.pos.y} stroke="#d97706" strokeWidth={0.3} />
      <text x={ann.pos.x} y={ann.pos.y - 0.5} fontSize={2.8} fill="#7c2d12" textAnchor="middle" fontWeight="bold">
        {ann.detailNr}
      </text>
      <text x={ann.pos.x} y={ann.pos.y + 2.6} fontSize={2.2} fill="#7c2d12" textAnchor="middle">
        {ann.refSheet}
      </text>
    </g>
  );
}

function normalizedViewports(vps: SheetViewport[], pw: number, ph: number): SheetViewport[] {
  const margin = 10;
  const titleH = 22;
  const contentW = pw - margin * 2;
  const contentH = ph - margin * 2 - titleH;
  const n = Math.max(1, vps.length);
  const cols = n > 1 ? 2 : 1;
  const rows = Math.ceil(n / cols);
  const gap = 6;
  const cellW = (contentW - gap * (cols - 1)) / cols;
  const cellH = (contentH - gap * (rows - 1)) / rows;
  return vps.map((vp, i) => {
    if (
      vp.paper_x_mm !== undefined &&
      vp.paper_y_mm !== undefined &&
      vp.paper_w_mm !== undefined &&
      vp.paper_h_mm !== undefined
    ) {
      return vp;
    }
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      ...vp,
      paper_x_mm: margin + col * (cellW + gap),
      paper_y_mm: margin + row * (cellH + gap),
      paper_w_mm: cellW,
      paper_h_mm: cellH,
    };
  });
}
