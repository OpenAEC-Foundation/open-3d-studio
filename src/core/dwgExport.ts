import { exportTopViewDxf } from "./dxfExport";
import type { LineSegment, MeasureSegment, PlacedElement, TextLabel } from "./types";
import { saveFileAs } from "./fileio";

/** DWG-export.
 *
 *  Flow:
 *   1. Bouw DXF-content op via de bestaande {@link exportTopViewDxf}.
 *   2. Roep de Tauri-command `export_dwg` aan (Rust-module `dwg.rs`).
 *      Zodra `acadrust` als Cargo-dependency is toegevoegd converteert die
 *      command het DXF naar DWG (default AC1027 / AutoCAD 2013).
 *   3. Zolang `acadrust` niet geconfigureerd is, geeft de Rust-command een
 *      leesbare fout terug — we vangen die af en vallen terug op DXF-export
 *      met een gebruikersmelding.
 *
 *  Zie {@link https://github.com/OpenAEC-Foundation/open-cad-studio} en
 *  PLAN.md § v0.4-Sprint 9 voor de context. */

export type DwgVersion = "r2013" | "r2018";

interface ExportDwgArgs {
  elements: PlacedElement[];
  lines: LineSegment[];
  measures: MeasureSegment[];
  texts: TextLabel[];
  projectName: string;
  outPath?: string;
  targetVersion?: DwgVersion;
  onFallback?: (reason: string) => void;
}

/** Detecteert of we in de Tauri-desktop-context draaien (dus `invoke` beschikbaar). */
function inTauri(): boolean {
  return typeof (window as any).__TAURI_INTERNALS__ !== "undefined";
}

export async function exportDwg(args: ExportDwgArgs): Promise<Blob> {
  const dxfText = exportTopViewDxf({
    elements: args.elements,
    lines: args.lines,
    measures: args.measures,
    texts: args.texts,
  });

  const filename = `${args.projectName || "open-3d-studio"}.dwg`;
  const version: DwgVersion = args.targetVersion ?? "r2013";

  if (inTauri()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      // Vraag de Rust-kant om DWG te schrijven. Zolang acadrust nog niet
      // is toegevoegd, retourneert dit een fout die we hieronder afvangen.
      await invoke("export_dwg", {
        dxfContent: dxfText,
        targetVersion: version,
        outPath: args.outPath ?? filename,
      });
      // Bij succes hebben we de file al op disk; we leveren een lege blob-referentie.
      return new Blob([], { type: "application/octet-stream" });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      args.onFallback?.(reason);
      // Val terug op DXF met .dxf-extensie
      await saveFileAs(dxfText, filename.replace(/\.dwg$/i, ".dxf"), [
        { name: "DXF", extensions: ["dxf"] },
      ]);
      return new Blob([dxfText], { type: "application/octet-stream" });
    }
  }

  // In de web-omgeving is er geen Tauri-command; alleen DXF is beschikbaar.
  args.onFallback?.("Buiten de desktop-app is DWG-export niet beschikbaar; DXF geleverd.");
  await saveFileAs(dxfText, filename.replace(/\.dwg$/i, ".dxf"), [{ name: "DXF", extensions: ["dxf"] }]);
  return new Blob([dxfText], { type: "application/octet-stream" });
}
