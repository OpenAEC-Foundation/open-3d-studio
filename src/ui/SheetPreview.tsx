import { useEffect, useRef, useState } from "react";
import type { Sheet, SheetViewport, ViewName } from "../core/types";

/** Sheet-preview MVP (v0.4-S9-productie).
 *
 *  Toont een SVG-papiervel op ware verhouding met daarop viewport-kaders die
 *  te verslepen zijn. Elke viewport toont een thumbnail-snapshot van de
 *  actieve 3D-viewport. Volledige offscreen-renderer per viewport landt in
 *  v0.5 samen met de callout-verwijzing en associatieve maatvoering. */

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

  const [pw, ph] = sheet.landscape ? PAPER_MM[sheet.format] : PAPER_MM[sheet.format].slice().reverse() as [number, number];

  useEffect(() => {
    setSnapshotUrl(captureSnapshot());
  }, [sheet.id, sheet.viewports.length, captureSnapshot]);

  // Sensible defaults als paper-coords ontbreken (auto-grid layout).
  const laidOut = normalizedViewports(sheet.viewports, pw, ph);

  function svgPointFromEvent(e: React.PointerEvent | PointerEvent): { x: number; y: number } {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    return { x: nx * pw, y: ny * ph };
  }

  function beginDrag(e: React.PointerEvent, i: number) {
    const p = svgPointFromEvent(e);
    const vp = laidOut[i];
    setDragging({ index: i, dx: p.x - (vp.paper_x_mm ?? 0), dy: p.y - (vp.paper_y_mm ?? 0) });
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onMove(e: React.PointerEvent) {
    if (!dragging) return;
    const p = svgPointFromEvent(e);
    const next = laidOut.map((vp, i) =>
      i === dragging.index
        ? {
            ...vp,
            paper_x_mm: Math.max(0, Math.min(pw - (vp.paper_w_mm ?? 100), Math.round((p.x - dragging.dx) / 5) * 5)),
            paper_y_mm: Math.max(0, Math.min(ph - (vp.paper_h_mm ?? 100), Math.round((p.y - dragging.dy) / 5) * 5)),
          }
        : vp,
    );
    onViewportsChange(next);
  }

  function endDrag(e: React.PointerEvent) {
    setDragging(null);
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  }

  return (
    <div className="sheet-preview-wrap">
      <svg
        ref={svgRef}
        className="sheet-preview-svg"
        viewBox={`0 0 ${pw} ${ph}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerMove={onMove}
        onPointerUp={endDrag}
      >
        {/* Papierachtergrond */}
        <rect x={0} y={0} width={pw} height={ph} fill="#f7f4ef" stroke="#8d857a" strokeWidth={0.5} />
        {/* Margeframe 10mm */}
        <rect x={10} y={10} width={pw - 20} height={ph - 20} fill="none" stroke="#c0b8a8" strokeWidth={0.2} strokeDasharray="2,1" />
        {/* Titelblok rechtsonder (22mm hoog) */}
        <g>
          <rect x={10} y={ph - 32} width={pw - 20} height={22} fill="none" stroke="#8d857a" strokeWidth={0.4} />
          <text x={13} y={ph - 24} fontSize={4} fill="#3b3630" fontFamily="Space Grotesk, sans-serif">Open 3D Studio · OpenAEC</text>
          <text x={13} y={ph - 14} fontSize={3.2} fill="#3b3630">{sheet.number} — {sheet.name}</text>
          <text x={pw - 13} y={ph - 14} fontSize={3} fill="#3b3630" textAnchor="end">{sheet.format} · {sheet.landscape ? "L" : "P"}</text>
        </g>
        {/* Viewports */}
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
              style={{ cursor: "grab" }}
              onPointerDown={(e) => beginDrag(e, i)}
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
          </g>
        ))}
      </svg>
      <p className="muted sheet-preview-hint">Sleep de viewports om ze te positioneren (5 mm snap). Titelblok en formaat blijven vast.</p>
    </div>
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
