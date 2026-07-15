import { useEffect, useMemo, useRef, useState } from "react";
import { Studio, type ToolName, type ViewName } from "./core/studio";
import { getTemplate, templates } from "./catalog/registry";
import type { GridConfig, LoadedModelInfo, ParamValues, PlacedElement, Sheet, Storey } from "./core/types";
import { openFilesDialog, saveFileAs } from "./core/fileio";
import { ParamsPanel } from "./ui/ParamsPanel";
import { Ribbon, type RibbonTab } from "./ui/Ribbon";
import { makeT, type Lang } from "./ui/i18n";

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

const VIEW_IDS: ViewName[] = ["iso", "top", "front", "back", "left", "right"];

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const studioRef = useRef<Studio | null>(null);
  const initializedRef = useRef(false);

  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem("o3s-lang") as Lang) || "nl");
  const [theme, setTheme] = useState<"dark" | "light">(
    () => (localStorage.getItem("o3s-theme") as "dark" | "light") || "dark",
  );
  const [ribbonTab, setRibbonTab] = useState("start");
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
  const [storeys, setStoreys] = useState<Storey[]>([]);
  const [activeStoreyId, setActiveStoreyId] = useState("");
  const [gridCfg, setGridCfg] = useState<GridConfig>({
    enabled: false,
    countX: 5,
    spacingX: 5,
    countY: 3,
    spacingY: 5,
  });
  const [maxPaneel, setMaxPaneel] = useState(3000);
  const [status, setStatus] = useState("Studio wordt gestart …");

  const t = useMemo(() => makeT(lang), [lang]);

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
      onStoreysChanged: (s, activeId) => {
        setStoreys(s);
        setActiveStoreyId(activeId);
      },
      onGridChanged: setGridCfg,
      onStatus: setStatus,
    };
    studio.init(containerRef.current).then(
      () => {
        setLayers(studio.getLayers());
        setStoreys([...studio.storeys]);
        setActiveStoreyId(studio.activeStoreyId);
        setGridCfg({ ...studio.grid });
        studio.setTheme((localStorage.getItem("o3s-theme") as "dark" | "light") || "dark");
      },
      (err) => {
        console.error(err);
        setStatus("Starten van de 3D-omgeving is mislukt (zie console).");
      },
    );
    return () => studio.dispose();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("o3s-theme", theme);
    studioRef.current?.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("o3s-lang", lang);
  }, [lang]);

  const studio = () => studioRef.current;
  const template = getTemplate(templateId);
  const selected = elements.find((e) => e.id === selectedId) ?? null;
  const quantities = useMemo(() => buildQuantities(elements), [elements]);
  const activeSheet = sheets.find((s) => s.id === activeSheetId) ?? null;

  const activateTool = (toolName: ToolName) => {
    setTool(toolName);
    studio()?.setTool(toolName);
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

  // ---------------------------------------------------------------- project & bestanden
  const projectFilter = { name: "Open 3D Studio project", extensions: ["o3s"] };

  const saveProjectAs = async () => {
    const s = studio();
    if (!s) return;
    const project = { ...s.serializeProject(), sheets };
    await saveFileAs(JSON.stringify(project, null, 2), "project.o3s", [projectFilter]);
  };

  const openProject = async () => {
    const files = await openFilesDialog([projectFilter], false);
    if (!files.length) return;
    try {
      const json = JSON.parse(await files[0].text());
      studio()?.restoreProject(json);
      setSheets(json.sheets ?? []);
      setActiveSheetId(null);
      const o = json.origin ?? { x: 0, y: 0, z: 0 };
      setOrigin({ x: Math.round(o.x * 1000), y: Math.round(o.y * 1000), z: Math.round(o.z * 1000) });
    } catch (err) {
      console.error(err);
      setStatus("Projectbestand kon niet worden gelezen.");
    }
  };

  const loadModels = async () => {
    const files = await openFilesDialog(
      [
        { name: "Modellen (IFC, DXF)", extensions: ["ifc", "dxf"] },
        { name: "IFC", extensions: ["ifc"] },
        { name: "DXF", extensions: ["dxf"] },
      ],
      true,
    );
    if (files.length) await studio()?.loadFiles(files);
  };

  const exportCsv = async () => {
    const header = "Component;Lengte_mm;Hoogte_mm;Kleur;Aantal";
    const body = quantities.map((r) =>
      [r.component, r.lengteMm, r.hoogteMm ?? "", r.kleur, r.aantal].join(";"),
    );
    await saveFileAs("﻿" + [header, ...body].join("\r\n"), "open-3d-studio_aantallen.csv", [
      { name: "CSV", extensions: ["csv"] },
    ]);
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
    setRibbonTab("sheets");
  };

  const updateSheet = (id: string, patch: Partial<Sheet>) => {
    setSheets(sheets.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  // ---------------------------------------------------------------- ribbon
  const viewLabels: Record<ViewName, string> = {
    iso: t("view3d"),
    top: t("viewTop"),
    front: t("viewFront"),
    back: t("viewBack"),
    left: t("viewLeft"),
    right: t("viewRight"),
  };

  const ribbonTabs: RibbonTab[] = [
    {
      id: "start",
      label: t("tabStart"),
      groups: [
        {
          title: t("grpProject"),
          items: [
            { id: "open", icon: "📂", label: t("btnOpen"), onClick: openProject },
            { id: "save", icon: "💾", label: t("btnSaveAs"), onClick: saveProjectAs },
          ],
        },
        {
          title: t("grpImport"),
          items: [
            { id: "load", icon: "⬆", label: t("btnLoadModel"), onClick: loadModels },
            {
              id: "reopen",
              icon: "⟳",
              label: t("btnReopen"),
              onClick: async () => {
                const files = await openFilesDialog([{ name: "IFC", extensions: ["ifc"] }], false);
                if (files.length) await studio()?.reopenIfcAsProject(files[0]);
              },
            },
          ],
        },
        {
          title: t("grpExport"),
          items: [
            { id: "ifc", icon: "⬇", label: t("btnExportIfc"), accent: true, onClick: () => studio()?.exportIfc() },
            { id: "stl", icon: "▲", label: t("btnExportStl"), onClick: () => studio()?.exportStl() },
            { id: "pdf", icon: "⎙", label: t("btnExportPdf"), onClick: () => studio()?.exportPdf(viewLabels[view]) },
            { id: "dxf", icon: "▱", label: t("btnExportDxf"), onClick: () => studio()?.exportDxf() },
            { id: "prod", icon: "⚙", label: t("btnProductie"), onClick: () => studio()?.exportElementeerRapport(maxPaneel) },
            { id: "csv", icon: "▦", label: t("btnExportCsv"), onClick: exportCsv },
          ],
        },
      ],
    },
    {
      id: "draw",
      label: t("tabDraw"),
      groups: [
        {
          title: t("grpComponents"),
          items: [
            { id: "select", icon: "⌖", label: t("btnSelect"), active: tool === "select", onClick: () => activateTool("select") },
            { id: "draw", icon: "▤", label: t("btnDrawComponent"), active: tool === "draw", title: template.name, onClick: () => activateTool("draw") },
          ],
        },
        {
          title: t("grpEdit"),
          items: [
            ...(selected
              ? [{ id: "copy", icon: "⧉", label: t("btnCopy"), onClick: () => studio()?.copyElement(selected.id) }]
              : []),
            { id: "undo", icon: "↶", label: t("btnUndo"), title: "Ctrl+Z", onClick: () => studio()?.undo() },
            { id: "redo", icon: "↷", label: t("btnRedo"), title: "Ctrl+Y", onClick: () => studio()?.redo() },
          ],
        },
        {
          title: t("grpSketch"),
          items: [
            { id: "line", icon: "╱", label: t("btnLine"), active: tool === "line", onClick: () => activateTool("line") },
            { id: "rect", icon: "▭", label: t("btnRect"), active: tool === "rect", onClick: () => activateTool("rect") },
            { id: "circle", icon: "◯", label: t("btnCircle"), active: tool === "circle", onClick: () => activateTool("circle") },
            { id: "text", icon: "T", label: t("btnText"), active: tool === "text", onClick: () => activateTool("text") },
            { id: "measure", icon: "⟷", label: t("btnMeasure"), active: tool === "measure", onClick: () => activateTool("measure") },
          ],
        },
      ],
    },
    {
      id: "view",
      label: t("tabView"),
      groups: [
        {
          title: t("grpViews"),
          items: [
            ...VIEW_IDS.map((v) => ({
              id: v,
              icon: v === "iso" ? "◧" : "▦",
              label: viewLabels[v],
              active: view === v,
              onClick: () => onViewChange(v),
            })),
            { id: "zoom", icon: "⛶", label: t("btnZoomAll"), onClick: () => studio()?.zoomAll() },
          ],
        },
        {
          title: t("grpSection"),
          items: [
            { id: "section", icon: "◪", label: t("btnSection"), active: tool === "section", onClick: () => activateTool("section") },
            { id: "sectionoff", icon: "✕", label: t("btnSectionOff"), onClick: () => studio()?.clearSection() },
          ],
        },
      ],
    },
    {
      id: "sheets",
      label: t("tabSheets"),
      groups: [
        {
          title: t("grpSheet"),
          items: [
            { id: "newsheet", icon: "🗋", label: t("btnNewSheet"), onClick: addSheet },
            ...(activeSheet
              ? [{ id: "exportsheet", icon: "⎙", label: t("exportSheet"), accent: true, onClick: () => studio()?.exportSheetPdf(activeSheet) }]
              : []),
          ],
        },
      ],
    },
  ];

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

      <Ribbon
        tabs={ribbonTabs}
        activeTab={ribbonTab}
        onTabChange={setRibbonTab}
        right={
          <>
            <select
              className="lang-select"
              title={t("language")}
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
            >
              <option value="nl">NL</option>
              <option value="en">EN</option>
            </select>
            <button
              className="theme-btn"
              title={t("theme")}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>
          </>
        }
      />

      <div className="main">
        <div className="viewport-wrap">
          <div className="viewport" ref={containerRef} />
          <div className="view-overlay">
            {VIEW_IDS.map((v) => (
              <button
                key={v}
                className={view === v ? "view-btn active" : "view-btn"}
                onClick={() => onViewChange(v)}
              >
                {viewLabels[v]}
              </button>
            ))}
          </div>
        </div>

        <aside className="sidepanel">
          <section>
            <h2>{t("panComponent")}</h2>
            {!selected && (
              <select
                className="template-select"
                value={templateId}
                onChange={(e) => onTemplateChange(e.target.value)}
              >
                {templates.map((tm) => (
                  <option key={tm.id} value={tm.id}>
                    {tm.name}
                  </option>
                ))}
              </select>
            )}
            <p className="muted">{selected ? `${selected.name} — ${t("editParams")}` : t("newParams")}</p>
            <ParamsPanel template={template} values={params} onChange={onParamsChange} />
            {selected && (
              <div className="selected-tools">
                <label className="param-row">
                  <span>{t("length")}</span>
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
                  <span>{t("rotate")}</span>
                  <div>
                    {[-90, -15, 15, 90].map((d) => (
                      <button key={d} className="mini" onClick={() => studio()?.rotateElement(selected.id, d)}>
                        {d > 0 ? `+${d}°` : `${d}°`}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="param-row">
                  <span>{t("openingEnabled")}</span>
                  <input
                    type="checkbox"
                    checked={!!selected.opening}
                    onChange={(e) =>
                      studio()?.setElementOpening(
                        selected.id,
                        e.target.checked
                          ? { xPos: (selectedLengthMm / 2000) || 1, breedte: 0.9, hoogte: 2.1 }
                          : null,
                      )
                    }
                  />
                </label>
                {selected.opening && (
                  <>
                    {(
                      [
                        ["openingPos", "xPos"],
                        ["openingWidth", "breedte"],
                        ["openingHeight", "hoogte"],
                      ] as const
                    ).map(([labelKey, field]) => (
                      <label key={field} className="param-row">
                        <span>{t(labelKey)}</span>
                        <span className="param-input">
                          <input
                            type="number"
                            step={10}
                            value={Math.round((selected.opening?.[field] ?? 0) * 1000)}
                            onChange={(e) =>
                              studio()?.setElementOpening(selected.id, {
                                ...selected.opening!,
                                [field]: Number(e.target.value) / 1000,
                              })
                            }
                          />
                          <em>mm</em>
                        </span>
                      </label>
                    ))}
                  </>
                )}
                <button className="danger" onClick={() => studio()?.removeElement(selected.id)}>
                  {t("deleteElement")}
                </button>
              </div>
            )}
          </section>

          <section>
            <h2>{t("panStoreys")}</h2>
            <ul className="list">
              {storeys.map((s) => (
                <li key={s.id} className="storey-row">
                  <input
                    type="radio"
                    name="active-storey"
                    title="Actieve verdieping"
                    checked={s.id === activeStoreyId}
                    onChange={() => studio()?.setActiveStorey(s.id)}
                  />
                  <input
                    type="text"
                    value={s.name}
                    onChange={(e) => studio()?.updateStorey(s.id, { name: e.target.value })}
                  />
                  <input
                    type="number"
                    step={100}
                    title={`${t("level")} (mm)`}
                    value={Math.round(s.elevation * 1000)}
                    onChange={(e) =>
                      studio()?.updateStorey(s.id, { elevation: Number(e.target.value) / 1000 })
                    }
                  />
                  <button className="mini" onClick={() => studio()?.removeStorey(s.id)}>✕</button>
                </li>
              ))}
            </ul>
            <div className="btn-row">
              <button className="mini" onClick={() => studio()?.addStorey()}>{t("addStorey")}</button>
            </div>
          </section>

          <section>
            <h2>{t("panGrid")}</h2>
            <label className="param-row">
              <span>{t("gridEnabled")}</span>
              <input
                type="checkbox"
                checked={gridCfg.enabled}
                onChange={(e) => {
                  const next = { ...gridCfg, enabled: e.target.checked };
                  setGridCfg(next);
                  studio()?.setGrid(next);
                }}
              />
            </label>
            {gridCfg.enabled && (
              <div className="grid-config">
                {(
                  [
                    ["gridCountX", "countX", 1],
                    ["gridSpacing", "spacingX", 1000],
                    ["gridCountY", "countY", 1],
                    ["gridSpacing", "spacingY", 1000],
                  ] as const
                ).map(([labelKey, field, factor], i) => (
                  <label key={field}>
                    <span>
                      {i < 2 ? t("gridCountX") : t("gridCountY")}
                      {field.startsWith("spacing") ? ` ${t("gridSpacing")}` : ""}
                    </span>
                    <input
                      type="number"
                      min={field.startsWith("count") ? 2 : 100}
                      step={field.startsWith("count") ? 1 : 100}
                      value={Math.round(gridCfg[field] * factor)}
                      onChange={(e) => {
                        const next = { ...gridCfg, [field]: Number(e.target.value) / factor };
                        setGridCfg(next);
                        studio()?.setGrid(next);
                      }}
                    />
                  </label>
                ))}
              </div>
            )}
          </section>

          {tool === "text" && (
            <section>
              <h2>{t("panText")}</h2>
              <input
                className="template-select"
                type="text"
                value={textValue}
                onChange={(e) => {
                  setTextValue(e.target.value);
                  const s = studio();
                  if (s) s.currentText = e.target.value;
                }}
              />
              <p className="muted">{t("textHint")}</p>
            </section>
          )}

          <section>
            <h2>{t("panOrigin")}</h2>
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
            <p className="muted">{t("originHint")}</p>
          </section>

          <section>
            <h2>{t("panLayers")}</h2>
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
              <button className="mini" onClick={() => studio()?.clearLines()}>{t("clearLines")}</button>
              <button className="mini" onClick={() => studio()?.clearMeasures()}>{t("clearMeasures")}</button>
              <button className="mini" onClick={() => studio()?.clearTexts()}>{t("clearTexts")}</button>
              <button className="mini" onClick={() => studio()?.clearSection()}>{t("clearSection")}</button>
            </div>
          </section>

          <section>
            <h2>{t("panModels")}</h2>
            {models.length === 0 && <p className="muted">{t("noModels")}</p>}
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
            <h2>{t("panElements")}</h2>
            {elements.length === 0 && <p className="muted">{t("noElements")}</p>}
            <ul className="list">
              {elements.map((el) => (
                <li key={el.id}>
                  <button
                    className={el.id === selectedId ? "list-btn active" : "list-btn"}
                    onClick={() => studio()?.selectElement(el.id)}
                  >
                    {el.merk ? `${el.merk} · ` : ""}{el.name}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2>{t("panSheets")}</h2>
            {sheets.length === 0 && <p className="muted">{t("noSheets")}</p>}
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
                  <span>{t("sheetName")}</span>
                  <input
                    type="text"
                    value={activeSheet.name}
                    onChange={(e) => updateSheet(activeSheet.id, { name: e.target.value })}
                  />
                </label>
                <label className="param-row">
                  <span>{t("sheetNumber")}</span>
                  <input
                    type="text"
                    value={activeSheet.number}
                    onChange={(e) => updateSheet(activeSheet.id, { number: e.target.value })}
                  />
                </label>
                <label className="param-row">
                  <span>{t("sheetFormat")}</span>
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
                  <span>{t("sheetOrientation")}</span>
                  <select
                    value={activeSheet.landscape ? "l" : "p"}
                    onChange={(e) => updateSheet(activeSheet.id, { landscape: e.target.value === "l" })}
                  >
                    <option value="l">{t("landscape")}</option>
                    <option value="p">{t("portrait")}</option>
                  </select>
                </label>

                <p className="muted">{t("viewportsHint")}</p>
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
                      {VIEW_IDS.map((v) => (
                        <option key={v} value={v}>{viewLabels[v]}</option>
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
                      {t("addViewport")}
                    </button>
                  )}
                  <button className="mini accent" onClick={() => studio()?.exportSheetPdf(activeSheet)}>
                    {t("exportSheet")}
                  </button>
                  <button
                    className="mini"
                    onClick={() => {
                      setSheets(sheets.filter((s) => s.id !== activeSheet.id));
                      setActiveSheetId(null);
                    }}
                  >
                    {t("deleteSheet")}
                  </button>
                </div>
              </div>
            )}
          </section>

          <section>
            <h2>{t("panQuantities")}</h2>
            {quantities.length === 0 && <p className="muted">{t("noComponents")}</p>}
            {quantities.length > 0 && (
              <>
                <table className="qty-table">
                  <thead>
                    <tr>
                      <th>{t("colComponent")}</th>
                      <th>{t("colLength")}</th>
                      <th>{t("colCount")}</th>
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
                <label className="param-row">
                  <span>{t("maxPanel")}</span>
                  <span className="param-input">
                    <input
                      type="number"
                      step={100}
                      min={300}
                      value={maxPaneel}
                      onChange={(e) => setMaxPaneel(Number(e.target.value))}
                    />
                    <em>mm</em>
                  </span>
                </label>
                <div className="btn-row">
                  <button className="mini" onClick={exportCsv}>{t("exportCsv")}</button>
                  <button className="mini" onClick={() => studio()?.exportElementeerRapport(maxPaneel)}>
                    {t("btnProductie")}
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
