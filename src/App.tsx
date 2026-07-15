import { useEffect, useMemo, useRef, useState } from "react";
import { Studio, type ToolName, type ViewName } from "./core/studio";
import { getTemplate, templates } from "./catalog/registry";
import type { LoadedModelInfo, ParamValues, PlacedElement, Sheet } from "./core/types";
import { ParamsPanel } from "./ui/ParamsPanel";

interface QtyRow {
  key: string;
  component: string;
  lengteMm: number;
  hoogteMm: number | null;
  kleur: string;
  aantal: number;
}

function buildQuantities(elements: PlacedElement[]): QtyRow[] {
  const map = new Map<string, QtyRow>();
  for (const el of elements) {
    const t = getTemplate(el.templateId);
    const lengteMm = Math.round(
      Math.hypot(el.end.x - el.start.x, el.end.z - el.start.z) * 1000,
    );
    const hoogte =
      typeof el.params.hoogte === "number"
        ? el.params.hoogte
        : typeof el.params.profielHoogte === "number"
          ? el.params.profielHoogte
          : null;
    const kleur = String(el.params.kleur ?? "");
    const key = [t.id, lengteMm, hoogte, kleur].join("|");
    const row = map.get(key);
    if (row) row.aantal += 1;
    else map.set(key, { key, component: t.name, lengteMm, hoogteMm: hoogte, kleur, aantal: 1 });
  }
  return [...map.values()].sort((a, b) => a.component.localeCompare(b.component));
}

