import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_PHASE_SETTINGS, Studio, type PhaseSettings, type ToolName, type ViewName } from "./core/studio";
import { allTemplates, getTemplate, subscribeRuntimeTemplates } from "./catalog/registry";
import { deriveMainCategory, groupByMainCategory } from "./core/mainCategory";
import type { ElementPhase, GridConfig, LoadedModelInfo, ParamValues, PlacedElement, Sheet, Storey, TypeDefinition } from "./core/types";
import { openFilesDialog, saveFileAs } from "./core/fileio";
import { listPresets } from "./core/ilsCheck";
import { EXAMPLE_PLUGIN_JS } from "./core/pluginApi";
import { ParamsPanel } from "./ui/ParamsPanel";
import { Ribbon, type RibbonTab } from "./ui/Ribbon";
import { SheetPreview } from "./ui/SheetPreview";
import { TemplateEditor } from "./ui/TemplateEditor";
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
    // Sloop-elementen horen niet in de bestellijst; onbekende templates
    // (verdwenen runtime-template) niet laten crashen maar overslaan.
    if ((el.phase ?? "new") === "demolished") continue;
    let t;
    try {
      t = getTemplate(el.templateId);
    } catch {
      continue;
    }
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

function idsPresetTitle(id: string): string {
  return listPresets().find((p) => p.id === id)?.title ?? "IDS";
}

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
  const [lengthDraft, setLengthDraft] = useState("");
  const [ilsReport, setIlsReport] = useState<
    { eis: string; status: "ok" | "let-op" | "fout"; toelichting: string }[] | null
  >(null);
  const [geoRef, setGeoRef] = useState({ enabled: false, rdX: 0, rdY: 0, napZ: 0 });
  const [idsPreset, setIdsPreset] = useState<string>("bim-basis-ils-2");
  const [phaseSettings, setPhaseSettings] = useState<PhaseSettings>(() => JSON.parse(JSON.stringify(DEFAULT_PHASE_SETTINGS)));
  const [templatesRev, setTemplatesRev] = useState(0);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  // v0.7: multi-select, typen, reeks/offset, hoofdcategorie-kiezer
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [typeDefs, setTypeDefs] = useState<TypeDefinition[]>([]);
  const [activeTypeId, setActiveTypeId] = useState<string>("");
  const [arrayCount, setArrayCount] = useState(3);
  const [arraySpacing, setArraySpacing] = useState(600);
  const [mainCat, setMainCat] = useState<string>("Wanden");
  const [lastTemplateByCat, setLastTemplateByCat] = useState<Record<string, string>>({});
  const phaseColorTimer = useRef<number | null>(null);
  const [speckleCfg, setSpeckleCfg] = useState({ host: "https://speckle.xyz", token: "", streamId: "", branchName: "main" });
  const [pluginSrc, setPluginSrc] = useState(EXAMPLE_PLUGIN_JS);
  const [aiKey, setAiKey] = useState(() => localStorage.getItem("o3s-apikey") ?? "");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessage, setAiMessage] = useState("");
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
            setLengthDraft(
              String(Math.round(Math.hypot(el.end.x - el.start.x, el.end.z - el.start.z) * 1000)),
            );
          }
        } else {
          // paneel terug in de pas met de actieve teken-instellingen van de engine
          setTemplateId(studio.activeTemplateId);
          setParams({ ...studio.currentParams });
        }
      },
      onOriginChanged: (o) =>
        setOrigin({ x: Math.round(o.x * 1000), y: Math.round(o.y * 1000), z: Math.round(o.z * 1000) }),
      onGeoRefChanged: setGeoRef,
      onPhaseSettingsChanged: setPhaseSettings,
      onSelectionSetChanged: setSelectedIds,
      onTypesChanged: setTypeDefs,
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
    // Re-render zodra runtime-templates (via .o3st, IFC-family of plugin) veranderen.
    return subscribeRuntimeTemplates(() => setTemplatesRev((r) => r + 1));
  }, []);

  useEffect(() => {
    // Nieuwe runtime-templates brengen nieuwe lagen-categorieën mee.
    const s = studioRef.current;
    if (s) setLayers(s.getLayers());
  }, [templatesRev]);

  useEffect(() => {
    localStorage.setItem("o3s-lang", lang);
  }, [lang]);

  const studio = () => studioRef.current;
  const templates = useMemo(() => allTemplates(), [templatesRev]);
  // Guard: het actieve template kan een runtime-template zijn dat net is
  // ge-unregistreerd (plugin/editor) — zonder vangnet white-screent de render.
  const template = useMemo(() => {
    try {
      return getTemplate(templateId);
    } catch {
      return templates[0];
    }
  }, [templateId, templates]);
  useEffect(() => {
    // Als het actieve template uit de catalogus verdween: netjes terugvallen,
    // ook in de engine (anders gooit de teken-preview op het oude id).
    if (!templates.some((tm) => tm.id === templateId) && templates.length > 0) {
      setTemplateId(templates[0].id);
      setParams({ ...templates[0].defaults });
      studioRef.current?.setActiveTemplate(templates[0].id);
    }
  }, [templates, templateId]);
  const selected = elements.find((e) => e.id === selectedId) ?? null;
  const quantities = useMemo(() => buildQuantities(elements), [elements]);
  const activeSheet = sheets.find((s) => s.id === activeSheetId) ?? null;
  // Stabiele identiteit: anders herstart het snapshot-effect in SheetPreview
  // (GPU-readback + PNG-encode) bij elke onverwante App-render.
  const captureSnapshot = useCallback(() => studioRef.current?.captureViewportPng() ?? null, []);

  const activateTool = (toolName: ToolName) => {
    setTool(toolName);
    studio()?.setTool(toolName);
  };

  const onTemplateChange = (id: string) => {
    setTemplateId(id);
    setParams({ ...getTemplate(id).defaults });
    studio()?.setActiveTemplate(id);
    setActiveTypeId("");
    studio()?.setActiveType(null);
    const cat = deriveMainCategory(getTemplate(id));
    setMainCat(cat);
    setLastTemplateByCat((m) => ({ ...m, [cat]: id }));
  };

  /** v0.7-S6: ribbon-tekenknop per hoofdcategorie — laatst gebruikte template wint. */
  const drawCategory = (cat: string) => {
    const grouped = groupByMainCategory(templates);
    const inCat = grouped.find((g) => g.category === cat)?.templates ?? [];
    if (inCat.length === 0) return;
    const remembered = lastTemplateByCat[cat];
    const id = remembered && inCat.some((tm) => tm.id === remembered) ? remembered : inCat[0].id;
    onTemplateChange(id);
    activateTool("draw");
  };

  /** v0.7-S5: type kiezen — zet template + params via de engine. */
  const onTypeChange = (typeId: string) => {
    setActiveTypeId(typeId);
    const s = studio();
    if (!s) return;
    s.setActiveType(typeId || null);
    if (typeId) {
      const def = typeDefs.find((td) => td.id === typeId);
      if (def) {
        setTemplateId(def.templateId);
        setParams({ ...getTemplate(def.templateId).defaults, ...def.typeParams });
        setMainCat(deriveMainCategory(getTemplate(def.templateId)));
      }
    }
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

  const runAssistant = async () => {
    const s = studio();
    if (!s || !aiKey.trim() || !aiPrompt.trim() || aiBusy) return;
    setAiBusy(true);
    setAiMessage("");
    try {
      const { askAssistant } = await import("./core/aiAssistant");
      const grid = gridCfg.enabled
        ? `Stramien: assen 1..${gridCfg.countX} h.o.h. ${gridCfg.spacingX} m (x), A..${String.fromCharCode(64 + gridCfg.countY)} h.o.h. ${gridCfg.spacingY} m (y).`
        : "Geen stramien actief.";
      const antwoord = await askAssistant(aiPrompt, aiKey.trim(), {
        storeyName: storeys.find((st) => st.id === activeStoreyId)?.name ?? "",
        gridInfo: grid,
      });
      const n = s.applyAssistantPlacements(antwoord.placements);
      setAiMessage(antwoord.message || (n > 0 ? `${n} ${t("aiPlacedSuffix")}` : t("aiNoPlacements")));
    } catch (err) {
      console.error(err);
      setAiMessage(err instanceof Error ? err.message : t("aiCallFailed"));
    } finally {
      setAiBusy(false);
    }
  };

  const savePreset = async () => {
    await saveFileAs(
      JSON.stringify({ app: "o3st", templateId, params }, null, 2),
      `${templateId}.o3st`,
      [{ name: "Componentpreset", extensions: ["o3st"] }],
    );
  };

  const loadPreset = async () => {
    const files = await openFilesDialog([{ name: "Componentpreset", extensions: ["o3st"] }], false);
    if (!files.length) return;
    try {
      const json = JSON.parse(await files[0].text());
      onTemplateChange(json.templateId);
      const merged = { ...getTemplate(json.templateId).defaults, ...json.params };
      setParams(merged);
      studio()?.setCurrentParams(merged);
    } catch (err) {
      console.error(err);
      setStatus("Preset kon niet worden gelezen.");
    }
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

  const phaseLabels: Record<ElementPhase, string> = {
    new: t("phaseNew"),
    existing: t("phaseExisting"),
    demolished: t("phaseDemolished"),
    temporary: t("phaseTemporary"),
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
            { id: "dwg13", icon: "▤", label: "DWG (2013)", onClick: () => studio()?.exportDwg("r2013") },
            { id: "dwg18", icon: "▥", label: "DWG (2018) exp.", title: t("dwg18Title"), onClick: () => studio()?.exportDwg("r2018") },
            { id: "prod", icon: "⚙", label: t("btnProductie"), onClick: () => studio()?.exportElementeerRapport(maxPaneel) },
            { id: "csv", icon: "▦", label: t("btnExportCsv"), onClick: exportCsv },
          ],
        },
        {
          title: t("grpQuality"),
          items: [
            {
              id: "ils",
              icon: "✓",
              label: `IDS: ${idsPresetTitle(idsPreset)}`,
              title: t("idsRunTitle"),
              onClick: async () => setIlsReport((await studio()?.runIdsPreset(idsPreset)) ?? null),
            },
            {
              id: "idsFile",
              icon: "◈",
              label: t("btnIdsFile"),
              onClick: async () => {
                const files = await openFilesDialog(
                  [{ name: "IDS", extensions: ["ids", "xml"] }],
                  false,
                );
                if (files.length) setIlsReport((await studio()?.runIdsFile(files[0])) ?? null);
              },
            },
            {
              id: "bcf",
              icon: "◉",
              label: t("btnBcf"),
              onClick: () => studio()?.exportBcf(textValue !== "Tekst" ? textValue : ""),
            },
            {
              id: "bcfImport",
              icon: "⇢",
              label: t("btnBcfImport"),
              onClick: async () => {
                const files = await openFilesDialog(
                  [{ name: "BCF", extensions: ["bcf", "bcfzip"] }],
                  false,
                );
                if (files.length) await studio()?.importBcf(files[0]);
              },
            },
            {
              id: "struct",
              icon: "▲",
              label: t("btnStructural"),
              title: t("structuralTitle"),
              onClick: () => studio()?.exportStructural(),
            },
            {
              id: "cobie",
              icon: "▨",
              label: t("btnCobie"),
              title: t("cobieTitle"),
              onClick: () => studio()?.exportCobie(),
            },
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
          // v0.7-S6: Revit-patroon — één tekenknop per hoofdcategorie
          title: t("grpCategories"),
          items: groupByMainCategory(templates).slice(0, 8).map((g) => ({
            id: `cat-${g.category}`,
            icon: ({ Wanden: "▥", Vloeren: "▬", Daken: "⌂", Draagconstructie: "╫", Fundering: "▁", "Kozijnen & deuren": "◫", Installaties: "⚙", "Trappen & hellingen": "▨" } as Record<string, string>)[g.category] ?? "▤",
            label: g.category.split(" ")[0],
            title: `${g.category}: ${t("catDrawTitle")} (${g.templates.length} ${t("catAvailable")})`,
            active: tool === "draw" && deriveMainCategory(template) === g.category,
            onClick: () => drawCategory(g.category),
          })),
        },
        {
          title: t("grpEdit"),
          items: [
            { id: "clipCopy", icon: "⧉", label: t("btnClipCopy"), title: t("clipCopyTitle"), onClick: () => studio()?.copySelection() },
            { id: "clipCut", icon: "✂", label: t("btnClipCut"), title: "Ctrl+X", onClick: () => studio()?.cutSelection() },
            { id: "clipPaste", icon: "⎘", label: t("btnClipPaste"), title: "Ctrl+V", onClick: () => studio()?.paste() },
            { id: "align", icon: "≡", label: t("btnAlign"), active: tool === "align", title: t("alignTitle"), onClick: () => activateTool("align") },
            { id: "mirror", icon: "⇋", label: t("btnMirror"), active: tool === "mirror", title: t("mirrorTitle"), onClick: () => activateTool("mirror") },
            { id: "split", icon: "⊟", label: t("btnSplit"), active: tool === "split", onClick: () => activateTool("split") },
            { id: "openingTool", icon: "◻", label: t("panOpening"), active: tool === "opening", onClick: () => activateTool("opening") },
            { id: "openingPoly", icon: "⬠", label: t("btnOpeningPoly"), active: tool === "opening-poly", title: t("openingPolyTitle"), onClick: () => activateTool("opening-poly") },
            { id: "match", icon: "🖌", label: t("btnMatch"), active: tool === "match", title: t("matchTitle"), onClick: () => activateTool("match") },
            ...(selected
              ? [{ id: "unjoin", icon: "⋈", label: t("btnUnjoin"), title: t("unjoinTitle"), onClick: () => studio()?.unjoinElement(selected.id) }]
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
      id: "ecosystem",
      label: t("tabEcosystem"),
      groups: [
        {
          title: t("grpTemplates"),
          items: [
            {
              id: "openEditor",
              icon: "⧉",
              label: t("btnTemplateEditor"),
              title: t("templateEditorTitle"),
              onClick: () => setShowTemplateEditor(true),
            },
            {
              id: "loadO3st",
              icon: "⇢",
              label: t("btnLoadO3st"),
              onClick: async () => {
                const files = await openFilesDialog([{ name: "Open 3D Studio-template", extensions: ["o3st"] }], false);
                if (!files.length) return;
                try {
                  const { loadO3stTemplate } = await import("./catalog/registry");
                  const json = JSON.parse(await files[0].text());
                  loadO3stTemplate(json);
                  setStatus(`Template "${json.name}" toegevoegd aan catalogus.`);
                } catch (err) {
                  setStatus(`Kon .o3st niet laden: ${err instanceof Error ? err.message : String(err)}`);
                }
              },
            },
          ],
        },
        {
          title: t("grpLibraries"),
          items: [
            {
              id: "loadFamily",
              icon: "◧",
              label: t("btnIfcFamily"),
              title: t("ifcFamilyTitle"),
              onClick: async () => {
                const files = await openFilesDialog([{ name: "IFC-family", extensions: ["ifc"] }], false);
                if (files.length) await studio()?.importIfcFamily(files[0]);
              },
            },
          ],
        },
        {
          title: t("grpStructural"),
          items: [
            {
              id: "rebar",
              icon: "▤",
              label: t("btnRebarBom"),
              title: t("rebarBomTitle"),
              onClick: () => studio()?.exportRebarBom(),
            },
          ],
        },
        {
          title: t("grpSection"),
          items: [
            {
              id: "sectionSvg",
              icon: "◪",
              label: t("btnSectionSvg"),
              title: t("sectionSvgTitle"),
              onClick: () => studio()?.exportSectionSvg({ normal: "x", offset: 0 }, 50),
            },
          ],
        },
        {
          title: t("grpCloud"),
          items: [
            {
              id: "speckle",
              icon: "☁",
              label: t("btnPushSpeckle"),
              title: t("pushSpeckleTitle"),
              onClick: async () => {
                if (!speckleCfg.token || !speckleCfg.streamId) {
                  setStatus("Vul eerst token + streamId in bij Speckle-paneel.");
                  return;
                }
                await studio()?.pushSpeckle(speckleCfg);
              },
            },
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
        <div className="qat" role="toolbar" aria-label={t("btnUndo") + " / " + t("btnRedo")}>
          <button
            className="qat-btn"
            title={`${t("btnUndo")}  (Ctrl+Z)`}
            aria-label={t("btnUndo")}
            onClick={() => studio()?.undo()}
          >
            ↶
          </button>
          <button
            className="qat-btn"
            title={`${t("btnRedo")}  (Ctrl+Y)`}
            aria-label={t("btnRedo")}
            onClick={() => studio()?.redo()}
          >
            ↷
          </button>
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
              <>
                {/* v0.7-S6: getrapte kiezer — hoofdcategorie → template → type */}
                <select
                  className="template-select"
                  value={mainCat}
                  onChange={(e) => {
                    const cat = e.target.value;
                    setMainCat(cat);
                    const inCat = groupByMainCategory(templates).find((g) => g.category === cat)?.templates ?? [];
                    if (inCat.length > 0 && !inCat.some((tm) => tm.id === templateId)) {
                      const remembered = lastTemplateByCat[cat];
                      onTemplateChange(remembered && inCat.some((tm) => tm.id === remembered) ? remembered : inCat[0].id);
                    }
                  }}
                >
                  {groupByMainCategory(templates).map((g) => (
                    <option key={g.category} value={g.category}>
                      {g.category} ({g.templates.length})
                    </option>
                  ))}
                </select>
                <select
                  className="template-select"
                  value={templateId}
                  onChange={(e) => onTemplateChange(e.target.value)}
                >
                  {(groupByMainCategory(templates).find((g) => g.category === mainCat)?.templates ?? templates).map((tm) => (
                    <option key={tm.id} value={tm.id}>
                      {tm.name}
                    </option>
                  ))}
                </select>
                {typeDefs.some((td) => td.templateId === templateId) && (
                  <select
                    className="template-select"
                    value={activeTypeId}
                    onChange={(e) => onTypeChange(e.target.value)}
                  >
                    <option value="">{t("freeParams")}</option>
                    {typeDefs
                      .filter((td) => td.templateId === templateId)
                      .map((td) => (
                        <option key={td.id} value={td.id}>{td.name}</option>
                      ))}
                  </select>
                )}
              </>
            )}
            <p className="muted">{selected ? `${selected.name} — ${t("editParams")}` : t("newParams")}</p>
            <ParamsPanel template={template} values={params} onChange={onParamsChange} />
            {!selected && (
              <div className="btn-row">
                <button className="mini" onClick={savePreset}>{t("presetSave")}</button>
                <button className="mini" onClick={loadPreset}>{t("presetLoad")}</button>
              </div>
            )}
            {/* v0.7-S1: bulk-acties bij meervoudige selectie */}
            {selectedIds.length > 1 && (
              <div className="selected-tools">
                <p className="muted"><strong>{selectedIds.length} {t("elementsSelected")}</strong></p>
                <div className="btn-row">
                  <button className="mini" onClick={() => studio()?.copySelection()}>{t("btnClipCopy")}</button>
                  <button className="mini" onClick={() => studio()?.cutSelection()}>{t("btnClipCut")}</button>
                  <button className="mini danger" onClick={() => studio()?.removeSelected()}>{t("btnDelete")}</button>
                </div>
                <label className="param-row">
                  <span>{t("arrayCountLabel")}</span>
                  <input type="number" min={1} max={50} value={arrayCount} onChange={(e) => setArrayCount(Number(e.target.value))} />
                </label>
                <label className="param-row">
                  <span>{t("spacingCtc")}</span>
                  <span className="param-input">
                    <input type="number" step={50} value={arraySpacing} onChange={(e) => setArraySpacing(Number(e.target.value))} />
                    <em>mm</em>
                  </span>
                </label>
                <div className="btn-row">
                  <button className="mini" onClick={() => studio()?.arraySelection(arrayCount, arraySpacing)}>{t("btnArray")}</button>
                  <button className="mini" onClick={() => studio()?.offsetSelection(arraySpacing)}>{t("btnOffset")}</button>
                </div>
              </div>
            )}
            {selected && (
              <div className="selected-tools">
                <label className="param-row">
                  <span>{t("length")}</span>
                  <span className="param-input">
                    <input
                      type="number"
                      value={lengthDraft}
                      min={50}
                      step={10}
                      onChange={(e) => {
                        // kladwaarde: tussenstanden (< 50 mm) niet naar de engine sturen,
                        // zodat het veld niet terugspringt tijdens het typen
                        setLengthDraft(e.target.value);
                        const mm = Number(e.target.value);
                        if (Number.isFinite(mm) && mm >= 50) {
                          studio()?.setElementLength(selected.id, mm);
                        }
                      }}
                      onBlur={() => setLengthDraft(String(selectedLengthMm))}
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
                {/* v0.7-S4: meerdere sparingen per element */}
                <h3 className="sub">{t("openings")} ({(selected.openings ?? []).length})</h3>
                {(selected.openings ?? []).map((op) => (
                  <div key={op.id} className="opening-row">
                    <div className="btn-row">
                      <select
                        value={op.shape ?? "rect"}
                        disabled={op.kind === "raam" || op.kind === "deur"}
                        onChange={(e) =>
                          studio()?.updateOpening(selected.id, op.id!, { shape: e.target.value as "rect" | "round" })
                        }
                      >
                        <option value="rect">{t("btnRect")}</option>
                        <option value="round">{t("shapeRound")}</option>
                      </select>
                      <span className="muted">{op.kind ?? t("openingFree")}</span>
                      <button
                        className="mini"
                        title={op.kind === "raam" || op.kind === "deur" ? t("openingLinkedTitle") : t("openingRemoveTitle")}
                        disabled={op.kind === "raam" || op.kind === "deur"}
                        onClick={() => studio()?.removeOpening(selected.id, op.id!)}
                      >
                        ✕
                      </button>
                    </div>
                    {(
                      [
                        [t("posLabel"), "xPos"],
                        [op.shape === "round" ? t("diameterLabel") : t("openingWidth"), "breedte"],
                        ...(op.shape === "round" ? [] : [[t("openingHeight"), "hoogte"] as const]),
                        [t("bottomLabel"), "zBottom"],
                      ] as [string, "xPos" | "breedte" | "hoogte" | "zBottom"][]
                    ).map(([lbl, field]) => (
                      <label key={field} className="param-row">
                        <span>{lbl}</span>
                        <span className="param-input">
                          <input
                            type="number"
                            step={10}
                            disabled={op.kind === "raam" || op.kind === "deur"}
                            value={Math.round(((op[field] as number | undefined) ?? 0) * 1000)}
                            onChange={(e) =>
                              studio()?.updateOpening(selected.id, op.id!, {
                                [field]: Number(e.target.value) / 1000,
                              })
                            }
                          />
                          <em>mm</em>
                        </span>
                      </label>
                    ))}
                  </div>
                ))}
                <div className="btn-row">
                  <button
                    className="mini"
                    onClick={() => {
                      const s = studio();
                      if (!s || !selected) return;
                      const mid = selected.start.clone().lerp(selected.end, 0.5);
                      s.addOpeningAt(selected.id, mid);
                    }}
                  >
                    {t("addOpeningCenter")}
                  </button>
                  <button className="mini" onClick={() => { activateTool("opening"); }}>
                    {t("addOpeningClick")}
                  </button>
                </div>
                <label className="param-row">
                  <span>{t("constructionPhase")}</span>
                  <select
                    value={selected.phase ?? "new"}
                    onChange={(e) =>
                      studio()?.setElementPhase(
                        selected.id,
                        e.target.value as "existing" | "new" | "demolished" | "temporary",
                      )
                    }
                  >
                    <option value="new">{phaseLabels.new}</option>
                    <option value="existing">{phaseLabels.existing}</option>
                    <option value="demolished">{phaseLabels.demolished}</option>
                    <option value="temporary">{phaseLabels.temporary}</option>
                  </select>
                </label>
                <div className="btn-row">
                  <button
                    className="mini"
                    title={t("saveAsTypeTitle")}
                    onClick={() => {
                      const name = window.prompt(t("typeNamePrompt"), `${template.name} — variant`);
                      if (name) studio()?.saveAsType(name, selected.id);
                    }}
                  >
                    {t("btnSaveAsType")}
                  </button>
                  <button className="mini" onClick={() => studio()?.arraySelection(arrayCount, arraySpacing)}>
                    {t("btnArray")} {arrayCount}×{arraySpacing}
                  </button>
                </div>
                <button className="danger" onClick={() => studio()?.removeElement(selected.id)}>
                  {t("deleteElement")}
                </button>
              </div>
            )}
          </section>

          {typeDefs.length > 0 && (
            <section>
              <h2>{t("panTypes")} ({typeDefs.length})</h2>
              <ul className="list">
                {typeDefs.map((td) => {
                  let tplName = td.templateId;
                  try { tplName = getTemplate(td.templateId).name; } catch { /* template weg */ }
                  return (
                    <li key={td.id} className="type-row">
                      <button
                        className={td.id === activeTypeId ? "list-btn active" : "list-btn"}
                        title={`${tplName} — ${t("typeClickToDraw")}`}
                        onClick={() => onTypeChange(td.id === activeTypeId ? "" : td.id)}
                      >
                        {td.name}
                      </button>
                      <button
                        className="mini"
                        title={t("duplicateTypeTitle")}
                        onClick={() => {
                          const name = window.prompt(t("duplicateNamePrompt"), `${td.name} (${t("copySuffix")})`);
                          if (name) studio()?.duplicateType(td.id, name);
                        }}
                      >
                        ⧉
                      </button>
                      <button
                        className="mini"
                        title={t("applyToSelectionTitle")}
                        disabled={selectedIds.length === 0}
                        onClick={() => studio()?.applyType(td.id, selectedIds)}
                      >
                        →
                      </button>
                      <button className="mini" title={t("removeTypeTitle")} onClick={() => studio()?.removeType(td.id)}>
                        ✕
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="muted">{t("typesHint")}</p>
            </section>
          )}

          <section>
            <h2>{t("panStoreys")}</h2>
            <ul className="list">
              {storeys.map((s) => (
                <li key={s.id} className="storey-row">
                  <input
                    type="radio"
                    name="active-storey"
                    title={t("activeStoreyTitle")}
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
            <label className="param-row">
              <span>{t("geoEnabled")}</span>
              <input
                type="checkbox"
                checked={geoRef.enabled}
                onChange={(e) => {
                  const next = { ...geoRef, enabled: e.target.checked };
                  setGeoRef(next);
                  studio()?.setGeoRef(next);
                }}
              />
            </label>
            {geoRef.enabled && (
              <div className="origin-row">
                {(
                  [
                    ["RD X", "rdX"],
                    ["RD Y", "rdY"],
                    ["NAP", "napZ"],
                  ] as const
                ).map(([lbl, field]) => (
                  <label key={field}>
                    <span>{lbl}</span>
                    <input
                      type="number"
                      step={0.001}
                      value={geoRef[field]}
                      onChange={(e) => {
                        const next = { ...geoRef, [field]: Number(e.target.value) };
                        setGeoRef(next);
                        studio()?.setGeoRef(next);
                      }}
                    />
                  </label>
                ))}
                <em>m</em>
              </div>
            )}
          </section>

          <section>
            <h2>{t("panIdsCheck")}</h2>
            <label className="param-row">
              <span>{t("ruleset")}</span>
              <select value={idsPreset} onChange={(e) => setIdsPreset(e.target.value)}>
                {listPresets().map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </label>
            <div className="btn-row">
              <button
                className="mini accent"
                onClick={async () => setIlsReport((await studio()?.runIdsPreset(idsPreset)) ?? null)}
              >
                {t("btnRunCheck")}
              </button>
              <button
                className="mini"
                onClick={async () => {
                  const files = await openFilesDialog([{ name: "IDS", extensions: ["ids", "xml"] }], false);
                  if (files.length) setIlsReport((await studio()?.runIdsFile(files[0])) ?? null);
                }}
              >
                {t("btnIdsFileDots")}
              </button>
            </div>
            <p className="muted">{t("idsHint")}</p>
          </section>

          <section>
            <h2>{t("panPhasing")}</h2>
            <p className="muted">{t("phasingHint")}</p>
            <table className="phase-table">
              <thead>
                <tr>
                  <th>{t("colPhase")}</th>
                  <th>{t("colVisible")}</th>
                  <th>{t("colColor")}</th>
                  <th>{t("colDashed")}</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(phaseLabels) as ElementPhase[]).map((ph) => (
                  <tr key={ph}>
                    <td>{phaseLabels[ph]}</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={phaseSettings.visible[ph]}
                        onChange={(e) =>
                          studio()?.setPhaseSettings({
                            visible: { ...phaseSettings.visible, [ph]: e.target.checked },
                          })
                        }
                      />
                    </td>
                    <td>
                      {ph === "new" ? (
                        <span className="muted" title={t("phaseNewColorTitle")}>–</span>
                      ) : (
                        <input
                          type="color"
                          value={phaseSettings.color[ph] || "#7f7a70"}
                          onChange={(e) => {
                            // debounce: de color-picker vuurt per drag-tick en elke
                            // setPhaseSettings herbouwt de hele scene
                            const value = e.target.value;
                            setPhaseSettings((p) => ({ ...p, color: { ...p.color, [ph]: value } }));
                            if (phaseColorTimer.current) window.clearTimeout(phaseColorTimer.current);
                            phaseColorTimer.current = window.setTimeout(() => {
                              studio()?.setPhaseSettings({ color: { ...phaseSettings.color, [ph]: value } });
                            }, 150);
                          }}
                        />
                      )}
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={phaseSettings.wireframe[ph]}
                        onChange={(e) =>
                          studio()?.setPhaseSettings({
                            wireframe: { ...phaseSettings.wireframe, [ph]: e.target.checked },
                          })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

                <SheetPreview
                  sheet={activeSheet}
                  onViewportsChange={(vps) => updateSheet(activeSheet.id, { viewports: vps })}
                  captureSnapshot={captureSnapshot}
                />
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
          <section>
            <h2>{t("panSpeckle")}</h2>
            <label className="param-row"><span>{t("speckleHost")}</span>
              <input value={speckleCfg.host} onChange={(e) => setSpeckleCfg({ ...speckleCfg, host: e.target.value })} />
            </label>
            <label className="param-row"><span>{t("speckleStreamId")}</span>
              <input value={speckleCfg.streamId} onChange={(e) => setSpeckleCfg({ ...speckleCfg, streamId: e.target.value })} />
            </label>
            <label className="param-row"><span>{t("speckleBranch")}</span>
              <input value={speckleCfg.branchName} onChange={(e) => setSpeckleCfg({ ...speckleCfg, branchName: e.target.value })} />
            </label>
            <label className="param-row"><span>{t("speckleToken")}</span>
              <input type="password" value={speckleCfg.token} onChange={(e) => setSpeckleCfg({ ...speckleCfg, token: e.target.value })} />
            </label>
            <div className="btn-row">
              <button
                className="mini accent"
                disabled={!speckleCfg.token || !speckleCfg.streamId}
                onClick={() => studio()?.pushSpeckle(speckleCfg)}
              >
                {t("specklePushCommit")}
              </button>
            </div>
            <p className="muted">{t("speckleHint")}</p>
          </section>

          <section>
            <h2>{t("panPlugin")}</h2>
            <textarea
              className="ai-prompt"
              rows={8}
              value={pluginSrc}
              onChange={(e) => setPluginSrc(e.target.value)}
              placeholder="plugin((api) => { … })"
              spellCheck={false}
            />
            <div className="btn-row">
              <button className="mini accent" onClick={() => studio()?.runPlugin(pluginSrc)}>
                {t("btnRunPlugin")}
              </button>
              <button
                className="mini"
                onClick={async () => {
                  const files = await openFilesDialog([{ name: "Open 3D Studio-plugin", extensions: ["o3sp", "js"] }], false);
                  if (!files.length) return;
                  const src = await files[0].text();
                  setPluginSrc(src);
                  await studio()?.runPlugin(src);
                }}
              >
                {t("btnLoadO3sp")}
              </button>
            </div>
            <p className="muted">{t("pluginWarning")}</p>
          </section>

          <section>
            <h2>{t("panAssistant")}</h2>
            <label className="param-row">
              <span>{t("aiKeyLabel")}</span>
              <input
                type="password"
                className="ai-key"
                value={aiKey}
                onChange={(e) => {
                  setAiKey(e.target.value);
                  localStorage.setItem("o3s-apikey", e.target.value);
                }}
              />
            </label>
            <textarea
              className="ai-prompt"
              rows={3}
              placeholder={t("aiPromptPlaceholder")}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
            />
            <div className="btn-row">
              <button className="mini accent" disabled={aiBusy || !aiKey.trim() || !aiPrompt.trim()} onClick={runAssistant}>
                {aiBusy ? t("aiBusy") : t("aiRun")}
              </button>
            </div>
            {aiMessage && <p className="muted">{aiMessage}</p>}
            <p className="muted">{t("aiHint")}</p>
          </section>
        </aside>
      </div>

      {showTemplateEditor && (
        <TemplateEditor
          onClose={() => setShowTemplateEditor(false)}
          onSaved={() => setTemplatesRev((r) => r + 1)}
        />
      )}

      {ilsReport && (
        <div className="modal-overlay" onClick={() => setIlsReport(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{t("ilsTitle")}</h2>
            <ul className="ils-list">
              {ilsReport.map((b, i) => (
                <li key={i} className={`ils-${b.status}`}>
                  <span className="ils-icon">
                    {b.status === "ok" ? "✓" : b.status === "let-op" ? "!" : "✕"}
                  </span>
                  <span>
                    <strong>{b.eis}</strong> — {b.toelichting}
                  </span>
                </li>
              ))}
            </ul>
            <div className="btn-row">
              <button className="mini accent" onClick={() => setIlsReport(null)}>{t("close")}</button>
            </div>
          </div>
        </div>
      )}

      <footer className="statusbar">{status}</footer>
    </div>
  );
}