function downloadCsv(rows: QtyRow[]) {
  const header = "Component;Lengte_mm;Hoogte_mm;Kleur;Aantal";
  const body = rows.map((r) =>
    [r.component, r.lengteMm, r.hoogteMm ?? "", r.kleur, r.aantal].join(";"),
  );
  const blob = new Blob(["﻿" + [header, ...body].join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "open-3d-studio_aantallen.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

const VIEWS: { id: ViewName; label: string }[] = [
  { id: "iso", label: "3D" },
  { id: "top", label: "Boven" },
  { id: "front", label: "Voor" },
  { id: "back", label: "Achter" },
  { id: "left", label: "Links" },
  { id: "right", label: "Rechts" },
];

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const studioRef = useRef<Studio | null>(null);
  const initializedRef = useRef(false);

  const [tool, setTool] = useState<ToolName>("select");
  const [templateId, setTemplateId] = useState("storax-rooster-lamelwand");
  const [params, setParams] = useState<ParamValues>(() => ({
    ...getTemplate("storax-rooster-lamelwand").defaults,
  }));
  const [models, setModels] = useState<LoadedModelInfo[]>([]);
  const [elements, setElements] = useState<PlacedElement[]>([]);
  const [layers, setLayers] = useState<{ name: string; visible: boolean }[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<ViewName>("iso");
  const [origin, setOrigin] = useState({ x: 0, y: 0, z: 0 }); // mm
  const [textValue, setTextValue] = useState("Tekst");
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [status, setStatus] = useState("Studio wordt gestart …");

  useEffect(() => {
    if (initializedRef.current || !containerRef.current) return;
    initializedRef.current = true;
    const studio = new Studio();
    studioRef.current = studio;
    studio.callbacks = {
      onModelsChanged: setModels,
      onElementsChanged: setElements,
      onLayersChanged: setLayers,
      onSelectionChanged: (id) => {
        setSelectedId(id);
        if (id) {
          const el = studio.getElements().find((e) => e.id === id);
          if (el) {
            setTemplateId(el.templateId);
            setParams({ ...el.params });
          }
        }
      },
      onStatus: setStatus,
    };
    studio.init(containerRef.current).then(
      () => setLayers(studio.getLayers()),
      (err) => {
        console.error(err);
        setStatus("Starten van de 3D-omgeving is mislukt (zie console).");
      },
    );
    return () => studio.dispose();
  }, []);

  const studio = () => studioRef.current;
  const template = getTemplate(templateId);
  const selected = elements.find((e) => e.id === selectedId) ?? null;
  const quantities = useMemo(() => buildQuantities(elements), [elements]);

  const activateTool = (t: ToolName) => {
    setTool(t);
    studio()?.setTool(t);
  };

  const onTemplateChange = (id: string) => {
    setTemplateId(id);
    setParams({ ...getTemplate(id).defaults });
    studio()?.setActiveTemplate(id);
  };

  const onParamsChange = (next: ParamValues) => {
    setParams(next);
    if (selectedId) studio()?.updateElementParams(selectedId, next);
    else studio()?.setCurrentParams(next);
  };

  const onViewChange = (v: ViewName) => {
    setView(v);
    studio()?.setView(v);
  };

  const onOriginChange = (axis: "x" | "y" | "z", mm: number) => {
    const next = { ...origin, [axis]: mm };
    setOrigin(next);
    studio()?.setOrigin({ x: next.x / 1000, y: next.y / 1000, z: next.z / 1000 });
  };

  const addSheet = () => {
    const n = sheets.length + 1;
    const sheet: Sheet = {
      id: crypto.randomUUID(),
      name: `Blad ${String(n).padStart(2, "0")}`,
      number: `S-${String(n).padStart(2, "0")}`,
      format: "A3",
      landscape: true,
      viewports: [{ view: "top", scale: 50 }],
    };
    setSheets([...sheets, sheet]);
    setActiveSheetId(sheet.id);
  };

  const updateSheet = (id: string, patch: Partial<Sheet>) => {
    setSheets(sheets.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const activeSheet = sheets.find((s) => s.id === activeSheetId) ?? null;

  const selectedLengthMm = selected
    ? Math.round(Math.hypot(selected.end.x - selected.start.x, selected.end.z - selected.start.z) * 1000)
    : 0;

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="brand-mark" />
          <h1>Open 3D Studio</h1>
          <span className="badge">OpenAEC · IFC-native</span>
        </div>
        <span className="header-note">open source · That Open Engine</span>
      </header>

      <div className="main">
        <nav className="toolbar">
          <button className={tool === "select" ? "tool active" : "tool"} title="Selecteren" onClick={() => activateTool("select")}>⌖</button>
          <button className={tool === "draw" ? "tool active" : "tool"} title={`${template.name} tekenen`} onClick={() => activateTool("draw")}>▤</button>
          <button className={tool === "line" ? "tool active" : "tool"} title="Lijnen tekenen" onClick={() => activateTool("line")}>╱</button>
          <button className={tool === "rect" ? "tool active" : "tool"} title="Rechthoek tekenen" onClick={() => activateTool("rect")}>▭</button>
          <button className={tool === "circle" ? "tool active" : "tool"} title="Cirkel tekenen" onClick={() => activateTool("circle")}>◯</button>
          <button className={tool === "measure" ? "tool active" : "tool"} title="Meten" onClick={() => activateTool("measure")}>⟷</button>
          <button className={tool === "text" ? "tool active" : "tool"} title="Tekst plaatsen" onClick={() => activateTool("text")}>T</button>
          <button className={tool === "section" ? "tool active" : "tool"} title="Doorsnede plaatsen" onClick={() => activateTool("section")}>◪</button>
          <div className="toolbar-sep" />
          <button className="tool" title="IFC of DXF laden (meerdere mogelijk)" onClick={() => fileInputRef.current?.click()}>⬆</button>
          <button className="tool" title="Exporteren naar IFC" onClick={() => studio()?.exportIfc()}>⬇</button>
          <button className="tool" title="Exporteren naar STL (3D-print, mm)" onClick={() => studio()?.exportStl()}>▲</button>
          <button className="tool" title="Exporteren naar PDF (huidig aanzicht)" onClick={() => studio()?.exportPdf(VIEWS.find((v) => v.id === view)?.label ?? "3D")}>⎙</button>
          <div className="toolbar-sep" />
          <button className="tool" title="Zoom alles" onClick={() => studio()?.zoomAll()}>⛶</button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ifc,.dxf"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) studio()?.loadFiles(Array.from(e.target.files));
              e.target.value = "";
            }}
          />
        </nav>

        <div className="viewport-wrap">
          <div className="viewport" ref={containerRef} />
          <div className="view-overlay">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                className={view === v.id ? "view-btn active" : "view-btn"}
                onClick={() => onViewChange(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <aside className="sidepanel">
          <section>
            <h2>Component</h2>
            {!selected && (
              <select
                className="template-select"
                value={templateId}
                onChange={(e) => onTemplateChange(e.target.value)}
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            <p className="muted">
              {selected
                ? `${selected.name} — parameters bewerken.`
                : "Parameters voor nieuw te tekenen componenten."}
            </p>
            <ParamsPanel template={template} values={params} onChange={onParamsChange} />
            {selected && (
              <div className="selected-tools">
                <label className="param-row">
                  <span>Lengte</span>
                  <span className="param-input">
                    <input
                      type="number"
                      value={selectedLengthMm}
                      min={50}
                      step={10}
                      onChange={(e) => studio()?.setElementLength(selected.id, Number(e.target.value))}
                    />
                    <em>mm</em>
                  </span>
                </label>
                <div className="rotate-row">
                  <span>Draaien</span>
                  <div>
                    {[-90, -15, 15, 90].map((d) => (
                      <button key={d} className="mini" onClick={() => studio()?.rotateElement(selected.id, d)}>
                        {d > 0 ? `+${d}°` : `${d}°`}
                      </button>
                    ))}
                  </div>
                </div>
                <button className="danger" onClick={() => studio()?.removeElement(selected.id)}>
                  Element verwijderen
                </button>
              </div>
            )}
          </section>

          {tool === "text" && (
            <section>
              <h2>Tekst</h2>
              <input
                className="template-select"
                type="text"
                value={textValue}
                placeholder="Te plaatsen tekst"
                onChange={(e) => {
                  setTextValue(e.target.value);
                  const s = studio();
                  if (s) s.currentText = e.target.value;
                }}
              />
              <p className="muted">Klik in het model om deze tekst te plaatsen.</p>
            </section>
          )}

          <section>
            <h2>Nulpunt</h2>
            <div className="origin-row">
              {(["x", "y", "z"] as const).map((axis) => (
                <label key={axis}>
                  <span>{axis.toUpperCase()}</span>
                  <input
                    type="number"
                    step={10}
                    value={origin[axis]}
                    onChange={(e) => onOriginChange(axis, Number(e.target.value))}
                  />
                </label>
              ))}
              <em>mm</em>
            </div>
            <p className="muted">IFC-export wordt relatief aan dit punt geschreven.</p>
          </section>

          <section>
            <h2>Lagen</h2>
            <ul className="list">
              {layers.map((l) => (
                <li key={l.name}>
                  <label>
                    <input
                      type="checkbox"
                      checked={l.visible}
                      onChange={(e) => {
                        studio()?.setLayerVisible(l.name, e.target.checked);
                        setLayers(studio()?.getLayers() ?? []);
                      }}
                    />
                    <span className="list-name">{l.name}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="btn-row">
              <button className="mini" onClick={() => studio()?.clearLines()}>Wis lijnen</button>
              <button className="mini" onClick={() => studio()?.clearMeasures()}>Wis maten</button>
              <button className="mini" onClick={() => studio()?.clearTexts()}>Wis teksten</button>
              <button className="mini" onClick={() => studio()?.clearSection()}>Doorsnede weg</button>
            </div>
          </section>

          <section>
            <h2>Sheets</h2>
            {sheets.length === 0 && <p className="muted">Nog geen tekeningbladen.</p>}
            <ul className="list">
              {sheets.map((s) => (
                <li key={s.id}>
                  <button
                    className={s.id === activeSheetId ? "list-btn active" : "list-btn"}
                    onClick={() => setActiveSheetId(s.id === activeSheetId ? null : s.id)}
                  >
                    {s.number} — {s.name} ({s.format})
                  </button>
                </li>
              ))}
            </ul>
            {activeSheet && (
              <div className="sheet-editor">
                <label className="param-row">
                  <span>Naam</span>
                  <input
                    type="text"
                    value={activeSheet.name}
                    onChange={(e) => updateSheet(activeSheet.id, { name: e.target.value })}
                  />
                </label>
                <label className="param-row">
                  <span>Nummer</span>
                  <input
                    type="text"
                    value={activeSheet.number}
                    onChange={(e) => updateSheet(activeSheet.id, { number: e.target.value })}
                  />
                </label>
                <label className="param-row">
                  <span>Formaat</span>
                  <select
                    value={activeSheet.format}
                    onChange={(e) => updateSheet(activeSheet.id, { format: e.target.value as Sheet["format"] })}
                  >
                    {["A4", "A3", "A2", "A1"].map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </label>
                <label className="param-row">
                  <span>Oriëntatie</span>
                  <select
                    value={activeSheet.landscape ? "liggend" : "staand"}
                    onChange={(e) => updateSheet(activeSheet.id, { landscape: e.target.value === "liggend" })}
                  >
                    <option value="liggend">Liggend</option>
                    <option value="staand">Staand</option>
                  </select>
                </label>

                <p className="muted">Vensters (aanzicht + schaal):</p>
                {activeSheet.viewports.map((vp, i) => (
                  <div className="viewport-row" key={i}>
                    <select
                      value={vp.view}
                      onChange={(e) => {
                        const viewports = [...activeSheet.viewports];
                        viewports[i] = { ...vp, view: e.target.value as ViewName };
                        updateSheet(activeSheet.id, { viewports });
                      }}
                    >
                      {VIEWS.map((v) => (
                        <option key={v.id} value={v.id}>{v.label}</option>
                      ))}
                    </select>
                    <select
                      value={vp.scale}
                      onChange={(e) => {
                        const viewports = [...activeSheet.viewports];
                        viewports[i] = { ...vp, scale: Number(e.target.value) };
                        updateSheet(activeSheet.id, { viewports });
                      }}
                    >
                      {[10, 20, 50, 100, 200, 500].map((sc) => (
                        <option key={sc} value={sc}>1:{sc}</option>
                      ))}
                    </select>
                    <button
                      className="mini"
                      title="Venster verwijderen"
                      onClick={() => {
                        const viewports = activeSheet.viewports.filter((_, j) => j !== i);
                        updateSheet(activeSheet.id, { viewports });
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <div className="btn-row">
                  {activeSheet.viewports.length < 4 && (
                    <button
                      className="mini"
                      onClick={() =>
                        updateSheet(activeSheet.id, {
                          viewports: [...activeSheet.viewports, { view: "front", scale: 50 }],
                        })
                      }
                    >
                      + Venster
                    </button>
                  )}
                  <button className="mini accent" onClick={() => studio()?.exportSheetPdf(activeSheet)}>
                    Exporteer PDF
                  </button>
                  <button
                    className="mini"
                    onClick={() => {
                      setSheets(sheets.filter((s) => s.id !== activeSheet.id));
                      setActiveSheetId(null);
                    }}
                  >
                    Verwijder blad
                  </button>
                </div>
              </div>
            )}
            <div className="btn-row">
              <button className="mini" onClick={addSheet}>+ Nieuw blad</button>
            </div>
          </section>

          <section>
            <h2>Geladen modellen</h2>
            {models.length === 0 && <p className="muted">Nog geen IFC geladen.</p>}
            <ul className="list">
              {models.map((m) => (
                <li key={m.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={m.visible}
                      onChange={(e) => studio()?.setModelVisible(m.id, e.target.checked)}
                    />
                    <span className="list-name" title={m.name}>{m.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2>Getekende elementen</h2>
            {elements.length === 0 && <p className="muted">Nog geen elementen getekend.</p>}
            <ul className="list">
              {elements.map((el) => (
                <li key={el.id}>
                  <button
                    className={el.id === selectedId ? "list-btn active" : "list-btn"}
                    onClick={() => studio()?.selectElement(el.id)}
                  >
                    {el.name}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2>Aantallen</h2>
            {quantities.length === 0 && <p className="muted">Nog geen componenten.</p>}
            {quantities.length > 0 && (
              <>
                <table className="qty-table">
                  <thead>
                    <tr>
                      <th>Component</th>
                      <th>L (mm)</th>
                      <th>St.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quantities.map((q) => (
                      <tr key={q.key}>
                        <td title={`${q.component} — ${q.kleur}`}>{q.component}</td>
                        <td>{q.lengteMm}</td>
                        <td>{q.aantal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="btn-row">
                  <button className="mini" onClick={() => downloadCsv(quantities)}>
                    Exporteer CSV
                  </button>
                </div>
              </>
            )}
          </section>
        </aside>
      </div>

      <footer className="statusbar">{status}</footer>
    </div>
  );
}
