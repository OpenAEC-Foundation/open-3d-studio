import * as THREE from "three";
import * as OBC from "@thatopen/components";
import { ClipEdges } from "@thatopen/components-front";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { allTemplates as allRegistryTemplates, getTemplate, templates } from "../catalog/registry";
import type {
  GridConfig,
  LineSegment,
  LoadedModelInfo,
  MeasureSegment,
  Opening,
  ParamValues,
  PlacedElement,
  ProjectOrigin,
  Sheet,
  Storey,
  TextLabel,
  ViewName,
} from "./types";
import { buildElementGroup, disposeGroup, elementOpenings } from "./meshBuilder";
import { deriveMainCategory } from "./mainCategory";
import type { ElementJoin, TypeDefinition } from "./types";
import { exportElementsToIfc } from "./ifcExport";
import { importDxf } from "./dxfImport";
import { renderSheetPdf } from "./sheetPdf";
import { saveFileAs, type FileFilter } from "./fileio";

export type ToolName =
  | "select"
  | "draw"
  | "line"
  | "rect"
  | "circle"
  | "measure"
  | "text"
  | "section"
  // v0.7 bewerken-gereedschappen
  | "align"        // klik referentie-element, dan uit te lijnen element
  | "mirror"       // klik 2 punten (spiegelas); werkt op de selectie
  | "split"        // klik op element: splitsen op dat punt
  | "opening"      // klik op element: sparing op dat punt
  // v0.8
  | "opening-poly" // klik hoekpunten op één element; rechtsklik rondt af
  | "match";       // klik bron-element, dan doel-element(en)
export type { ViewName };

/** Fase-instellingen voor de view: welke fasen zichtbaar zijn en welke grafische
 *  override (kleur, opacity, wireframe-streep) elke fase krijgt. v0.5-S7. */
export interface PhaseSettings {
  visible: Record<import("./types").ElementPhase, boolean>;
  color: Record<import("./types").ElementPhase, string>;
  opacity: Record<import("./types").ElementPhase, number>;
  wireframe: Record<import("./types").ElementPhase, boolean>;
}

export const DEFAULT_PHASE_SETTINGS: PhaseSettings = {
  visible: { new: true, existing: true, demolished: true, temporary: true },
  // amber = huidige stijl (nieuwbouw krijgt template.color); grijs voor bestaand;
  // dieprood voor sloop; helder geel voor tijdelijk.
  color: { new: "", existing: "#7f7a70", demolished: "#c23a2a", temporary: "#e5c344" },
  opacity: { new: 1, existing: 0.6, demolished: 0.55, temporary: 0.75 },
  wireframe: { new: false, existing: false, demolished: true, temporary: false },
};

const MM = 0.001;
const SNAP = 0.05; // 50 mm raster-snap bij het tekenen

export const LAYER_LINES = "Lijnen";
export const LAYER_MEASURES = "Maatvoering";
export const LAYER_TEXTS = "Teksten";
export const LAYER_GRID = "Stramien";

export interface StudioCallbacks {
  onModelsChanged?: (models: LoadedModelInfo[]) => void;
  onElementsChanged?: (elements: PlacedElement[]) => void;
  onSelectionChanged?: (id: string | null) => void;
  onLayersChanged?: (layers: { name: string; visible: boolean }[]) => void;
  onStoreysChanged?: (storeys: Storey[], activeId: string) => void;
  onGridChanged?: (grid: GridConfig) => void;
  onOriginChanged?: (origin: ProjectOrigin) => void;
  onGeoRefChanged?: (geoRef: { enabled: boolean; rdX: number; rdY: number; napZ: number }) => void;
  onPhaseSettingsChanged?: (phaseSettings: PhaseSettings) => void;
  /** v0.7-S1: volledige selectie (ids); onSelectionChanged blijft de primaire melden. */
  onSelectionSetChanged?: (ids: string[]) => void;
  /** v0.7-S5: typenlijst gewijzigd. */
  onTypesChanged?: (types: TypeDefinition[]) => void;
  onStatus?: (msg: string) => void;
}

export class Studio {
  components = new OBC.Components();
  callbacks: StudioCallbacks = {};

  activeTemplateId = "storax-rooster-lamelwand";
  currentParams: ParamValues;
  origin: ProjectOrigin = { x: 0, y: 0, z: 0 };

  private world: any;
  private fragments!: OBC.FragmentsManager;
  private ifcLoader!: OBC.IfcLoader;
  private gridObject: THREE.Object3D | null = null;
  private originHelper: THREE.AxesHelper | null = null;

  private models: LoadedModelInfo[] = [];
  private elements: PlacedElement[] = [];
  private lines: LineSegment[] = [];
  private measures: MeasureSegment[] = [];
  private texts: TextLabel[] = [];
  private selectedId: string | null = null;
  /** v0.7-S1: volledige selectie; selectedId blijft de primaire (anchor). */
  private selectedIds = new Set<string>();
  /** v0.7-S3: verbindingen tussen lijnelementen (L/T), meebewegend. */
  joins: ElementJoin[] = [];
  /** v0.7-S5: benoemde typen (project + gebruikersbibliotheek). */
  types: TypeDefinition[] = [];
  /** v0.7-S5: actief type voor plaatsing (currentParams volgen bij setActiveType). */
  activeTypeId: string | null = null;
  private layerVisibility = new Map<string, boolean>();
  private dxfGroups = new Map<string, THREE.Group>();
  // v0.7-S2: eind-handles + snap-markers
  private handleGroup = new THREE.Group();
  private snapMarker: THREE.Mesh | null = null;
  private handleDrag: { elementId: string; which: "start" | "end"; moved: boolean } | null = null;
  // v0.7-S1: venster-selectie (Shift+drag)
  private marquee: { x0: number; y0: number; x1: number; y1: number } | null = null;
  private marqueeDiv: HTMLDivElement | null = null;
  // v0.7 tool-tussenstanden
  private alignRefId: string | null = null;
  private mirrorStart: THREE.Vector3 | null = null;
  // v0.8 tool-tussenstanden
  private polyDraft: { elementId: string; points: [number, number][] } | null = null;
  private matchSourceId: string | null = null;

  storeys: Storey[] = [{ id: "storey-0", name: "00 begane grond", elevation: 0 }];
  activeStoreyId = "storey-0";
  grid: GridConfig = { enabled: false, countX: 5, spacingX: 5, countY: 3, spacingY: 5 };
  /** RD-georeferentie (EPSG:28992), coördinaten in meters */
  geoRef = { enabled: false, rdX: 0, rdY: 0, napZ: 0 };
  /** v0.5-S7: fase-view-filters + graphic overrides. */
  phaseSettings: PhaseSettings = JSON.parse(JSON.stringify(DEFAULT_PHASE_SETTINGS));
  private gridGroup = new THREE.Group();

  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private lastUndoPush = 0;

  private dragging = false;
  private dragMoved = false;
  private dragPlaneY = 0;
  private dragLast: THREE.Vector3 | null = null;

  private authoredGroup = new THREE.Group();
  private lineGroup = new THREE.Group();
  private measureGroup = new THREE.Group();
  private textGroup = new THREE.Group();
  private dxfRoot = new THREE.Group();
  private previewGroup: THREE.Group | null = null;
  private previewLine: THREE.Line | null = null;

  /** Actieve selectie op een geladen IFC-fragment (fragments.list.get(modelId)). */
  private selectedFragment: { modelId: string; localId: number } | null = null;

  /** ClipEdges renderer voor het genereren van 2D-doorsnedelijnen op de actieve snijvlak
   *  (v0.4-S9 productie-slag doorsnedes fase 1). */
  private clipEdges: ClipEdges | null = null;

  currentView: ViewName = "iso";
  currentText = "Tekst";

  private tool: ToolName = "select";
  private drawStart: THREE.Vector3 | null = null;
  private lineStart: THREE.Vector3 | null = null;
  private rectStart: THREE.Vector3 | null = null;
  private circleCenter: THREE.Vector3 | null = null;
  private measureStart: THREE.Vector3 | null = null;
  private lastMovePoint: THREE.Vector3 | null = null;
  private pointerDownPos: { x: number; y: number } | null = null;
  private raycaster = new THREE.Raycaster();
  private modelCounter = 0;
  private elementCounters = new Map<string, number>();
  private disposed = false;

  constructor() {
    this.currentParams = { ...getTemplate(this.activeTemplateId).defaults };
    // v0.7-S6: lagen op hoofdcategorie (12 vaste) i.p.v. 24 losse strings
    for (const t of templates) this.layerVisibility.set(deriveMainCategory(t), true);
    this.layerVisibility.set(LAYER_LINES, true);
    this.layerVisibility.set(LAYER_MEASURES, true);
    this.layerVisibility.set(LAYER_TEXTS, true);
    this.layerVisibility.set(LAYER_GRID, true);
  }

  async init(container: HTMLElement) {
    const worlds = this.components.get(OBC.Worlds);
    const world = worlds.create<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBC.SimpleRenderer>();
    world.scene = new OBC.SimpleScene(this.components);
    world.renderer = new OBC.SimpleRenderer(this.components, container);
    world.camera = new OBC.OrthoPerspectiveCamera(this.components);
    this.components.init();
    world.scene.setup();
    world.scene.three.background = new THREE.Color("#211d1a");
    this.world = world;

    // geen extern logo in de viewport
    try {
      (world.renderer as any).showLogo = false;
    } catch {
      /* eigenschap bestaat mogelijk niet */
    }

    const grids = this.components.get(OBC.Grids);
    const grid: any = grids.create(world);
    this.gridObject = grid?.three ?? null;

    world.scene.three.add(
      this.authoredGroup,
      this.lineGroup,
      this.measureGroup,
      this.textGroup,
      this.dxfRoot,
      this.gridGroup,
      this.handleGroup,
    );
    // v0.7-S1: marquee-overlay voor venster-selectie (Shift+drag)
    const marqueeDiv = document.createElement("div");
    marqueeDiv.style.cssText =
      "position:absolute;border:1px dashed #d97706;background:rgba(217,119,6,0.08);pointer-events:none;display:none;z-index:5;";
    container.style.position = "relative";
    container.appendChild(marqueeDiv);
    this.marqueeDiv = marqueeDiv;
    world.camera.controls.setLookAt(14, 10, 14, 0, 0, 0);
    this.raycaster.params.Line = { threshold: 0.05 };
    this.refreshOriginHelper();
    this.rebuildGrid();

    // Fragments-worker: lokaal gekopieerd bestand; anders ophalen via That Open
    this.fragments = this.components.get(OBC.FragmentsManager);
    this.fragments.init(await this.resolveFragmentsWorker());

    this.fragments.list.onItemSet.add(({ key, value: model }: any) => {
      model.useCamera(world.camera.three);
      world.scene.three.add(model.object);
      this.fragments.core.update(true);
      this.models.push({ id: key, name: key, visible: true });
      this.emitModels();
      this.setStatus(`Model geladen: ${key}`);
      this.zoomAll();
    });

    world.camera.controls.addEventListener("rest", () => {
      this.fragments.core.update(true);
    });

    this.ifcLoader = this.components.get(OBC.IfcLoader);
    await this.ifcLoader.setup({
      autoSetWasm: false,
      wasm: { path: "/wasm/", absolute: true },
    });

    this.bindPointerEvents();

    // v0.7-S5: gebruikersbibliotheek met typen meteen beschikbaar
    this.mergeUserTypeLibrary();
    this.callbacks.onTypesChanged?.([...this.types]);

    // Renderergrootte volgt de container (ook bij paneelwijzigingen en late layout)
    const resize = () => {
      try {
        world.renderer?.resize();
        world.camera.updateAspect();
      } catch {
        /* renderer kan al opgeruimd zijn */
      }
    };
    new ResizeObserver(resize).observe(container);
    resize();

    if (import.meta.env.DEV) {
      (window as any).__studio = this;
    }

    this.setStatus("Klaar. Laad één of meer IFC-bestanden of teken direct een component.");
  }

  private async resolveFragmentsWorker(): Promise<string> {
    try {
      const res = await fetch("/fragments-worker.mjs");
      if (res.ok) {
        const src = await res.text();
        if (!src.trimStart().startsWith("<")) {
          return URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
        }
      }
    } catch {
      /* val terug op externe worker */
    }
    return await (OBC.FragmentsManager as any).getWorker();
  }

  // ------------------------------------------------------------------ bestanden laden
  async loadFiles(files: Iterable<File>) {
    for (const file of files) {
      if (/\.dxf$/i.test(file.name)) await this.loadDxfFile(file);
      else if (/\.ifc$/i.test(file.name)) await this.loadIfcFile(file);
      else this.setStatus(`Bestandstype niet ondersteund: ${file.name} (wel: .ifc, .dxf).`);
    }
  }

  private async loadIfcFile(file: File) {
    try {
      this.setStatus(`IFC laden: ${file.name} …`);
      const buffer = new Uint8Array(await file.arrayBuffer());
      const name = `${file.name.replace(/\.ifc$/i, "")}_${++this.modelCounter}`;
      await this.ifcLoader.load(buffer, false, name, {
        processData: {
          progressCallback: (p: number) =>
            this.setStatus(`IFC laden: ${file.name} — ${Math.round(p * 100)}%`),
        },
      });
    } catch (err) {
      console.error(err);
      this.setStatus(`Laden van ${file.name} is mislukt (zie console).`);
    }
  }

  private async loadDxfFile(file: File) {
    try {
      this.setStatus(`DXF laden: ${file.name} …`);
      const text = await file.text();
      const result = importDxf(text, file.name.replace(/\.dxf$/i, ""));
      const layerName = `DXF: ${result.name}`;
      this.dxfRoot.add(result.group);
      this.dxfGroups.set(layerName, result.group);
      this.layerVisibility.set(layerName, true);
      this.emitLayers();
      this.zoomAll();
      this.setStatus(
        `DXF geladen: ${result.name} (${result.entityCount} elementen${result.skipped ? `, ${result.skipped} overgeslagen` : ""}).`,
      );
    } catch (err) {
      console.error(err);
      this.setStatus(`Laden van ${file.name} is mislukt (zie console).`);
    }
  }

  /** compatibiliteit: oudere aanroepen laden alleen IFC */
  async loadIfcFiles(files: Iterable<File>) {
    await this.loadFiles(files);
  }

  /** Heropent een eerder door Open 3D Studio geëxporteerd IFC als bewerkbare elementen. */
  async reopenIfcAsProject(file: File): Promise<boolean> {
    this.setStatus(`IFC lezen: ${file.name} …`);
    try {
      const { readO3sDataFromIfc } = await import("./ifcReopen");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const data = await readO3sDataFromIfc(bytes);
      if (data.length === 0) {
        this.setStatus(
          "Geen Open 3D Studio-elementen gevonden in dit IFC — laad het als referentiemodel via IFC/DXF laden.",
        );
        return false;
      }
      this.pushUndo();
      const v = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2]);
      // verdiepingen herstellen: eerst op id, dan op naam matchen, anders aanmaken
      const resolveStorey = (d: any): string => {
        if (this.storeys.some((s) => s.id === d.storeyId)) return d.storeyId;
        if (d.storeyName) {
          const byName = this.storeys.find((s) => s.name === d.storeyName);
          if (byName) return byName.id;
          const created: Storey = {
            id: crypto.randomUUID(),
            name: d.storeyName,
            elevation: typeof d.storeyElevation === "number" ? d.storeyElevation : 0,
          };
          this.storeys.push(created);
          return created.id;
        }
        return this.activeStoreyId;
      };
      for (const d of data) {
        try {
          getTemplate(d.templateId);
        } catch {
          continue; // onbekend template overslaan
        }
        const n = (this.elementCounters.get(d.templateId) ?? 0) + 1;
        this.elementCounters.set(d.templateId, n);
        this.elements.push({
          id: crypto.randomUUID(),
          templateId: d.templateId,
          name: d.name ?? `${getTemplate(d.templateId).name} ${String(n).padStart(2, "0")}`,
          start: v(d.start),
          end: v(d.end),
          params: { ...d.params },
          storeyId: resolveStorey(d),
          opening: null,
          // v0.7: openings-array; oudere IFC's hebben nog het enkelvoudige veld
          openings: (d.openings ?? (d.opening ? [d.opening] : [])).map((o: any) => ({
            id: crypto.randomUUID(),
            shape: "rect",
            kind: "vrij",
            ...o,
          })),
          // fase overleeft de IFC-round-trip; hostId niet — element-ids worden
          // bij heropenen opnieuw gegenereerd, dus die koppeling zou bungelen
          phase: d.phase ?? "new",
        });
      }
      this.storeys.sort((a, b) => a.elevation - b.elevation);
      this.emitStoreys();
      this.rebuildAuthored();
      this.emitElements();
      this.zoomAll();
      this.setStatus(`IFC heropend: ${data.length} element(en) zijn weer bewerkbaar.`);
      return true;
    } catch (err) {
      console.error(err);
      this.setStatus(`Heropenen van ${file.name} is mislukt (zie console).`);
      return false;
    }
  }

  setModelVisible(id: string, visible: boolean) {
    const model: any = this.fragments.list.get(id);
    if (model?.object) {
      model.object.visible = visible;
      this.fragments.core.update(true);
    }
    const info = this.models.find((m) => m.id === id);
    if (info) info.visible = visible;
    this.emitModels();
  }

  // ------------------------------------------------------------------ exports
  async exportIfc() {
    if (this.elements.length === 0) {
      this.setStatus("Nog geen elementen om te exporteren — teken eerst een component.");
      return;
    }
    this.setStatus("IFC-export maken …");
    try {
      this.recomputeMerken();
      const bytes = await exportElementsToIfc(this.elements, {
        origin: this.origin,
        storeys: this.storeys,
        grid: this.grid,
        geoRef: this.geoRef.enabled ? this.geoRef : undefined,
        joins: this.joins,
        types: this.types,
      });
      if (
        await this.saveAs(bytes, "open-3d-studio_storax-componenten.ifc", {
          name: "IFC-model",
          extensions: ["ifc"],
        })
      ) {
        this.setStatus(`IFC geëxporteerd: ${this.elements.length} element(en).`);
      }
    } catch (err) {
      console.error(err);
      this.setStatus("IFC-export mislukt (zie console).");
    }
  }

  async exportStl() {
    if (this.elements.length === 0) {
      this.setStatus("Nog geen elementen om als STL te exporteren.");
      return;
    }
    this.cancelDrawing();
    // STL in millimeters (gangbaar voor 3D-printen)
    const wrapper = new THREE.Object3D();
    wrapper.scale.setScalar(1000);
    wrapper.add(this.authoredGroup.clone(true));
    wrapper.updateMatrixWorld(true);
    const data = new STLExporter().parse(wrapper, { binary: true }) as unknown as DataView;
    const bytes = new Uint8Array(data.buffer as ArrayBuffer);
    if (
      await this.saveAs(bytes, "open-3d-studio_componenten.stl", {
        name: "STL (3D-print)",
        extensions: ["stl"],
      })
    ) {
      this.setStatus(`STL geëxporteerd (${this.elements.length} elementen, eenheid mm).`);
    }
  }

  async exportPdf(viewLabel = "Huidig aanzicht") {
    try {
      const renderer: THREE.WebGLRenderer = this.world.renderer.three;
      renderer.render(this.world.scene.three, this.world.camera.three);
      const png = renderer.domElement.toDataURL("image/png");

      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 10;
      const frameH = pageH - margin * 2;
      const frameW = pageW - margin * 2;

      const aspect = renderer.domElement.width / renderer.domElement.height;
      let imgW = frameW;
      let imgH = imgW / aspect;
      if (imgH > frameH - 18) {
        imgH = frameH - 18;
        imgW = imgH * aspect;
      }
      doc.setFillColor(28, 25, 23);
      doc.rect(margin, margin, frameW, frameH - 18, "F");
      doc.addImage(png, "PNG", margin + (frameW - imgW) / 2, margin, imgW, Math.min(imgH, frameH - 18));

      // eenvoudige onderhoek (titelblok)
      const y = pageH - margin - 14;
      doc.setDrawColor(60);
      doc.rect(margin, y, frameW, 14);
      doc.setFontSize(11);
      doc.setTextColor(30);
      doc.text("Open 3D Studio — Storax componenten", margin + 4, y + 6);
      doc.setFontSize(9);
      doc.text(`Aanzicht: ${viewLabel}`, margin + 4, y + 11);
      doc.text(`Datum: ${new Date().toLocaleDateString("nl-NL")}`, margin + frameW - 60, y + 6);
      doc.text(`Elementen: ${this.elements.length}`, margin + frameW - 60, y + 11);

      if (
        await this.saveAs(doc.output("blob"), "open-3d-studio_aanzicht.pdf", {
          name: "PDF",
          extensions: ["pdf"],
        })
      ) {
        this.setStatus("PDF geëxporteerd (huidig aanzicht op A3).");
      }
    } catch (err) {
      console.error(err);
      this.setStatus("PDF-export mislukt (zie console).");
    }
  }

  /** BIM basis ILS-controle van de huidige modelinhoud. */
  async runIlsCheck() {
    const { checkIls } = await import("./ilsCheck");
    this.recomputeMerken();
    return checkIls(this.elements, this.storeys);
  }

  /** Draai een specifieke IDS-preset (v0.5-S1 + S6). */
  async runIdsPreset(presetId: string) {
    const { checkWithPreset } = await import("./ilsCheck");
    this.recomputeMerken();
    return checkWithPreset(presetId, this.elements, this.storeys);
  }

  /** Draai een geïmporteerd IDS-XML-bestand tegen het model (v0.5-S1). */
  async runIdsFile(file: File) {
    const { checkWithIdsXml } = await import("./ilsCheck");
    this.recomputeMerken();
    const xml = await file.text();
    return checkWithIdsXml(xml, this.elements, this.storeys);
  }

  /** Elementen die in productie-/asset-exports thuishoren: sloop telt niet mee.
   *  (De hoofd-IFC-export behoudt wél alle fasen en tagt ze met een Fase-property.) */
  private productionElements(): PlacedElement[] {
    return this.elements.filter((e) => (e.phase ?? "new") !== "demolished");
  }

  /** Structural view exporteren als aspect-IFC (v0.5-S4). */
  async exportStructural() {
    const els = this.productionElements();
    if (els.length === 0) {
      this.setStatus("Geen (niet-sloop) elementen — teken eerst een draagconstructie.");
      return;
    }
    this.setStatus("Structural view maken …");
    try {
      const { exportStructuralView } = await import("./structuralExport");
      const bytes = await exportStructuralView(els, {
        projectName: "Open 3D Studio — structural aspect",
        storeys: this.storeys,
      });
      if (await this.saveAs(bytes, "open-3d-studio_structural.ifc", { name: "IFC (structural aspect)", extensions: ["ifc"] })) {
        this.setStatus(`Structural IFC geëxporteerd (${els.length} elementen, sloop uitgesloten).`);
      }
    } catch (err) {
      console.error(err);
      this.setStatus("Structural export mislukt (zie console).");
    }
  }

  /** IFC-family importeren als proxy-templates (v0.6-2). */
  async importIfcFamily(file: File): Promise<{ added: number; skipped: number; source: string }> {
    try {
      const { importIfcFamily } = await import("./ifcFamilyImport");
      const res = await importIfcFamily(file);
      this.setStatus(
        `Bibliotheek geladen: ${res.proxies.length} template(s) uit ${res.sourceName}` +
          (res.skipped ? ` (${res.skipped} overgeslagen zonder geometrie)` : ""),
      );
      return { added: res.proxies.length, skipped: res.skipped, source: res.sourceName };
    } catch (err) {
      console.error(err);
      this.setStatus(`Bibliotheek laden mislukt: ${err instanceof Error ? err.message : String(err)}`);
      return { added: 0, skipped: 0, source: file.name };
    }
  }

  /** Wapening-BOM van huidige selectie of hele model als CSV (v0.6-4). */
  async exportRebarBom() {
    const els = this.productionElements();
    if (els.length === 0) {
      this.setStatus("Nog geen (niet-sloop) elementen — teken eerst iets met beton.");
      return;
    }
    try {
      const { rebarBomCsv, rebarTotalsByDiameter } = await import("./rebarGenerator");
      const csv = rebarBomCsv(els);
      const totals = rebarTotalsByDiameter(els);
      const totalKg = [...totals.values()].reduce((s, t) => s + t.totalKg, 0);
      if (
        await this.saveAs("﻿" + csv, "open-3d-studio_wapening.csv", {
          name: "Wapening-BOM (CSV)",
          extensions: ["csv"],
        })
      ) {
        this.setStatus(
          `Wapening geëxporteerd (${[...totals.keys()].length} diameters, ${totalKg.toFixed(1)} kg totaal).`,
        );
      }
    } catch (err) {
      console.error(err);
      this.setStatus("Wapening-export mislukt (zie console).");
    }
  }

  /** Speckle push (v0.6-5). Config via UI in het Speckle-paneel. */
  async pushSpeckle(cfg: { host?: string; token: string; streamId: string; branchName?: string }) {
    try {
      const { pushToSpeckle } = await import("./speckleConnector");
      const res = await pushToSpeckle(this.elements, this.storeys, cfg);
      this.setStatus(res.message);
      return res;
    } catch (err) {
      console.error(err);
      this.setStatus(`Speckle-push mislukt: ${err instanceof Error ? err.message : String(err)}`);
      return { ok: false, message: String(err) };
    }
  }

  /** Plugin laden en draaien (v0.6-6). */
  async runPlugin(source: string) {
    const { loadPlugin } = await import("./pluginApi");
    const res = await loadPlugin(source, {
      getElements: () => this.elements,
      getStoreys: () => this.storeys,
      applyPlacements: async (placements) => {
        const before = this.elements.length;
        this.applyAssistantPlacements(placements as any);
        return this.elements.slice(before).map((e) => e.id);
      },
      onLog: (msg) => this.setStatus(`Plugin: ${msg}`),
    });
    this.setStatus(res.message);
    return res;
  }

  /** Doorsnede fase 2 — SVG exporteren met hatch per materiaal (v0.6-7). */
  async exportSectionSvg(plane: { normal: "x" | "z"; offset: number }, scale = 50) {
    if (this.elements.length === 0) {
      this.setStatus("Geen elementen om te doorsnijden.");
      return;
    }
    try {
      const { renderSectionSvg } = await import("./sectionSvg");
      const svg = renderSectionSvg(this.elements, plane, { scale });
      if (
        await this.saveAs(svg, `open-3d-studio_doorsnede.svg`, {
          name: "SVG (doorsnede)",
          extensions: ["svg"],
        })
      ) {
        this.setStatus(`Doorsnede-SVG geëxporteerd (${plane.normal} = ${plane.offset.toFixed(2)} m, 1:${scale}).`);
      }
    } catch (err) {
      console.error(err);
      this.setStatus("Doorsnede-SVG mislukt (zie console).");
    }
  }

  /** COBie 2.4-export als ZIP met CSV-tabbladen (v0.5-S5).
   *  COBie beschrijft het op te leveren gebouw — sloop-elementen doen niet mee. */
  async exportCobie() {
    const els = this.productionElements();
    if (els.length === 0) {
      this.setStatus("Geen (niet-sloop) elementen — teken eerst iets voor de COBie-export.");
      return;
    }
    try {
      this.recomputeMerken();
      const { exportCobieZip } = await import("./cobieExport");
      const blob = await exportCobieZip(els, this.storeys, {
        projectName: "Open 3D Studio project",
      });
      if (await this.saveAs(blob, "open-3d-studio_cobie.zip", { name: "COBie (ZIP van CSV's)", extensions: ["zip"] })) {
        this.setStatus(`COBie-export klaar (${els.length} components, sloop uitgesloten).`);
      }
    } catch (err) {
      console.error(err);
      this.setStatus("COBie-export mislukt (zie console).");
    }
  }

  setGeoRef(geoRef: { enabled: boolean; rdX: number; rdY: number; napZ: number }) {
    this.geoRef = { ...geoRef };
    this.setStatus(
      geoRef.enabled
        ? `RD-georeferentie actief: X ${geoRef.rdX}, Y ${geoRef.rdY}, NAP ${geoRef.napZ} m.`
        : "RD-georeferentie uitgeschakeld.",
    );
  }

  /** BCF 2.1-issue van het huidige aanzicht (camera + schermafbeelding). */
  async exportBcf(title: string) {
    try {
      const renderer: THREE.WebGLRenderer = this.world.renderer.three;
      renderer.render(this.world.scene.three, this.world.camera.three);
      const dataUrl = renderer.domElement.toDataURL("image/png");
      const png = Uint8Array.from(atob(dataUrl.split(",")[1]), (c) => c.charCodeAt(0));
      const { makeBcfIssue } = await import("./bcfExport");
      const bytes = makeBcfIssue({
        title: title.trim() || `Issue ${new Date().toLocaleString("nl-NL")}`,
        camera: this.world.camera.three,
        snapshotPng: png,
      });
      if (await this.saveAs(bytes, "open-3d-studio_issue.bcf", { name: "BCF-issue", extensions: ["bcf", "bcfzip"] })) {
        this.setStatus("BCF-issue geëxporteerd (met standpunt en schermafbeelding).");
      }
    } catch (err) {
      console.error(err);
      this.setStatus("BCF-export mislukt (zie console).");
    }
  }

  /** Leest een BCF-bestand (`.bcf`/`.bcfzip`) en toont de topics als statusmelding.
   *  Volledige round-trip (topics als annotaties op het model) volgt in v0.5. */
  async importBcf(file: File): Promise<{ topics: number }> {
    try {
      const { importBcfZip } = await import("./bcfImport");
      const bytes = await file.arrayBuffer();
      const topics = await importBcfZip(bytes);
      this.setStatus(
        topics.length > 0
          ? `BCF ingelezen: ${topics.length} issue(s). Titels: ${topics.slice(0, 3).map((t) => t.title).join(" · ")}${topics.length > 3 ? " …" : ""}`
          : "BCF ingelezen, maar geen topics gevonden.",
      );
      return { topics: topics.length };
    } catch (err) {
      console.error(err);
      this.setStatus(`BCF-import mislukt: ${err instanceof Error ? err.message : String(err)}`);
      return { topics: 0 };
    }
  }

  /** Plaatsingen van de AI-assistent doorvoeren (bouwkundige coördinaten, meters). */
  applyAssistantPlacements(
    placements: { templateId: string; start: [number, number]; end: [number, number]; params?: ParamValues }[],
  ): number {
    if (placements.length === 0) return 0;
    this.pushUndo();
    const elev = this.getActiveStorey().elevation;
    let geplaatst = 0;
    for (const p of placements) {
      let template;
      try {
        template = getTemplate(p.templateId);
      } catch {
        continue;
      }
      const n = (this.elementCounters.get(template.id) ?? 0) + 1;
      this.elementCounters.set(template.id, n);
      this.elements.push({
        id: crypto.randomUUID(),
        templateId: template.id,
        name: `${template.name} ${String(n).padStart(2, "0")}`,
        // bouwkundig (x=oost, y=noord) -> three (x, peil, -y)
        start: new THREE.Vector3(p.start[0], elev, -p.start[1]),
        end: new THREE.Vector3(p.end[0], elev, -p.end[1]),
        params: { ...template.defaults, ...(p.params ?? {}) },
        storeyId: this.activeStoreyId,
        opening: null,
      });
      geplaatst++;
    }
    this.rebuildAuthored();
    this.emitElements();
    this.zoomAll();
    this.setStatus(`Assistent: ${geplaatst} element(en) geplaatst.`);
    return geplaatst;
  }

  /** 2D-DXF-export van het bovenaanzicht (footprints, lijnen, maten, teksten). */
  async exportDxf() {
    if (this.elements.length === 0 && this.lines.length === 0 && this.measures.length === 0) {
      this.setStatus("Niets om naar DXF te exporteren.");
      return;
    }
    try {
      this.recomputeMerken();
      const { exportTopViewDxf } = await import("./dxfExport");
      const dxf = exportTopViewDxf({
        elements: this.elements,
        lines: this.lines,
        measures: this.measures,
        texts: this.texts,
      });
      if (
        await this.saveAs(dxf, "open-3d-studio_bovenaanzicht.dxf", {
          name: "DXF (2D)",
          extensions: ["dxf"],
        })
      ) {
        this.setStatus("DXF geëxporteerd (bovenaanzicht, mm).");
      }
    } catch (err) {
      console.error(err);
      this.setStatus("DXF-export mislukt (zie console).");
    }
  }

  /** DWG-export (v0.4-S9). Vraagt de Rust-kant om via acadrust een DWG te schrijven;
   *  bij ontbrekende acadrust-config valt het netjes terug op DXF. */
  async exportDwg(targetVersion: "r2013" | "r2018" = "r2013") {
    if (this.elements.length === 0 && this.lines.length === 0 && this.measures.length === 0) {
      this.setStatus("Niets om naar DWG te exporteren.");
      return;
    }
    try {
      this.recomputeMerken();
      const { exportDwg } = await import("./dwgExport");
      await exportDwg({
        elements: this.elements,
        lines: this.lines,
        measures: this.measures,
        texts: this.texts,
        projectName: "open-3d-studio",
        targetVersion,
        onFallback: (reason) => {
          this.setStatus(`DWG niet beschikbaar (${reason.slice(0, 120)}). Terugval: DXF opgeslagen.`);
        },
      });
      this.setStatus(`DWG-export (AutoCAD ${targetVersion === "r2018" ? "2018" : "2013"}) klaar.`);
    } catch (err) {
      console.error(err);
      this.setStatus("DWG-export mislukt (zie console).");
    }
  }

  /** Elementeer- en productierapport (HSBcad-principe). Sloop wordt niet geproduceerd. */
  async exportElementeerRapport(maxPaneelbreedteMm: number) {
    const els = this.productionElements();
    if (els.length === 0) {
      this.setStatus("Nog geen (niet-sloop) elementen om te elementeren.");
      return;
    }
    try {
      this.recomputeMerken();
      const { maakElementeerRapport } = await import("./elementeren");
      const blob = await maakElementeerRapport(els, maxPaneelbreedteMm);
      if (
        await this.saveAs(blob, "open-3d-studio_productierapport.pdf", {
          name: "PDF",
          extensions: ["pdf"],
        })
      ) {
        this.setStatus(
          `Productierapport geëxporteerd (${els.length} element(en), max. paneel ${maxPaneelbreedteMm} mm).`,
        );
      }
    } catch (err) {
      console.error(err);
      this.setStatus("Productierapport mislukt (zie console).");
    }
  }

  private async saveAs(
    data: Uint8Array | Blob | string,
    filename: string,
    filter: FileFilter,
  ): Promise<boolean> {
    const bytes = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data;
    const ok = await saveFileAs(bytes, filename, [filter]);
    if (!ok) this.setStatus("Opslaan geannuleerd.");
    return ok;
  }

  // ------------------------------------------------------------------ project
  /** Serialiseert de volledige modelinhoud voor het .o3s-projectbestand. */
  serializeProject(): Record<string, unknown> {
    const v = (p: THREE.Vector3) => [p.x, p.y, p.z];
    return {
      version: 2,
      app: "open-3d-studio",
      origin: { ...this.origin },
      storeys: this.storeys.map((s) => ({ ...s })),
      activeStoreyId: this.activeStoreyId,
      grid: { ...this.grid },
      geoRef: { ...this.geoRef },
      elements: this.elements.map((e) => ({
        id: e.id,
        templateId: e.templateId,
        name: e.name,
        start: v(e.start),
        end: v(e.end),
        params: { ...e.params },
        storeyId: e.storeyId,
        opening: e.opening ? { ...e.opening } : null,
        openings: (e.openings ?? []).map((o) => ({ ...o })),
        merk: e.merk,
        typeId: e.typeId,
        // v0.6-fix: fasering en hosting horen de undo/save-round-trip te overleven
        phase: e.phase,
        hostId: e.hostId,
        spaceId: e.spaceId,
      })),
      joins: this.joins.map((j) => ({ ...j })),
      types: this.types.map((t) => ({ ...t, typeParams: { ...t.typeParams } })),
      lines: this.lines.map((l) => ({ id: l.id, a: v(l.a), b: v(l.b) })),
      measures: this.measures.map((m) => ({ id: m.id, a: v(m.a), b: v(m.b), length: m.length })),
      texts: this.texts.map((t) => ({ id: t.id, position: v(t.position), text: t.text })),
    };
  }

  /** Herstelt de modelinhoud uit een .o3s-projectbestand. */
  restoreProject(state: any, opts: { silent?: boolean } = {}) {
    const v = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2]);
    this.cancelDrawing();
    // Elementen met een onbekend templateId overslaan (runtime-templates uit
    // .o3st/plugins/IFC-family kunnen na een herstart ontbreken) — anders gooit
    // rebuildAuthored en blijft de studio half-hersteld achter.
    const rawElements: any[] = state.elements ?? [];
    const known = rawElements.filter((e: any) => {
      try {
        getTemplate(e.templateId);
        return true;
      } catch {
        return false;
      }
    });
    const skipped = rawElements.length - known.length;
    this.elements = known.map((e: any) => ({
      ...e,
      start: v(e.start),
      end: v(e.end),
      params: { ...e.params },
      opening: e.opening ?? null,
    }));
    this.lines = (state.lines ?? []).map((l: any) => ({ ...l, a: v(l.a), b: v(l.b) }));
    this.measures = (state.measures ?? []).map((m: any) => ({ ...m, a: v(m.a), b: v(m.b) }));
    this.texts = (state.texts ?? []).map((t: any) => ({ ...t, position: v(t.position) }));
    this.origin = state.origin ?? { x: 0, y: 0, z: 0 };
    this.storeys = state.storeys?.length
      ? state.storeys.map((s: any) => ({ ...s }))
      : [{ id: "storey-0", name: "00 begane grond", elevation: 0 }];
    this.activeStoreyId = this.storeys.some((s: Storey) => s.id === state.activeStoreyId)
      ? state.activeStoreyId
      : this.storeys[0].id;
    if (state.grid) this.grid = { ...state.grid };
    if (state.geoRef) this.geoRef = { ...state.geoRef };
    this.elementCounters.clear();
    for (const el of this.elements) {
      this.elementCounters.set(el.templateId, (this.elementCounters.get(el.templateId) ?? 0) + 1);
    }
    // v0.7: migratie legacy enkelvoudige sparing → openings[] met id/shape
    for (const el of this.elements) {
      if (el.opening) {
        el.openings = [
          ...(el.openings ?? []),
          { id: crypto.randomUUID(), shape: "rect", kind: "vrij", ...el.opening },
        ];
        el.opening = null;
      }
    }
    // v0.7-S3/S5: joins en typen mee-herstellen (verwijzingen naar verdwenen
    // elementen/templates opruimen)
    const elementIds = new Set(this.elements.map((e) => e.id));
    this.joins = ((state.joins ?? []) as ElementJoin[]).filter(
      (j) => elementIds.has(j.aId) && elementIds.has(j.bId),
    );
    this.types = ((state.types ?? []) as TypeDefinition[]).filter((t) => {
      try {
        getTemplate(t.templateId);
        return true;
      } catch {
        return false;
      }
    });
    this.mergeUserTypeLibrary();
    this.selectedId = null;
    this.selectedIds.clear();
    this.refreshOriginHelper();
    this.refreshHandles();
    this.rebuildGrid();
    this.rebuildAuthored();
    this.rebuildLines();
    this.rebuildMeasures();
    this.rebuildTexts();
    this.emitElements();
    this.emitStoreys();
    this.callbacks.onGridChanged?.(this.grid);
    this.callbacks.onOriginChanged?.({ ...this.origin });
    this.callbacks.onGeoRefChanged?.({ ...this.geoRef });
    this.callbacks.onSelectionChanged?.(null);
    if (!opts.silent) {
      this.zoomAll();
      this.setStatus(
        `Project geladen: ${this.elements.length} element(en).` +
          (skipped > 0
            ? ` ${skipped} element(en) overgeslagen — template ontbreekt (laad eerst de .o3st/plugin/bibliotheek en open opnieuw).`
            : ""),
      );
    }
  }

  /** Achtergrondkleur van de 3D-omgeving per thema. */
  setTheme(theme: "dark" | "light") {
    this.world.scene.three.background = new THREE.Color(
      theme === "light" ? "#e9e5df" : "#211d1a",
    );
  }

  // ------------------------------------------------------------------ sheets
  async exportSheetPdf(sheet: Sheet, download = true): Promise<number> {
    this.cancelDrawing();
    this.setStatus(`Sheet "${sheet.name}" wordt samengesteld …`);
    try {
      const hide: THREE.Object3D[] = [];
      if (this.gridObject) hide.push(this.gridObject);
      if (this.originHelper) hide.push(this.originHelper);
      const blob = await renderSheetPdf(
        {
          scene: this.world.scene.three,
          contentBox: this.computeContentBox(),
          hide,
          darkenLines: [this.lineGroup, this.measureGroup, this.dxfRoot],
          measures: this.measures,
          projectName: "Open 3D Studio — Storax componenten",
        },
        sheet,
      );
      if (download) {
        const ok = await this.saveAs(blob, `${sheet.number}_${sheet.name.replace(/\s+/g, "-")}.pdf`, {
          name: "PDF",
          extensions: ["pdf"],
        });
        if (!ok) return 0;
      }
      this.setStatus(`Sheet "${sheet.name}" geëxporteerd als PDF (${sheet.format}).`);
      return blob.size;
    } catch (err) {
      console.error(err);
      this.setStatus("Sheet-export mislukt (zie console).");
      return 0;
    }
  }

  // ------------------------------------------------------------------ aanzichten
  async setView(view: ViewName) {
    this.currentView = view;
    const cam: any = this.world.camera;
    const angles: Record<ViewName, [number, number]> = {
      iso: [Math.PI / 4, Math.PI / 3],
      top: [0, 0.02],
      front: [0, Math.PI / 2],
      back: [Math.PI, Math.PI / 2],
      right: [Math.PI / 2, Math.PI / 2],
      left: [-Math.PI / 2, Math.PI / 2],
    };
    const labels: Record<ViewName, string> = {
      iso: "3D (perspectief)",
      top: "bovenaanzicht",
      front: "vooraanzicht",
      back: "achteraanzicht",
      right: "rechteraanzicht",
      left: "linkeraanzicht",
    };
    this.setStatus(`Aanzicht: ${labels[view]}.`);
    try {
      if (view === "iso") {
        await cam.projection.set("Perspective");
        cam.set("Orbit");
      } else {
        await cam.projection.set("Orthographic");
        cam.set("Orbit");
      }
      const [azimuth, polar] = angles[view];
      await cam.controls.rotateTo(azimuth, polar, false);
      await this.zoomAll();
      if (view !== "iso") cam.set("Plan");
    } catch (err) {
      console.error(err);
      this.setStatus("Aanzicht wisselen mislukte (zie console).");
    }
  }

  // ------------------------------------------------------------------ doorsnede
  placeSectionAt(point: THREE.Vector3) {
    const camDir = new THREE.Vector3();
    this.world.camera.three.getWorldDirection(camDir);
    const abs = [Math.abs(camDir.x), Math.abs(camDir.y), Math.abs(camDir.z)];
    const axis = abs.indexOf(Math.max(...abs));
    const normal = new THREE.Vector3(
      axis === 0 ? Math.sign(camDir.x) : 0,
      axis === 1 ? Math.sign(camDir.y) : 0,
      axis === 2 ? Math.sign(camDir.z) : 0,
    );
    const plane = new THREE.Plane(normal, -normal.dot(point));
    const renderer: THREE.WebGLRenderer = this.world.renderer.three;
    renderer.clippingPlanes = [plane];
    renderer.localClippingEnabled = true;

    // ClipEdges: echte 2D-poly-lijnen op het snijvlak (v0.4-S9 productie-slag).
    // Vervangt de stencil-cap-workaround; werkt op alle authored elementen én
    // op de mesh-representatie van geladen IFC-fragments waar mogelijk.
    try {
      this.disposeClipEdges();
      const edges = new ClipEdges(this.components, plane);
      edges.world = this.world;
      edges.visible = true;
      // Amber lijnstyle op de sectie-poly (Construction Amber, dikke lijn)
      edges.items.set("cut", {
        lineMaterial: new THREE.LineBasicMaterial({ color: 0xd97706 }),
        fillMaterial: new THREE.MeshBasicMaterial({ color: 0xf5e6c4, side: THREE.DoubleSide }),
        outlineMaterial: null,
        fillNeedsUpdate: false,
        offset: 0,
      } as any);
      this.clipEdges = edges;
    } catch (err) {
      console.warn("ClipEdges kon niet starten:", err);
    }
    this.setStatus("Doorsnede actief met snijlijnen (amber). Ruim op via 'Doorsnede verwijderen'.");
  }

  clearSection() {
    const renderer: THREE.WebGLRenderer = this.world.renderer.three;
    renderer.clippingPlanes = [];
    this.disposeClipEdges();
    this.setStatus("Doorsnede verwijderd.");
  }

  private disposeClipEdges() {
    if (this.clipEdges) {
      try {
        this.clipEdges.visible = false;
        this.clipEdges.dispose();
      } catch {
        /* al gedispose'd */
      }
      this.clipEdges = null;
    }
  }

  hasSection(): boolean {
    return (this.world?.renderer?.three?.clippingPlanes?.length ?? 0) > 0;
  }

  /** Levert een PNG dataURL-snapshot van de huidige 3D-view (voor sheet-preview). */
  captureViewportPng(): string | null {
    try {
      const renderer: THREE.WebGLRenderer = this.world.renderer.three;
      renderer.render(this.world.scene.three, this.world.camera.three);
      return renderer.domElement.toDataURL("image/png");
    } catch {
      return null;
    }
  }

  // ------------------------------------------------------------------ nulpunt
  setOrigin(origin: ProjectOrigin) {
    this.origin = { ...origin };
    this.refreshOriginHelper();
    this.setStatus(
      `Nulpunt ingesteld op X ${Math.round(origin.x / MM)} / Y ${Math.round(origin.y / MM)} / Z ${Math.round(origin.z / MM)} mm.`,
    );
  }

  private refreshOriginHelper() {
    if (this.originHelper) {
      this.world.scene.three.remove(this.originHelper);
      this.originHelper.dispose();
    }
    this.originHelper = new THREE.AxesHelper(1.2);
    // bouwkundig (x=oost, y=noord, z=hoogte) -> three (x, z-omhoog wordt y, -y)
    this.originHelper.position.set(this.origin.x, this.origin.z, -this.origin.y);
    this.world.scene.three.add(this.originHelper);
  }

  // ------------------------------------------------------------------ verdiepingen
  getActiveStorey(): Storey {
    return this.storeys.find((s) => s.id === this.activeStoreyId) ?? this.storeys[0];
  }

  setActiveStorey(id: string) {
    if (!this.storeys.some((s) => s.id === id)) return;
    this.activeStoreyId = id;
    this.rebuildGrid();
    this.emitStoreys();
    this.setStatus(`Actieve verdieping: ${this.getActiveStorey().name}.`);
  }

  addStorey() {
    this.pushUndo();
    const n = this.storeys.length;
    const top = this.storeys.reduce((m, s) => Math.max(m, s.elevation), 0);
    const name =
      n === 1 ? "01 eerste verdieping" : `${String(n).padStart(2, "0")} verdieping`;
    const storey: Storey = { id: crypto.randomUUID(), name, elevation: top + 3 };
    this.storeys.push(storey);
    this.activeStoreyId = storey.id;
    this.rebuildGrid();
    this.emitStoreys();
  }

  updateStorey(id: string, patch: Partial<Pick<Storey, "name" | "elevation">>) {
    const storey = this.storeys.find((s) => s.id === id);
    if (!storey) return;
    Object.assign(storey, patch);
    if (id === this.activeStoreyId) this.rebuildGrid();
    this.emitStoreys();
  }

  removeStorey(id: string) {
    if (this.storeys.length <= 1) {
      this.setStatus("Minimaal één verdieping is vereist.");
      return;
    }
    this.pushUndo();
    this.storeys = this.storeys.filter((s) => s.id !== id);
    const fallback = this.storeys[0].id;
    if (this.activeStoreyId === id) this.activeStoreyId = fallback;
    for (const el of this.elements) if (el.storeyId === id) el.storeyId = fallback;
    this.rebuildGrid();
    this.emitStoreys();
    this.emitElements();
  }

  private emitStoreys() {
    this.callbacks.onStoreysChanged?.([...this.storeys], this.activeStoreyId);
  }

  // ------------------------------------------------------------------ stramien
  setGrid(grid: GridConfig) {
    this.grid = { ...grid };
    this.rebuildGrid();
    this.callbacks.onGridChanged?.(this.grid);
  }

  private rebuildGrid() {
    for (const child of [...this.gridGroup.children]) {
      this.gridGroup.remove(child);
      disposeGroup(child);
    }
    if (!this.grid.enabled) return;
    const y = this.getActiveStorey().elevation + 0.01;
    const { countX, spacingX, countY, spacingY } = this.grid;
    const lenX = (countX - 1) * spacingX;
    const lenY = (countY - 1) * spacingY;
    const margin = 1.2;
    const material = new THREE.LineDashedMaterial({
      color: 0xd97706,
      dashSize: 0.35,
      gapSize: 0.15,
      transparent: true,
      opacity: 0.8,
    });
    const addLine = (a: THREE.Vector3, b: THREE.Vector3, tag: string) => {
      const geometry = new THREE.BufferGeometry().setFromPoints([a, b]);
      const line = new THREE.Line(geometry, material);
      line.computeLineDistances();
      this.gridGroup.add(line);
      const label = this.makeLabel(tag);
      label.scale.set(0.45, 0.1125, 1);
      label.position.copy(a).add(new THREE.Vector3(0, 0.05, 0));
      this.gridGroup.add(label);
    };
    // assen 1..n: lopen in bouwkundige y-richting (three -z)
    for (let i = 0; i < countX; i++) {
      const x = i * spacingX;
      addLine(
        new THREE.Vector3(x, y, margin),
        new THREE.Vector3(x, y, -lenY - margin),
        String(i + 1),
      );
    }
    // assen A..: lopen in x-richting
    for (let j = 0; j < countY; j++) {
      const z = -j * spacingY;
      addLine(
        new THREE.Vector3(-margin, y, z),
        new THREE.Vector3(lenX + margin, y, z),
        String.fromCharCode(65 + j),
      );
    }
    this.gridGroup.visible = this.layerVisibility.get(LAYER_GRID) !== false;
  }

  /** Snapt een punt naar het dichtstbijzijnde stramiensnijpunt (binnen 20 cm). */
  private snapToGrid(point: THREE.Vector3): THREE.Vector3 {
    if (!this.grid.enabled) return point;
    const { countX, spacingX, countY, spacingY } = this.grid;
    const gx = Math.round(point.x / spacingX) * spacingX;
    const gz = -Math.round(-point.z / spacingY) * spacingY;
    const inX = gx >= -1e-6 && gx <= (countX - 1) * spacingX + 1e-6;
    const inY = -gz >= -1e-6 && -gz <= (countY - 1) * spacingY + 1e-6;
    if (inX && inY && Math.hypot(point.x - gx, point.z - gz) < 0.2) {
      return new THREE.Vector3(gx, point.y, gz);
    }
    return point;
  }

  // ------------------------------------------------------------------ undo/redo
  /** Snapshot vóór een wijziging. `throttle` bundelt snelle reeksen (bv. typen in een
   *  parameterveld) tot één undo-stap; losse handelingen krijgen elk een eigen stap. */
  private pushUndo(throttle = false) {
    const now = Date.now();
    this.redoStack = []; // elke mutatie maakt de redo-geschiedenis ongeldig, ook gethrottlede
    if (throttle && now - this.lastUndoPush < 700 && this.undoStack.length > 0) return;
    this.lastUndoPush = now;
    this.undoStack.push(JSON.stringify(this.serializeProject()));
    if (this.undoStack.length > 50) this.undoStack.shift();
  }

  undo() {
    const snapshot = this.undoStack.pop();
    if (!snapshot) {
      this.setStatus("Niets om ongedaan te maken.");
      return;
    }
    this.redoStack.push(JSON.stringify(this.serializeProject()));
    this.restoreProject(JSON.parse(snapshot), { silent: true });
    this.setStatus("Ongedaan gemaakt.");
  }

  redo() {
    const snapshot = this.redoStack.pop();
    if (!snapshot) {
      this.setStatus("Niets om opnieuw te doen.");
      return;
    }
    this.undoStack.push(JSON.stringify(this.serializeProject()));
    this.restoreProject(JSON.parse(snapshot), { silent: true });
    this.setStatus("Opnieuw gedaan.");
  }

  // ------------------------------------------------------------------ kopiëren & sparing
  copyElement(id: string) {
    const el = this.elements.find((e) => e.id === id);
    if (!el) return;
    this.pushUndo();
    const template = getTemplate(el.templateId);
    const n = (this.elementCounters.get(template.id) ?? 0) + 1;
    this.elementCounters.set(template.id, n);
    // haaks op de wandrichting verplaatsen zodat de kopie zichtbaar naast het origineel ligt
    const dir = el.end.clone().sub(el.start).normalize();
    const offset = new THREE.Vector3(dir.z, 0, -dir.x).multiplyScalar(1);
    const copy: PlacedElement = {
      ...el,
      id: crypto.randomUUID(),
      name: `${template.name} ${String(n).padStart(2, "0")}`,
      start: el.start.clone().add(offset),
      end: el.end.clone().add(offset),
      params: { ...el.params },
      opening: null,
      openings: elementOpenings(el).map((o) => ({ ...o, id: crypto.randomUUID() })),
    };
    this.elements.push(copy);
    this.selectedIds.clear();
    this.selectedIds.add(copy.id);
    this.selectedId = copy.id;
    this.rebuildAuthored();
    this.refreshHandles();
    this.emitElements();
    this.emitSelection();
    this.setStatus(`${copy.name} gekopieerd — versleep hem in de selecteermodus.`);
  }

  getLayers(): { name: string; visible: boolean }[] {
    // Hoofdcategorieën van runtime-templates (.o3st/plugin/IFC-family) verschijnen
    // hier lazily — de constructor kent alleen de build-tijd catalogus.
    for (const t of allRegistryTemplates()) {
      const main = deriveMainCategory(t);
      if (!this.layerVisibility.has(main)) this.layerVisibility.set(main, true);
    }
    return [...this.layerVisibility.entries()].map(([name, visible]) => ({ name, visible }));
  }

  setLayerVisible(name: string, visible: boolean) {
    this.layerVisibility.set(name, visible);
    if (name === LAYER_LINES) this.lineGroup.visible = visible;
    else if (name === LAYER_MEASURES) this.measureGroup.visible = visible;
    else if (name === LAYER_TEXTS) this.textGroup.visible = visible;
    else if (name === LAYER_GRID) this.gridGroup.visible = visible;
    else if (this.dxfGroups.has(name)) this.dxfGroups.get(name)!.visible = visible;
    else this.rebuildAuthored();
    this.emitLayers();
  }

  clearLines() {
    this.lines = [];
    this.rebuildLines();
    this.setStatus("Alle lijnen gewist.");
  }

  clearMeasures() {
    this.measures = [];
    this.rebuildMeasures();
    this.setStatus("Alle maatvoering gewist.");
  }

  clearTexts() {
    this.texts = [];
    this.rebuildTexts();
    this.setStatus("Alle teksten gewist.");
  }

  // ------------------------------------------------------------------ tools
  setTool(tool: ToolName) {
    this.tool = tool;
    this.cancelDrawing();
    const hints: Record<ToolName, string> = {
      select: "Selecteren: klik (Ctrl = toevoegen, Shift+slepen = venster; L→R omsluitend, R→L kruisend).",
      draw: `${getTemplate(this.activeTemplateId).name} tekenen: klik het startpunt (Esc annuleert, snapt op raster/stramien/elementen).`,
      line: "Lijnen tekenen: klik punten achter elkaar (Esc of rechtermuisknop stopt).",
      rect: "Rechthoek: klik twee tegenoverliggende hoekpunten.",
      circle: "Cirkel: klik het middelpunt en daarna een punt op de cirkel.",
      measure: "Meten: klik twee punten.",
      text: "Tekst plaatsen: klik een punt (tekst instelbaar in het zijpaneel).",
      section: "Doorsnede: klik een punt; alles vóór dat punt (t.o.v. de kijkrichting) wordt weggesneden.",
      align: "Uitlijnen: klik eerst het referentie-element, dan het uit te lijnen element.",
      mirror: "Spiegelen: selecteer eerst elementen, klik dan twee punten voor de spiegelas (maakt een kopie).",
      split: "Splitsen: klik op een lijnelement op het splitspunt.",
      opening: "Sparing: klik op een element om daar een sparing te plaatsen.",
      "opening-poly": "Polygoon-sparing: klik hoekpunten op één element; rechtsklik rondt af (min. 3), Esc annuleert.",
      match: "Eigenschappen overnemen: klik het bron-element, daarna de doel-elementen (Esc stopt).",
    };
    this.setStatus(hints[tool]);
  }

  setActiveTemplate(id: string) {
    this.activeTemplateId = id;
    this.currentParams = { ...getTemplate(id).defaults };
    this.cancelDrawing();
    if (this.tool === "draw") {
      this.setStatus(`${getTemplate(id).name} tekenen: klik het startpunt.`);
    }
  }

  setCurrentParams(params: ParamValues) {
    this.currentParams = { ...params };
    if (this.drawStart && this.previewGroup) this.refreshPreviewTo(this.lastMovePoint);
  }

  getElements() {
    return this.elements;
  }

  getSelectedElement(): PlacedElement | null {
    return this.elements.find((e) => e.id === this.selectedId) ?? null;
  }

  selectElement(id: string | null, opts: { additive?: boolean } = {}) {
    if (id === null) {
      this.selectedIds.clear();
      this.selectedId = null;
    } else if (opts.additive) {
      // Ctrl-klik: toggle in de selectie; anchor = laatst aangeklikt (of ander lid)
      if (this.selectedIds.has(id)) {
        this.selectedIds.delete(id);
        if (this.selectedId === id) this.selectedId = [...this.selectedIds].pop() ?? null;
      } else {
        this.selectedIds.add(id);
        this.selectedId = id;
      }
    } else {
      this.selectedIds.clear();
      this.selectedIds.add(id);
      this.selectedId = id;
    }
    this.rebuildAuthored();
    this.refreshHandles();
    this.emitSelection();
  }

  /** v0.7-S1: meerdere elementen in één keer selecteren (venster-selectie). */
  selectMany(ids: string[], opts: { additive?: boolean } = {}) {
    if (!opts.additive) this.selectedIds.clear();
    for (const id of ids) this.selectedIds.add(id);
    this.selectedId = ids[ids.length - 1] ?? this.selectedId ?? null;
    if (this.selectedId && !this.selectedIds.has(this.selectedId)) {
      this.selectedId = [...this.selectedIds].pop() ?? null;
    }
    this.rebuildAuthored();
    this.refreshHandles();
    this.emitSelection();
  }

  getSelectedIds(): string[] {
    return [...this.selectedIds];
  }

  private emitSelection() {
    this.callbacks.onSelectionChanged?.(this.selectedId);
    this.callbacks.onSelectionSetChanged?.([...this.selectedIds]);
  }

  // ------------------------------------------------------------------ v0.7-S1: klembord
  private static CLIPBOARD_KEY = "o3s-clipboard";

  /** Kopieer de selectie naar het klembord (localStorage: werkt cross-project). */
  copySelection(): number {
    const els = this.elements.filter((e) => this.selectedIds.has(e.id));
    if (els.length === 0) return 0;
    const v = (p: THREE.Vector3) => [p.x, p.y, p.z];
    const payload = els.map((e) => ({
      templateId: e.templateId,
      name: e.name,
      start: v(e.start),
      end: v(e.end),
      params: { ...e.params },
      openings: elementOpenings(e).map((o) => ({ ...o, id: undefined })),
      phase: e.phase,
      typeId: e.typeId,
    }));
    try {
      localStorage.setItem(Studio.CLIPBOARD_KEY, JSON.stringify(payload));
    } catch {
      /* localStorage vol/uit — klembord werkt dan alleen niet cross-project */
    }
    this.setStatus(`${els.length} element(en) gekopieerd.`);
    return els.length;
  }

  /** Knip: kopieer + verwijder. */
  cutSelection(): number {
    const n = this.copySelection();
    if (n > 0) this.removeSelected();
    return n;
  }

  /** Plak het klembord: nieuwe ids/namen, kleine offset, plaksel wordt de selectie.
   *  Nogmaals plakken verschuift opnieuw — zo stapelen kopieën niet. */
  paste(): number {
    let payload: any[];
    try {
      payload = JSON.parse(localStorage.getItem(Studio.CLIPBOARD_KEY) ?? "[]");
    } catch {
      payload = [];
    }
    if (!Array.isArray(payload) || payload.length === 0) {
      this.setStatus("Klembord is leeg.");
      return 0;
    }
    this.pushUndo();
    const v = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2]);
    const offset = new THREE.Vector3(0.5, 0, 0.5);
    const newIds: string[] = [];
    for (const d of payload) {
      let template;
      try {
        template = getTemplate(d.templateId);
      } catch {
        continue;
      }
      const n = (this.elementCounters.get(template.id) ?? 0) + 1;
      this.elementCounters.set(template.id, n);
      const el: PlacedElement = {
        id: crypto.randomUUID(),
        templateId: d.templateId,
        name: `${template.name} ${String(n).padStart(2, "0")}`,
        start: v(d.start).add(offset),
        end: v(d.end).add(offset),
        params: { ...d.params },
        storeyId: this.activeStoreyId,
        opening: null,
        openings: (d.openings ?? []).map((o: any) => ({ ...o, id: crypto.randomUUID() })),
        phase: d.phase ?? "new",
        typeId: d.typeId,
      };
      this.elements.push(el);
      newIds.push(el.id);
    }
    this.rebuildAuthored();
    this.emitElements();
    this.selectMany(newIds);
    this.setStatus(`${newIds.length} element(en) geplakt — versleep ze of plak nogmaals.`);
    return newIds.length;
  }

  /** Verwijder de volledige selectie in één undo-stap. */
  removeSelected() {
    if (this.selectedIds.size === 0) return;
    this.pushUndo();
    const doomed = new Set(this.selectedIds);
    // kozijn-gekoppelde sparingen in hosts opruimen + joins die eraan hangen
    for (const el of this.elements) {
      if (el.openings) el.openings = el.openings.filter((o) => !o.id || !doomed.has(o.id));
    }
    this.joins = this.joins.filter((j) => !doomed.has(j.aId) && !doomed.has(j.bId));
    this.elements = this.elements.filter((e) => !doomed.has(e.id));
    this.selectedIds.clear();
    this.selectedId = null;
    this.rebuildAuthored();
    this.refreshHandles();
    this.emitElements();
    this.emitSelection();
    this.setStatus(`${doomed.size} element(en) verwijderd.`);
  }

  // ------------------------------------------------------------------ v0.7-S2: snapping
  /** Snap `point` op endpoints/midpoints van bestaande lijnelementen (0,25 m
   *  zoekradius). Element-snap wint van raster-snap. Toont een amber marker. */
  private snapToElements(point: THREE.Vector3, excludeIds: Set<string> = new Set()): THREE.Vector3 {
    const TOL = 0.25;
    let best: { p: THREE.Vector3; d: number } | null = null;
    for (const el of this.elements) {
      if (excludeIds.has(el.id)) continue;
      const candidates = [
        el.start,
        el.end,
        el.start.clone().lerp(el.end, 0.5),
      ];
      for (const c of candidates) {
        const d = Math.hypot(point.x - c.x, point.z - c.z);
        if (d < TOL && (!best || d < best.d)) best = { p: c.clone(), d };
      }
    }
    if (best) {
      const snapped = best.p.clone();
      snapped.y = point.y; // peil van het tekenvlak behouden
      this.showSnapMarker(snapped);
      return snapped;
    }
    this.hideSnapMarker();
    return point;
  }

  private showSnapMarker(p: THREE.Vector3) {
    if (!this.snapMarker) {
      this.snapMarker = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.12, 0.12),
        new THREE.MeshBasicMaterial({ color: 0xd97706, depthTest: false }),
      );
      this.snapMarker.renderOrder = 10;
      this.handleGroup.add(this.snapMarker);
    }
    this.snapMarker.position.copy(p);
    this.snapMarker.visible = true;
  }

  private hideSnapMarker() {
    if (this.snapMarker) this.snapMarker.visible = false;
  }

  // ------------------------------------------------------------------ v0.7-S2: eind-handles
  /** Toon bolvormige handles op start/end van het (enige) geselecteerde lijnelement. */
  private refreshHandles() {
    for (const child of [...this.handleGroup.children]) {
      if (child === this.snapMarker) continue;
      this.handleGroup.remove(child);
      disposeGroup(child);
    }
    if (this.selectedIds.size !== 1 || !this.selectedId) return;
    const el = this.elements.find((e) => e.id === this.selectedId);
    if (!el) return;
    const template = getTemplate(el.templateId);
    if (template.placementKind === "point") return;
    for (const which of ["start", "end"] as const) {
      const handle = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xd97706, depthTest: false }),
      );
      handle.renderOrder = 11;
      handle.position.copy(el[which]);
      handle.userData.handleFor = el.id;
      handle.userData.handleWhich = which;
      this.handleGroup.add(handle);
    }
  }

  // ------------------------------------------------------------------ v0.7-S2: uitlijnen/spiegelen/reeks/offset
  /** Lijn `moveId` uit op de as van `refId`: verschuift haaks tot de assen samenvallen.
   *  Alleen voor (nagenoeg) evenwijdige elementen. */
  alignToElement(refId: string, moveId: string): boolean {
    const ref = this.elements.find((e) => e.id === refId);
    const mv = this.elements.find((e) => e.id === moveId);
    if (!ref || !mv || refId === moveId) return false;
    const rd = new THREE.Vector2(ref.end.x - ref.start.x, ref.end.z - ref.start.z).normalize();
    const md = new THREE.Vector2(mv.end.x - mv.start.x, mv.end.z - mv.start.z).normalize();
    const cross = Math.abs(rd.x * md.y - rd.y * md.x);
    if (cross > 0.09) {
      this.setStatus("Uitlijnen: elementen zijn niet evenwijdig (±5°).");
      return false;
    }
    // haakse afstand van mv.start tot de referentie-as
    const rel = new THREE.Vector2(mv.start.x - ref.start.x, mv.start.z - ref.start.z);
    const across = rel.x * rd.y - rel.y * rd.x; // signed
    const shift = new THREE.Vector3(-rd.y * -across, 0, rd.x * -across);
    this.pushUndo();
    mv.start.add(shift);
    mv.end.add(shift);
    this.resolveJoins(mv.id);
    this.rebuildAuthored();
    this.refreshHandles();
    this.emitElements();
    this.setStatus(`${mv.name} uitgelijnd op ${ref.name} (${Math.abs(across * 1000).toFixed(0)} mm verschoven).`);
    return true;
  }

  /** Spiegel de selectie over de as p1→p2 (bovenaanzicht). Kopie = Revit-default. */
  mirrorSelection(p1: THREE.Vector3, p2: THREE.Vector3, copy = true) {
    const els = this.elements.filter((e) => this.selectedIds.has(e.id));
    if (els.length === 0) return;
    const d = new THREE.Vector2(p2.x - p1.x, p2.z - p1.z);
    if (d.lengthSq() < 1e-9) return;
    d.normalize();
    const reflect = (p: THREE.Vector3): THREE.Vector3 => {
      const rel = new THREE.Vector2(p.x - p1.x, p.z - p1.z);
      const along = rel.x * d.x + rel.y * d.y;
      const proj = new THREE.Vector2(d.x * along, d.y * along);
      const mirrored = new THREE.Vector2(2 * proj.x - rel.x, 2 * proj.y - rel.y);
      return new THREE.Vector3(p1.x + mirrored.x, p.y, p1.z + mirrored.y);
    };
    this.pushUndo();
    const newIds: string[] = [];
    for (const el of els) {
      if (copy) {
        const template = getTemplate(el.templateId);
        const n = (this.elementCounters.get(template.id) ?? 0) + 1;
        this.elementCounters.set(template.id, n);
        const dup: PlacedElement = {
          ...el,
          id: crypto.randomUUID(),
          name: `${template.name} ${String(n).padStart(2, "0")}`,
          start: reflect(el.end), // start/end wisselen zodat de as-richting spiegelt
          end: reflect(el.start),
          params: { ...el.params },
          opening: null,
          openings: elementOpenings(el).map((o) => ({ ...o, id: crypto.randomUUID() })),
        };
        this.elements.push(dup);
        newIds.push(dup.id);
      } else {
        const ns = reflect(el.end);
        const ne = reflect(el.start);
        el.start.copy(ns);
        el.end.copy(ne);
      }
    }
    this.rebuildAuthored();
    this.emitElements();
    if (copy) this.selectMany(newIds);
    this.setStatus(`${els.length} element(en) gespiegeld${copy ? " (kopie)" : ""}.`);
  }

  /** Reeks: n kopieën van de selectie, h.o.h. langs de as van het primaire element. */
  arraySelection(count: number, spacingMm: number) {
    const els = this.elements.filter((e) => this.selectedIds.has(e.id));
    const primary = this.elements.find((e) => e.id === this.selectedId) ?? els[0];
    if (!primary || els.length === 0 || count < 1) return;
    let dir = new THREE.Vector3(primary.end.x - primary.start.x, 0, primary.end.z - primary.start.z);
    if (dir.lengthSq() < 1e-9) dir = new THREE.Vector3(1, 0, 0);
    dir.normalize();
    // haaks op de as — een reeks wanden naast elkaar is het normale geval
    const step = new THREE.Vector3(dir.z, 0, -dir.x).multiplyScalar(spacingMm / 1000);
    this.pushUndo();
    const newIds: string[] = [];
    for (let i = 1; i <= count; i++) {
      for (const el of els) {
        const template = getTemplate(el.templateId);
        const n = (this.elementCounters.get(template.id) ?? 0) + 1;
        this.elementCounters.set(template.id, n);
        const dup: PlacedElement = {
          ...el,
          id: crypto.randomUUID(),
          name: `${template.name} ${String(n).padStart(2, "0")}`,
          start: el.start.clone().addScaledVector(step, i),
          end: el.end.clone().addScaledVector(step, i),
          params: { ...el.params },
          opening: null,
          openings: elementOpenings(el).map((o) => ({ ...o, id: crypto.randomUUID() })),
        };
        this.elements.push(dup);
        newIds.push(dup.id);
      }
    }
    this.rebuildAuthored();
    this.emitElements();
    this.selectMany(newIds);
    this.setStatus(`Reeks geplaatst: ${count} × ${els.length} element(en), h.o.h. ${spacingMm} mm.`);
  }

  /** Offset: evenwijdige kopie van de selectie op afstand (haaks op elk element). */
  offsetSelection(distanceMm: number) {
    this.arraySelection(1, distanceMm);
  }

  // ------------------------------------------------------------------ v0.7-S3: joins
  /** Zoek na een eindpunt-wijziging een verbindingspartner: eindpunt-op-eindpunt (L)
   *  of eindpunt-op-lijf (T). Maakt de join en trekt het eindpunt exact op maat. */
  private autoJoinAt(el: PlacedElement, which: "start" | "end") {
    const TOL = 0.15;
    const p = el[which];
    for (const other of this.elements) {
      if (other.id === el.id) continue;
      const otherTemplate = getTemplate(other.templateId);
      if (otherTemplate.placementKind === "point" || otherTemplate.placementKind === "surface") continue;
      // al verbonden op dit eindpunt?
      if (this.joins.some((j) => (j.aId === el.id && j.aEnd === which) )) return;
      for (const oWhich of ["start", "end"] as const) {
        if (p.distanceTo(other[oWhich]) < TOL) {
          p.copy(other[oWhich]); // exact samenvallen (L)
          this.joins.push({ id: crypto.randomUUID(), aId: el.id, aEnd: which, bId: other.id, bEnd: oWhich });
          this.setStatus(`Hoekverbinding gemaakt: ${el.name} ↔ ${other.name}.`);
          return;
        }
      }
      // T-verbinding: eindpunt op het lijf van de ander
      const dx = other.end.x - other.start.x;
      const dz = other.end.z - other.start.z;
      const len = Math.hypot(dx, dz);
      if (len < 1e-6) continue;
      const ux = dx / len, uz = dz / len;
      const rx = p.x - other.start.x, rz = p.z - other.start.z;
      const along = rx * ux + rz * uz;
      const across = Math.abs(rx * uz - rz * ux);
      if (along > TOL && along < len - TOL && across < TOL) {
        p.set(other.start.x + ux * along, p.y, other.start.z + uz * along); // projecteer op as
        this.joins.push({ id: crypto.randomUUID(), aId: el.id, aEnd: which, bId: other.id, bEnd: "path" });
        this.setStatus(`T-verbinding gemaakt: ${el.name} ⊥ ${other.name}.`);
        return;
      }
    }
  }

  /** Meebewegende joins: als `movedId` is verplaatst, trek verbonden eindpunten bij.
   *  v0.8: L-verbindingen bij ~90° krijgen een stompe hoekaansluiting (butt joint):
   *  de doorlopende wand (b) steekt de halve dikte van de aansluitende wand (a)
   *  vóórbij het assnijpunt, de aansluitende wand stopt op het lijf van de
   *  doorlopende — geen dubbel volume meer op de hoek. */
  private resolveJoins(movedId: string) {
    const axisOf = (el: PlacedElement, joinedEnd: "start" | "end") => {
      const o = el[joinedEnd === "start" ? "end" : "start"]; // vaste (niet-verbonden) kant
      const p = el[joinedEnd];
      const dx = p.x - o.x, dz = p.z - o.z;
      const len = Math.hypot(dx, dz);
      return len < 1e-6 ? null : { o, ux: dx / len, uz: dz / len };
    };
    const depthOf = (el: PlacedElement) => {
      try {
        return getTemplate(el.templateId).depth(el.params);
      } catch {
        return 0;
      }
    };
    for (const j of this.joins) {
      const a = this.elements.find((e) => e.id === j.aId);
      const b = this.elements.find((e) => e.id === j.bId);
      if (!a || !b) continue;
      if (j.bEnd === "path") {
        // T: a's eindpunt stopt op het lijf van b (halve dikte vóór de as)
        const dx = b.end.x - b.start.x, dz = b.end.z - b.start.z;
        const len = Math.hypot(dx, dz);
        if (len < 1e-6) continue;
        const ux = dx / len, uz = dz / len;
        const p = a[j.aEnd];
        const along = Math.max(0, Math.min(len, (p.x - b.start.x) * ux + (p.z - b.start.z) * uz));
        const onAxis = { x: b.start.x + ux * along, z: b.start.z + uz * along };
        const aAxis = axisOf(a, j.aEnd);
        const setback = depthOf(b) / 2;
        if (aAxis && setback > 0.001) {
          p.set(onAxis.x - aAxis.ux * setback, p.y, onAxis.z - aAxis.uz * setback);
        } else {
          p.set(onAxis.x, p.y, onAxis.z);
        }
        continue;
      }
      // L-verbinding: assnijpunt bepalen uit beide (oneindige) assen
      const aAxis = axisOf(a, j.aEnd);
      const bAxis = axisOf(b, j.bEnd as "start" | "end");
      if (!aAxis || !bAxis) continue;
      const cross = aAxis.ux * bAxis.uz - aAxis.uz * bAxis.ux;
      if (Math.abs(cross) < 0.09) {
        // (bijna) evenwijdig: geen snijpunt — volger kopieert de ander
        if (j.aId === movedId) {
          b[j.bEnd as "start" | "end"].x = a[j.aEnd].x;
          b[j.bEnd as "start" | "end"].z = a[j.aEnd].z;
        } else {
          a[j.aEnd].x = b[j.bEnd as "start" | "end"].x;
          a[j.aEnd].z = b[j.bEnd as "start" | "end"].z;
        }
        continue;
      }
      // snijpunt P: a.o + t·ua = b.o + s·ub
      const rx = bAxis.o.x - aAxis.o.x;
      const rz = bAxis.o.z - aAxis.o.z;
      const t = (rx * bAxis.uz - rz * bAxis.ux) / cross;
      const P = { x: aAxis.o.x + aAxis.ux * t, z: aAxis.o.z + aAxis.uz * t };
      const angle = Math.abs((Math.atan2(cross, aAxis.ux * bAxis.ux + aAxis.uz * bAxis.uz) * 180) / Math.PI);
      const haaks = angle > 75 && angle < 105;
      const dA = depthOf(a);
      const dB = depthOf(b);
      if (haaks && dA > 0.001 && dB > 0.001) {
        // butt joint: b (doorlopend) steekt dA/2 voorbij P, a stopt dB/2 vóór P
        b[j.bEnd as "start" | "end"].set(P.x + bAxis.ux * (dA / 2), b[j.bEnd as "start" | "end"].y, P.z + bAxis.uz * (dA / 2));
        a[j.aEnd].set(P.x - aAxis.ux * (dB / 2), a[j.aEnd].y, P.z - aAxis.uz * (dB / 2));
      } else {
        // scheve hoek: eindpunten samen op het assnijpunt
        a[j.aEnd].set(P.x, a[j.aEnd].y, P.z);
        b[j.bEnd as "start" | "end"].set(P.x, b[j.bEnd as "start" | "end"].y, P.z);
      }
    }
  }

  /** Verbreek alle verbindingen van een element. */
  unjoinElement(id: string) {
    const before = this.joins.length;
    this.joins = this.joins.filter((j) => j.aId !== id && j.bId !== id);
    if (this.joins.length < before) {
      this.setStatus(`${before - this.joins.length} verbinding(en) verbroken.`);
      this.emitElements();
    } else {
      this.setStatus("Geen verbindingen op dit element.");
    }
  }

  /** Splits een lijnelement op een punt langs zijn as. */
  splitElementAt(id: string, point: THREE.Vector3) {
    const el = this.elements.find((e) => e.id === id);
    if (!el) return;
    const template = getTemplate(el.templateId);
    if (template.placementKind === "point" || template.placementKind === "surface") {
      this.setStatus("Splitsen werkt alleen op lijnvormige elementen.");
      return;
    }
    const dx = el.end.x - el.start.x, dz = el.end.z - el.start.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.2) return;
    const ux = dx / len, uz = dz / len;
    const along = Math.max(0.05, Math.min(len - 0.05, (point.x - el.start.x) * ux + (point.z - el.start.z) * uz));
    const splitPoint = new THREE.Vector3(el.start.x + ux * along, el.start.y, el.start.z + uz * along);
    this.pushUndo();
    const n = (this.elementCounters.get(template.id) ?? 0) + 1;
    this.elementCounters.set(template.id, n);
    const second: PlacedElement = {
      ...el,
      id: crypto.randomUUID(),
      name: `${template.name} ${String(n).padStart(2, "0")}`,
      start: splitPoint.clone(),
      end: el.end.clone(),
      params: { ...el.params },
      opening: null,
      // sparingen verdelen op positie; xPos hermeten vanaf het nieuwe startpunt
      openings: elementOpenings(el)
        .filter((o) => o.xPos > along)
        .map((o) => ({ ...o, xPos: o.xPos - along })),
    };
    el.openings = elementOpenings(el).filter((o) => o.xPos <= along);
    el.opening = null;
    el.end.copy(splitPoint);
    // joins op het oude eindpunt verhuizen naar het tweede deel
    for (const j of this.joins) {
      if (j.aId === el.id && j.aEnd === "end") j.aId = second.id;
      if (j.bId === el.id && j.bEnd === "end") j.bId = second.id;
    }
    this.elements.push(second);
    this.rebuildAuthored();
    this.refreshHandles();
    this.emitElements();
    this.setStatus(`${el.name} gesplitst op ${(along * 1000).toFixed(0)} mm.`);
  }

  // ------------------------------------------------------------------ v0.7-S4: openingen
  /** Sparing toevoegen op een wereldpunt op het element (sparingstool). */
  addOpeningAt(elementId: string, point: THREE.Vector3) {
    const el = this.elements.find((e) => e.id === elementId);
    if (!el) return;
    const template = getTemplate(el.templateId);
    const dx = el.end.x - el.start.x, dz = el.end.z - el.start.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) return;
    const ux = dx / len, uz = dz / len;
    const along = Math.max(0, Math.min(len, (point.x - el.start.x) * ux + (point.z - el.start.z) * uz));
    this.pushUndo();
    const isPlan = template.placementKind === "surface";
    const opening: Opening = isPlan
      ? {
          id: crypto.randomUUID(), shape: "rect", kind: "vrij",
          xPos: along,
          yPos: -((point.x - el.start.x) * uz - (point.z - el.start.z) * ux),
          breedte: 0.8, hoogte: 0.8,
        }
      : { id: crypto.randomUUID(), shape: "rect", kind: "vrij", xPos: along, breedte: 0.9, hoogte: 2.1, zBottom: 0 };
    el.openings = [...elementOpenings(el), opening];
    el.opening = null;
    this.rebuildAuthored();
    this.emitElements();
    this.setStatus(`Sparing geplaatst op ${(along * 1000).toFixed(0)} mm — pas maat/vorm aan in het zijpaneel.`);
  }

  updateOpening(elementId: string, openingId: string, patch: Partial<Opening>) {
    const el = this.elements.find((e) => e.id === elementId);
    if (!el) return;
    this.pushUndo(true);
    el.openings = elementOpenings(el).map((o) => (o.id === openingId ? { ...o, ...patch } : o));
    el.opening = null;
    this.rebuildAuthored();
    this.emitElements();
  }

  removeOpening(elementId: string, openingId: string) {
    const el = this.elements.find((e) => e.id === elementId);
    if (!el) return;
    this.pushUndo();
    el.openings = elementOpenings(el).filter((o) => o.id !== openingId);
    el.opening = null;
    this.rebuildAuthored();
    this.emitElements();
  }

  // ------------------------------------------------------------------ v0.7-S5: typen
  private static TYPE_LIBRARY_KEY = "o3s-type-library";

  private mergeUserTypeLibrary() {
    try {
      const lib: TypeDefinition[] = JSON.parse(localStorage.getItem(Studio.TYPE_LIBRARY_KEY) ?? "[]");
      for (const t of lib) {
        if (this.types.some((x) => x.id === t.id)) continue;
        try {
          getTemplate(t.templateId);
          this.types.push(t);
        } catch {
          /* template niet aanwezig in deze installatie */
        }
      }
    } catch {
      /* corrupte bibliotheek — negeren */
    }
  }

  private persistUserTypeLibrary() {
    try {
      localStorage.setItem(Studio.TYPE_LIBRARY_KEY, JSON.stringify(this.types));
    } catch {
      /* localStorage vol — typen blijven wel in het project */
    }
  }

  /** Maak een benoemd type van een element (of van de actieve teken-instellingen). */
  saveAsType(name: string, fromElementId?: string): TypeDefinition {
    const el = fromElementId ? this.elements.find((e) => e.id === fromElementId) : null;
    const templateId = el?.templateId ?? this.activeTemplateId;
    const params = { ...(el?.params ?? this.currentParams) };
    delete (params as Record<string, unknown>).basisHoogte; // instantie-param, geen type-param
    const type: TypeDefinition = { id: crypto.randomUUID(), name, templateId, typeParams: params };
    this.types.push(type);
    if (el) el.typeId = type.id;
    this.persistUserTypeLibrary();
    this.callbacks.onTypesChanged?.([...this.types]);
    this.setStatus(`Type "${name}" opgeslagen.`);
    return type;
  }

  duplicateType(typeId: string, newName: string): TypeDefinition | null {
    const src = this.types.find((t) => t.id === typeId);
    if (!src) return null;
    const dup: TypeDefinition = {
      id: crypto.randomUUID(),
      name: newName,
      templateId: src.templateId,
      typeParams: { ...src.typeParams },
    };
    this.types.push(dup);
    this.persistUserTypeLibrary();
    this.callbacks.onTypesChanged?.([...this.types]);
    return dup;
  }

  removeType(typeId: string) {
    this.types = this.types.filter((t) => t.id !== typeId);
    for (const el of this.elements) if (el.typeId === typeId) el.typeId = undefined;
    this.persistUserTypeLibrary();
    this.callbacks.onTypesChanged?.([...this.types]);
  }

  /** Pas een type toe op elementen (zelfde template vereist). */
  applyType(typeId: string, elementIds: string[]): number {
    const type = this.types.find((t) => t.id === typeId);
    if (!type) return 0;
    this.pushUndo();
    let n = 0;
    for (const id of elementIds) {
      const el = this.elements.find((e) => e.id === id);
      if (!el || el.templateId !== type.templateId) continue;
      el.params = { ...el.params, ...type.typeParams };
      el.typeId = type.id;
      n++;
    }
    if (n > 0) {
      this.rebuildAuthored();
      this.emitElements();
    }
    this.setStatus(`Type "${type.name}" toegepast op ${n} element(en).`);
    return n;
  }

  /** Wijzig type-parameters — werkt door op álle instanties van het type. */
  updateType(typeId: string, typeParams: ParamValues): number {
    const type = this.types.find((t) => t.id === typeId);
    if (!type) return 0;
    this.pushUndo();
    type.typeParams = { ...typeParams };
    let n = 0;
    for (const el of this.elements) {
      if (el.typeId !== typeId) continue;
      el.params = { ...el.params, ...typeParams };
      n++;
    }
    this.persistUserTypeLibrary();
    this.callbacks.onTypesChanged?.([...this.types]);
    if (n > 0) {
      this.rebuildAuthored();
      this.emitElements();
    }
    this.setStatus(`Type "${type.name}" bijgewerkt — ${n} instantie(s) volgen mee.`);
    return n;
  }

  /** Activeer een type voor plaatsing: template + params volgen het type. */
  setActiveType(typeId: string | null) {
    this.activeTypeId = typeId;
    if (!typeId) return;
    const type = this.types.find((t) => t.id === typeId);
    if (!type) return;
    this.setActiveTemplate(type.templateId);
    this.currentParams = { ...getTemplate(type.templateId).defaults, ...type.typeParams };
  }

  updateElementParams(id: string, params: ParamValues) {
    const el = this.elements.find((e) => e.id === id);
    if (!el) return;
    this.pushUndo(true);
    el.params = { ...params };
    this.rebuildAuthored();
    this.emitElements();
  }

  /** Draait een element om zijn startpunt (graden, positief = tegen de klok in, bovenaanzicht). */
  rotateElement(id: string, deltaDeg: number) {
    const el = this.elements.find((e) => e.id === id);
    if (!el) return;
    this.pushUndo();
    const angle = (deltaDeg * Math.PI) / 180;
    const dx = el.end.x - el.start.x;
    const dz = el.end.z - el.start.z;
    // rotatie in het XZ-vlak (bovenaanzicht), tegen de klok in bij positieve hoek
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    el.end.x = el.start.x + dx * cos + dz * sin;
    el.end.z = el.start.z - dx * sin + dz * cos;
    this.resolveJoins(el.id);
    this.rebuildAuthored();
    this.refreshHandles();
    this.emitElements();
    this.setStatus(`${el.name} gedraaid (${deltaDeg > 0 ? "+" : ""}${deltaDeg}°).`);
  }

  /** Past de lengte van een element aan langs de huidige richting (mm). */
  setElementLength(id: string, lengthMm: number) {
    const el = this.elements.find((e) => e.id === id);
    if (!el) return;
    this.pushUndo(true);
    const dx = el.end.x - el.start.x;
    const dz = el.end.z - el.start.z;
    const current = Math.hypot(dx, dz);
    if (current < 1e-6 || lengthMm < 50) return;
    const f = (lengthMm * MM) / current;
    el.end.x = el.start.x + dx * f;
    el.end.z = el.start.z + dz * f;
    this.resolveJoins(el.id);
    this.rebuildAuthored();
    this.refreshHandles();
    this.emitElements();
  }

  /** Zet de bouwkundige fase (bestaand/nieuw/sloop/tijdelijk) op één element. */
  setElementPhase(id: string, phase: import("./types").ElementPhase) {
    const el = this.elements.find((e) => e.id === id);
    if (!el) return;
    this.pushUndo();
    el.phase = phase;
    this.rebuildAuthored();
    this.emitElements();
  }

  /** v0.5-S7: fase-view-instellingen wijzigen (zichtbaarheid + graphic overrides).
   *  Werkt direct door in de 3D-view én in export van sheets. */
  setPhaseSettings(patch: Partial<PhaseSettings>) {
    this.phaseSettings = {
      visible: { ...this.phaseSettings.visible, ...(patch.visible ?? {}) },
      color: { ...this.phaseSettings.color, ...(patch.color ?? {}) },
      opacity: { ...this.phaseSettings.opacity, ...(patch.opacity ?? {}) },
      wireframe: { ...this.phaseSettings.wireframe, ...(patch.wireframe ?? {}) },
    };
    this.rebuildAuthored();
    this.callbacks.onPhaseSettingsChanged?.(this.phaseSettings);
  }

  removeElement(id: string) {
    this.pushUndo();
    this.elements = this.elements.filter((e) => e.id !== id);
    // gekoppelde host-sparingen (kozijn weg → gat dicht) en joins opruimen
    for (const el of this.elements) {
      if (el.openings) el.openings = el.openings.filter((o) => o.id !== id);
    }
    this.joins = this.joins.filter((j) => j.aId !== id && j.bId !== id);
    this.selectedIds.delete(id);
    if (this.selectedId === id) this.selectedId = [...this.selectedIds].pop() ?? null;
    this.rebuildAuthored();
    this.refreshHandles();
    this.emitElements();
    this.emitSelection();
  }

  private computeContentBox(): THREE.Box3 {
    const box = new THREE.Box3();
    for (const child of this.world.scene.three.children) {
      if (child === this.gridObject || child === this.originHelper) continue;
      if (child === this.authoredGroup && this.elements.length === 0) continue;
      if ((child as any).isLight) continue;
      try {
        const childBox = new THREE.Box3().setFromObject(child);
        if (!childBox.isEmpty() && isFinite(childBox.min.x) && isFinite(childBox.max.x)) {
          box.union(childBox);
        }
      } catch {
        /* sommige hulpobjecten hebben geen geometrie */
      }
    }
    return box;
  }

  async zoomAll() {
    const box = this.computeContentBox();
    if (box.isEmpty()) return;
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    if (sphere.radius > 0.001 && isFinite(sphere.radius)) {
      await this.world.camera.controls.fitToSphere(sphere, true);
    }
  }

  // ------------------------------------------------------------------ muisafhandeling
  private bindPointerEvents() {
    const dom: HTMLElement = this.world.renderer.three.domElement;

    dom.addEventListener("pointerdown", (e: PointerEvent) => {
      if (e.button !== 0) return;
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
      // pointer-capture: pointermove/up worden altijd naar `dom` gerouteerd, ook als de
      // cursor tijdens het slepen buiten het canvas beweegt. Dat maakt de e.target-check
      // op pointerup betrouwbaar (voorheen kon een HTML-overlay de klik "opeten").
      try {
        dom.setPointerCapture(e.pointerId);
      } catch {
        /* oudere browsers zonder pointer capture — negeren */
      }
      // v0.7-S2: eind-handle aangeklikt? Die wint van element-drag.
      if (this.tool === "select") {
        const handleHit = this.raycastGroups(e, [this.handleGroup]);
        const handleObj = handleHit?.object;
        if (handleObj?.userData.handleFor) {
          this.handleDrag = {
            elementId: handleObj.userData.handleFor,
            which: handleObj.userData.handleWhich,
            moved: false,
          };
          this.world.camera.controls.enabled = false;
          return;
        }
      }
      // v0.7-S1: Shift+drag = venster-selectie
      if (this.tool === "select" && e.shiftKey) {
        const rect = dom.getBoundingClientRect();
        this.marquee = {
          x0: e.clientX - rect.left, y0: e.clientY - rect.top,
          x1: e.clientX - rect.left, y1: e.clientY - rect.top,
        };
        this.world.camera.controls.enabled = false;
        return;
      }
      // verslepen: in selecteermodus met de muis op het geselecteerde element
      if (this.tool === "select" && this.selectedId) {
        const hit = this.raycastGroups(e, [this.authoredGroup]);
        let obj: THREE.Object3D | null = hit?.object ?? null;
        while (obj && !obj.userData.elementId) obj = obj.parent;
        if (obj?.userData.elementId === this.selectedId) {
          this.dragging = true;
          this.dragMoved = false; // undo-stap pas bij echte verplaatsing
          const el = this.elements.find((el) => el.id === this.selectedId);
          this.dragPlaneY = el?.start.y ?? hit!.point.y;
          this.dragLast = this.dragPoint(e);
          this.world.camera.controls.enabled = false;
        }
      }
    });

    // luisteren op het canvas: door setPointerCapture komen alle up-events hier binnen,
    // ook als de cursor buiten het canvas is losgelaten.
    dom.addEventListener("pointerup", (e: PointerEvent) => {
      if (e.button !== 0) return;
      try {
        dom.releasePointerCapture(e.pointerId);
      } catch {
        /* al vrijgegeven — negeren */
      }
      // v0.7-S2: eind-handle losgelaten → auto-join proberen op de nieuwe positie
      if (this.handleDrag) {
        const drag = this.handleDrag;
        this.handleDrag = null;
        this.world.camera.controls.enabled = true;
        this.pointerDownPos = null;
        this.hideSnapMarker();
        if (drag.moved) {
          const el = this.elements.find((el) => el.id === drag.elementId);
          if (el) {
            this.unjoinEndpoint(el.id, drag.which);
            this.autoJoinAt(el, drag.which);
            this.resolveJoins(el.id);
            this.rebuildAuthored();
            this.refreshHandles();
          }
          this.emitElements();
          this.setStatus("Eindpunt verplaatst.");
        }
        return;
      }
      // v0.7-S1: venster-selectie afronden
      if (this.marquee) {
        const m = this.marquee;
        this.marquee = null;
        if (this.marqueeDiv) this.marqueeDiv.style.display = "none";
        this.world.camera.controls.enabled = true;
        this.pointerDownPos = null;
        this.finishMarquee(m, e.ctrlKey || e.metaKey);
        return;
      }
      if (this.dragging) {
        this.dragging = false;
        this.dragLast = null;
        this.world.camera.controls.enabled = true;
        this.pointerDownPos = null;
        if (this.dragMoved) {
          if (this.selectedId) this.resolveJoins(this.selectedId);
          this.rebuildAuthored();
          this.refreshHandles();
          this.emitElements();
          this.setStatus("Element verplaatst.");
        }
        return;
      }
      if (!this.pointerDownPos) return;
      const moved = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
      this.pointerDownPos = null;
      if (moved > 5) return; // slepen = camera; korte klik = selecteren
      this.handleClick(e);
    });

    dom.addEventListener("pointermove", (e: PointerEvent) => {
      // v0.7-S2: eind-handle slepen
      if (this.handleDrag) {
        const el = this.elements.find((el) => el.id === this.handleDrag!.elementId);
        const raw = this.pickPointRaw(e, el?.start.y ?? 0);
        if (el && raw) {
          const snapped = this.snapToElements(raw, new Set([el.id]));
          if (!this.handleDrag.moved) {
            this.handleDrag.moved = true;
            this.pushUndo();
          }
          const target = el[this.handleDrag.which];
          target.x = snapped.x;
          target.z = snapped.z;
          this.rebuildAuthored();
          this.refreshHandles();
        }
        return;
      }
      // v0.7-S1: venster-selectie tekenen
      if (this.marquee) {
        const rect = dom.getBoundingClientRect();
        this.marquee.x1 = e.clientX - rect.left;
        this.marquee.y1 = e.clientY - rect.top;
        if (this.marqueeDiv) {
          const { x0, y0, x1, y1 } = this.marquee;
          this.marqueeDiv.style.display = "block";
          this.marqueeDiv.style.left = `${Math.min(x0, x1)}px`;
          this.marqueeDiv.style.top = `${Math.min(y0, y1)}px`;
          this.marqueeDiv.style.width = `${Math.abs(x1 - x0)}px`;
          this.marqueeDiv.style.height = `${Math.abs(y1 - y0)}px`;
          // kruisend (rechts→links) = gestippeld amber, omsluitend = doorgetrokken
          this.marqueeDiv.style.borderStyle = x1 < x0 ? "dashed" : "solid";
        }
        return;
      }
      if (this.dragging && this.selectedId) {
        const p = this.dragPoint(e);
        if (p && this.dragLast) {
          const delta = p.clone().sub(this.dragLast);
          delta.y = 0; // verslepen blijft op hetzelfde peil
          if (delta.lengthSq() > 0) {
            if (!this.dragMoved) {
              this.dragMoved = true;
              this.pushUndo(); // NB: snapshot bevat de positie van vóór deze move
            }
            // v0.7-S1: de héle selectie beweegt mee
            for (const el of this.elements) {
              if (!this.selectedIds.has(el.id)) continue;
              el.start.add(delta);
              el.end.add(delta);
            }
            this.dragLast = p;
            this.rebuildAuthored();
            this.refreshHandles();
          }
        }
        return;
      }
      if (this.tool === "draw" && this.drawStart) {
        const p = this.pickPoint(e);
        if (p) this.refreshPreviewTo(p);
      } else if (this.tool === "line" && this.lineStart) {
        const p = this.pickPoint(e);
        if (p) this.refreshPreviewLine(this.lineStart, p);
      } else if (this.tool === "rect" && this.rectStart) {
        const p = this.pickPoint(e);
        if (p) this.refreshPreviewLine(this.rectStart, p);
      } else if (this.tool === "circle" && this.circleCenter) {
        const p = this.pickPoint(e);
        if (p) this.refreshPreviewLine(this.circleCenter, p);
      } else if (this.tool === "measure" && this.measureStart) {
        const p = this.pickPoint(e);
        if (p) this.refreshPreviewLine(this.measureStart, p);
      }
    });

    dom.addEventListener("contextmenu", (e: MouseEvent) => {
      // v0.8: rechtsklik rondt de polygoon-sparing af (zoals de lijn-tool)
      if (this.polyDraft) {
        e.preventDefault();
        this.commitPolyDraft();
        return;
      }
      if (this.isDrawingBusy()) {
        e.preventDefault();
        this.cancelDrawing();
        this.setStatus("Tekenen gestopt.");
      }
    });

    window.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Escape" && this.isDrawingBusy()) {
        this.cancelDrawing();
        this.setStatus("Tekenen gestopt.");
        return;
      }
      const target = e.target as HTMLElement | null;
      const inInput =
        !!target &&
        (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable);
      if (!inInput && (e.ctrlKey || e.metaKey)) {
        const k = e.key.toLowerCase();
        if (k === "z" && !e.shiftKey) {
          e.preventDefault();
          this.undo();
        } else if (k === "y" || (k === "z" && e.shiftKey)) {
          e.preventDefault();
          this.redo();
        } else if (k === "c") {
          // alleen als er echt een element-selectie is; anders normale tekst-copy
          if (this.selectedIds.size > 0) {
            e.preventDefault();
            this.copySelection();
          }
        } else if (k === "x") {
          if (this.selectedIds.size > 0) {
            e.preventDefault();
            this.cutSelection();
          }
        } else if (k === "v") {
          e.preventDefault();
          this.paste();
        } else if (k === "a") {
          e.preventDefault();
          this.selectMany(this.elements.map((el) => el.id));
        }
      }
      // Delete/Backspace: selectie verwijderen
      if (!inInput && (e.key === "Delete" || e.key === "Backspace") && this.selectedIds.size > 0) {
        e.preventDefault();
        this.removeSelected();
      }
    });
  }

  private isDrawingBusy(): boolean {
    return !!(
      this.drawStart ||
      this.lineStart ||
      this.rectStart ||
      this.circleCenter ||
      this.measureStart ||
      this.polyDraft ||
      this.matchSourceId ||
      this.alignRefId ||
      this.mirrorStart
    );
  }

  private handleClick(e: PointerEvent) {
    // Alleen handleSelectClick (default) is async — de rest blijft synchroon.
    switch (this.tool) {
      case "draw": {
        const point = this.pickPoint(e);
        if (!point) return;
        // Point-placement (kolom, poer, paal, dakraam): één klik plaatst het element.
        // De solids-functie negeert de segment-lengte, dus we geven een dummy end.
        const tpl = getTemplate(this.activeTemplateId);
        if (tpl.placementKind === "point") {
          const dummyEnd = point.clone().add(new THREE.Vector3(0.01, 0, 0));
          this.commitComponent(point, dummyEnd);
          break;
        }
        if (!this.drawStart) {
          this.drawStart = point.clone();
          this.setStatus(
            tpl.placementKind === "surface"
              ? "Klik het tegenoverliggende hoekpunt van de vloer/dak."
              : "Klik het eindpunt.",
          );
        } else {
          this.commitComponent(this.drawStart, point);
        }
        break;
      }
      case "line": {
        const point = this.pickPoint(e);
        if (!point) return;
        if (!this.lineStart) {
          this.lineStart = point.clone();
          this.setStatus("Klik het volgende punt (Esc stopt).");
        } else {
          this.lines.push({ id: crypto.randomUUID(), a: this.lineStart.clone(), b: point.clone() });
          this.lineStart = point.clone();
          this.rebuildLines();
          this.setStatus(`Lijn geplaatst (${this.lines.length} totaal). Klik het volgende punt of stop met Esc.`);
        }
        break;
      }
      case "measure": {
        const point = this.pickPoint(e);
        if (!point) return;
        if (!this.measureStart) {
          this.measureStart = point.clone();
          this.setStatus("Klik het tweede meetpunt.");
        } else {
          const length = this.measureStart.distanceTo(point);
          this.measures.push({
            id: crypto.randomUUID(),
            a: this.measureStart.clone(),
            b: point.clone(),
            length,
          });
          this.measureStart = null;
          this.removePreviewLine();
          this.rebuildMeasures();
          this.setStatus(`Gemeten: ${(length * 1000).toFixed(0)} mm. Klik voor een nieuwe meting.`);
        }
        break;
      }
      case "rect": {
        const point = this.pickPoint(e);
        if (!point) return;
        if (!this.rectStart) {
          this.rectStart = point.clone();
          this.setStatus("Klik het tegenoverliggende hoekpunt.");
        } else {
          this.commitRect(this.rectStart, point);
          this.rectStart = null;
          this.removePreviewLine();
        }
        break;
      }
      case "circle": {
        const point = this.pickPoint(e);
        if (!point) return;
        if (!this.circleCenter) {
          this.circleCenter = point.clone();
          this.setStatus("Klik een punt op de cirkel.");
        } else {
          this.commitCircle(this.circleCenter, point);
          this.circleCenter = null;
          this.removePreviewLine();
        }
        break;
      }
      case "text": {
        const point = this.pickPoint(e);
        if (!point) return;
        const content = this.currentText.trim() || "Tekst";
        this.texts.push({ id: crypto.randomUUID(), position: point.clone(), text: content });
        this.rebuildTexts();
        this.setStatus(`Tekst "${content}" geplaatst. Klik voor nog een tekst.`);
        break;
      }
      case "section": {
        const point = this.pickPoint(e);
        if (point) this.placeSectionAt(point);
        break;
      }
      // ---- v0.7 bewerken-gereedschappen ----
      case "align": {
        const id = this.elementIdAt(e);
        if (!id) return;
        if (!this.alignRefId) {
          this.alignRefId = id;
          this.setStatus("Referentie gekozen — klik nu het element dat uitgelijnd moet worden.");
        } else {
          this.alignToElement(this.alignRefId, id);
          this.alignRefId = null;
        }
        break;
      }
      case "mirror": {
        const point = this.pickPoint(e);
        if (!point) return;
        if (this.selectedIds.size === 0) {
          this.setStatus("Spiegelen: selecteer eerst elementen (wissel naar Selecteren).");
          return;
        }
        if (!this.mirrorStart) {
          this.mirrorStart = point.clone();
          this.setStatus("Klik het tweede punt van de spiegelas.");
        } else {
          this.mirrorSelection(this.mirrorStart, point, true);
          this.mirrorStart = null;
        }
        break;
      }
      case "split": {
        const id = this.elementIdAt(e);
        const point = this.pickPoint(e);
        if (id && point) this.splitElementAt(id, point);
        break;
      }
      case "opening": {
        const id = this.elementIdAt(e);
        const point = this.pickPoint(e);
        if (id && point) this.addOpeningAt(id, point);
        else this.setStatus("Sparing: klik óp een element.");
        break;
      }
      case "opening-poly": {
        const id = this.elementIdAt(e);
        const hit = this.raycastGroups(e, [this.authoredGroup]);
        if (!id || !hit) {
          this.setStatus("Polygoon-sparing: klik óp een element.");
          return;
        }
        if (this.polyDraft && this.polyDraft.elementId !== id) {
          this.setStatus("Alle hoekpunten moeten op hetzelfde element liggen (rechtsklik rondt af).");
          return;
        }
        const el = this.elements.find((el) => el.id === id);
        if (!el) return;
        const local = this.toElementLocal(el, hit.point);
        if (!local) return;
        if (!this.polyDraft) this.polyDraft = { elementId: id, points: [] };
        this.polyDraft.points.push(local);
        this.setStatus(
          `Polygoon-sparing: ${this.polyDraft.points.length} punt(en) — klik het volgende hoekpunt, rechtsklik rondt af (min. 3).`,
        );
        break;
      }
      case "match": {
        const id = this.elementIdAt(e);
        if (!id) return;
        if (!this.matchSourceId) {
          this.matchSourceId = id;
          const src = this.elements.find((el) => el.id === id);
          this.setStatus(`Bron: ${src?.name ?? id} — klik nu de doel-elementen (Esc stopt).`);
        } else {
          this.matchProperties(this.matchSourceId, id);
        }
        break;
      }
      default:
        void this.handleSelectClick(e);
    }
  }

  /** Wereldpunt → element-lokale [langs-as, hoogte]-coördinaten (voor polygoon-sparing).
   *  Bij vlak-elementen: [langs-as, dwars]. */
  private toElementLocal(el: PlacedElement, world: THREE.Vector3): [number, number] | null {
    const dx = el.end.x - el.start.x, dz = el.end.z - el.start.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) return null;
    const ux = dx / len, uz = dz / len;
    const rx = world.x - el.start.x, rz = world.z - el.start.z;
    const along = rx * ux + rz * uz;
    const template = getTemplate(el.templateId);
    if (template.placementKind === "surface") {
      const across = -(rx * uz - rz * ux);
      return [along, across];
    }
    const basis = typeof el.params.basisHoogte === "number" ? el.params.basisHoogte / 1000 : 0;
    const height = world.y - (el.start.y + basis);
    return [along, Math.max(0, height)];
  }

  /** v0.8: eigenschappen overnemen (penseel) — type-parameters + typeId van bron naar doel. */
  private matchProperties(sourceId: string, targetId: string) {
    const src = this.elements.find((el) => el.id === sourceId);
    const dst = this.elements.find((el) => el.id === targetId);
    if (!src || !dst || sourceId === targetId) return;
    if (src.templateId !== dst.templateId) {
      this.setStatus("Eigenschappen overnemen kan alleen tussen elementen van hetzelfde template.");
      return;
    }
    this.pushUndo();
    const basis = dst.params.basisHoogte; // instantie-param behouden
    dst.params = { ...src.params };
    if (basis !== undefined) dst.params.basisHoogte = basis;
    dst.typeId = src.typeId;
    this.rebuildAuthored();
    this.emitElements();
    this.setStatus(`Eigenschappen van ${src.name} overgenomen op ${dst.name} — klik een volgend doel of druk Esc.`);
  }

  /** Rond de polygoon-sparing af (rechtsklik) of annuleer hem (Esc). */
  private commitPolyDraft() {
    const draft = this.polyDraft;
    this.polyDraft = null;
    if (!draft || draft.points.length < 3) {
      if (draft) this.setStatus("Polygoon-sparing geannuleerd (minder dan 3 punten).");
      return;
    }
    const el = this.elements.find((e) => e.id === draft.elementId);
    if (!el) return;
    this.pushUndo();
    const xs = draft.points.map((p) => p[0]);
    const ys = draft.points.map((p) => p[1]);
    el.openings = [
      ...elementOpenings(el),
      {
        id: crypto.randomUUID(),
        shape: "poly",
        kind: "vrij",
        points: draft.points,
        // envelope-velden meegeven voor merken/IFC-fallback
        xPos: (Math.min(...xs) + Math.max(...xs)) / 2,
        breedte: Math.max(...xs) - Math.min(...xs),
        hoogte: Math.max(...ys) - Math.min(...ys),
        zBottom: Math.min(...ys),
      },
    ];
    el.opening = null;
    this.rebuildAuthored();
    this.emitElements();
    this.setStatus(`Polygoon-sparing geplaatst (${draft.points.length} hoekpunten).`);
  }

  /** Element-id onder de cursor (alleen zelfgetekende elementen). */
  private elementIdAt(e: PointerEvent): string | null {
    const hit = this.raycastGroups(e, [this.authoredGroup]);
    let obj: THREE.Object3D | null = hit?.object ?? null;
    while (obj && !obj.userData.elementId) obj = obj.parent;
    return obj?.userData.elementId ?? null;
  }

  /** Basisvectoren van het actieve tekenvlak (afhankelijk van het 2D-aanzicht). */
  private planeBasis(): { u: THREE.Vector3; v: THREE.Vector3 } {
    switch (this.currentView) {
      case "front":
      case "back":
        return { u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 1, 0) };
      case "left":
      case "right":
        return { u: new THREE.Vector3(0, 0, 1), v: new THREE.Vector3(0, 1, 0) };
      default:
        return { u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 0, 1) };
    }
  }

  private commitRect(p1: THREE.Vector3, p2: THREE.Vector3) {
    const { u, v } = this.planeBasis();
    const d = p2.clone().sub(p1);
    const du = d.dot(u);
    const dv = d.dot(v);
    if (Math.abs(du) < 0.01 || Math.abs(dv) < 0.01) {
      this.setStatus("Rechthoek te klein — klik een hoekpunt verder weg.");
      return;
    }
    const c1 = p1.clone();
    const c2 = p1.clone().addScaledVector(u, du);
    const c3 = p2.clone();
    const c4 = p1.clone().addScaledVector(v, dv);
    const corners = [c1, c2, c3, c4];
    for (let i = 0; i < 4; i++) {
      this.lines.push({
        id: crypto.randomUUID(),
        a: corners[i].clone(),
        b: corners[(i + 1) % 4].clone(),
      });
    }
    this.rebuildLines();
    this.setStatus(
      `Rechthoek geplaatst (${Math.abs(du * 1000).toFixed(0)} × ${Math.abs(dv * 1000).toFixed(0)} mm).`,
    );
  }

  private commitCircle(center: THREE.Vector3, rim: THREE.Vector3) {
    const radius = center.distanceTo(rim);
    if (radius < 0.01) {
      this.setStatus("Cirkel te klein — klik een punt verder van het middelpunt.");
      return;
    }
    const { u, v } = this.planeBasis();
    const steps = 64;
    let prev: THREE.Vector3 | null = null;
    for (let i = 0; i <= steps; i++) {
      const ang = (Math.PI * 2 * i) / steps;
      const p = center
        .clone()
        .addScaledVector(u, radius * Math.cos(ang))
        .addScaledVector(v, radius * Math.sin(ang));
      if (prev) this.lines.push({ id: crypto.randomUUID(), a: prev, b: p });
      prev = p;
    }
    this.rebuildLines();
    this.setStatus(`Cirkel geplaatst (r = ${(radius * 1000).toFixed(0)} mm).`);
  }

  private async handleSelectClick(e: PointerEvent) {
    // 1. Zelfgetekend element? Synchrone raycast tegen authoredGroup.
    const hit = this.raycastGroups(e, [this.authoredGroup]);
    if (hit) {
      let obj: THREE.Object3D | null = hit.object;
      while (obj && !obj.userData.elementId) obj = obj.parent;
      if (obj?.userData.elementId) {
        await this.clearFragmentSelection();
        // v0.7-S1: Ctrl-klik voegt toe aan / haalt uit de selectie
        this.selectElement(obj.userData.elementId, { additive: e.ctrlKey || e.metaKey });
        return;
      }
    }
    // Ctrl-klik in de leegte laat de selectie intact (CAD-conventie)
    if (e.ctrlKey || e.metaKey) return;

    // 2. Geladen IFC-fragment? Async raycast via de fragments-native API
    //    (@thatopen/fragments 3.4.6 — model.raycast + model.highlight).
    const dom: HTMLElement = this.world.renderer.three.domElement;
    const mouse = new THREE.Vector2(e.clientX, e.clientY);
    const camera = this.world.camera.three;
    for (const info of this.models) {
      const model: any = this.fragments.list.get(info.id);
      if (!model?.object?.visible) continue;
      try {
        const result = await model.raycast({ mouse, camera, dom });
        const localId = result?.localId;
        if (localId !== undefined && localId !== null) {
          await this.selectFragment(info.id, localId);
          return;
        }
      } catch (err) {
        console.warn(`IFC-raycast op ${info.id} mislukt:`, err);
      }
    }

    // 3. Leegte geraakt → alles deselecteren.
    await this.clearFragmentSelection();
    this.selectElement(null);
  }

  /** Selecteert één item uit een geladen IFC-fragment en accentueert het amber. */
  private async selectFragment(modelId: string, localId: number) {
    await this.clearFragmentSelection();
    this.selectElement(null); // authored-selectie los
    const model: any = this.fragments.list.get(modelId);
    if (!model) return;
    try {
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color("#d97706"),
        transparent: true,
        opacity: 0.6,
        depthTest: false,
      });
      await model.highlight([localId], mat);
      this.selectedFragment = { modelId, localId };
      this.fragments?.core?.update?.(true);
      this.setStatus(`IFC-element geselecteerd — model "${modelId}", localId ${localId}.`);
    } catch (err) {
      console.warn("Fragment highlighten mislukt:", err);
    }
  }

  /** Herstelt de fragment-selectie naar het originele materiaal. */
  private async clearFragmentSelection() {
    if (!this.selectedFragment) return;
    const { modelId, localId } = this.selectedFragment;
    this.selectedFragment = null;
    const model: any = this.fragments?.list.get(modelId);
    if (!model) return;
    try {
      await model.resetHighlight?.([localId]);
      this.fragments?.core?.update?.(true);
    } catch {
      /* al vrijgegeven of model dispose'd */
    }
  }

  /** Punt op een horizontaal vlak op hoogte `y` (voor handle-drag), met raster-snap. */
  private pickPointRaw(e: PointerEvent, y: number): THREE.Vector3 | null {
    const ray = this.currentRay(e);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
    const out = new THREE.Vector3();
    if (!ray.intersectPlane(plane, out)) return null;
    out.x = Math.round(out.x / SNAP) * SNAP;
    out.z = Math.round(out.z / SNAP) * SNAP;
    return this.snapToGrid(out);
  }

  /** Venster-selectie afronden: L→R = volledig binnen venster, R→L = kruisend. */
  private finishMarquee(m: { x0: number; y0: number; x1: number; y1: number }, additive: boolean) {
    const dom: HTMLElement = this.world.renderer.three.domElement;
    const rect = dom.getBoundingClientRect();
    const camera = this.world.camera.three;
    const minX = Math.min(m.x0, m.x1), maxX = Math.max(m.x0, m.x1);
    const minY = Math.min(m.y0, m.y1), maxY = Math.max(m.y0, m.y1);
    if (maxX - minX < 4 && maxY - minY < 4) return; // te klein: was gewoon een klik
    const crossing = m.x1 < m.x0;
    const toScreen = (p: THREE.Vector3): { x: number; y: number } | null => {
      const ndc = p.clone().project(camera);
      if (ndc.z > 1) return null; // achter de camera
      return { x: ((ndc.x + 1) / 2) * rect.width, y: ((1 - ndc.y) / 2) * rect.height };
    };
    const inside = (s: { x: number; y: number } | null) =>
      !!s && s.x >= minX && s.x <= maxX && s.y >= minY && s.y <= maxY;
    const ids: string[] = [];
    for (const el of this.elements) {
      const a = toScreen(el.start);
      const b = toScreen(el.end);
      const hit = crossing ? inside(a) || inside(b) : inside(a) && inside(b);
      if (hit) ids.push(el.id);
    }
    this.selectMany(ids, { additive });
    this.setStatus(`${ids.length} element(en) ${crossing ? "kruisend " : ""}geselecteerd.`);
  }

  /** Verbreek joins op één specifiek eindpunt (voor her-joinen na handle-drag). */
  private unjoinEndpoint(elementId: string, which: "start" | "end") {
    this.joins = this.joins.filter(
      (j) => !(j.aId === elementId && j.aEnd === which) && !(j.bId === elementId && j.bEnd === which),
    );
  }

  /** Sleeppunt: altijd op het horizontale vlak van het element zelf, zodat de
   *  straal niet op het versleepte element raycast (parallaxsprongen). */
  private dragPoint(e: PointerEvent): THREE.Vector3 | null {
    const ray = this.currentRay(e);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.dragPlaneY);
    const out = new THREE.Vector3();
    if (!ray.intersectPlane(plane, out)) return null;
    out.x = Math.round(out.x / SNAP) * SNAP;
    out.z = Math.round(out.z / SNAP) * SNAP;
    return this.snapToGrid(out);
  }

  /** Tekenvlak afhankelijk van het actieve aanzicht: horizontaal op het peil van de
   *  actieve verdieping, verticaal door het nulpunt. */
  private drawPlane(): THREE.Plane {
    const o = new THREE.Vector3(this.origin.x, this.origin.z, -this.origin.y);
    switch (this.currentView) {
      case "front":
      case "back": {
        const n = new THREE.Vector3(0, 0, 1);
        return new THREE.Plane(n, -n.dot(o));
      }
      case "left":
      case "right": {
        const n = new THREE.Vector3(1, 0, 0);
        return new THREE.Plane(n, -n.dot(o));
      }
      default:
        return new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.getActiveStorey().elevation);
    }
  }

  /** Punt kiezen: eerst op modellen/elementen/DXF, anders op het tekenvlak van het aanzicht. */
  private pickPoint(e: PointerEvent): THREE.Vector3 | null {
    const targets: THREE.Object3D[] = [this.authoredGroup, this.dxfRoot];
    for (const info of this.models) {
      const model: any = this.fragments.list.get(info.id);
      if (model?.object?.visible) targets.push(model.object);
    }
    const hit = this.raycastGroups(e, targets);
    let point: THREE.Vector3 | null = hit ? hit.point.clone() : null;

    if (!point) {
      const ray = this.currentRay(e);
      const out = new THREE.Vector3();
      if (ray.intersectPlane(this.drawPlane(), out)) point = out;
    }
    if (!point) return null;

    // alleen x/z snappen: y (peil) komt exact van het tekenvlak of het geraakte oppervlak
    point.x = Math.round(point.x / SNAP) * SNAP;
    point.z = Math.round(point.z / SNAP) * SNAP;
    // v0.7-S2: element-snap (endpoints/midpoints) wint van raster/stramien
    return this.snapToElements(this.snapToGrid(point));
  }

  private currentRay(e: PointerEvent): THREE.Ray {
    const dom: HTMLElement = this.world.renderer.three.domElement;
    const rect = dom.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.world.camera.three);
    return this.raycaster.ray;
  }

  private raycastGroups(e: PointerEvent, targets: THREE.Object3D[]) {
    this.currentRay(e);
    try {
      const hits = this.raycaster.intersectObjects(targets, true);
      return hits.find((h) => h.point) ?? null;
    } catch {
      return null; // fragments-geometrie is niet altijd standaard raycastbaar
    }
  }

  // ------------------------------------------------------------------ componenten
  private refreshPreviewTo(end: THREE.Vector3 | null) {
    if (!this.drawStart || !end) return;
    this.lastMovePoint = end.clone();
    if (this.previewGroup) {
      this.authoredGroup.remove(this.previewGroup);
      disposeGroup(this.previewGroup);
      this.previewGroup = null;
    }
    const built = this.buildComponentGroup(this.drawStart, end, this.currentParams, { preview: true });
    if (built) {
      // preview-geometrie mag NIET geraycast worden: anders zit hij tussen de cursor en het
      // echte element, en selecteren voelt kapot omdat de preview de klik opeet.
      built.traverse((o) => {
        (o as THREE.Mesh).raycast = () => {};
      });
      this.previewGroup = built;
      this.authoredGroup.add(built);
    }
  }

  private buildComponentGroup(
    start: THREE.Vector3,
    end: THREE.Vector3,
    params: ParamValues,
    opts: {
      preview?: boolean;
      selected?: boolean;
      phaseColor?: string;
      phaseOpacity?: number;
      phaseWireframe?: boolean;
    } = {},
    templateId = this.activeTemplateId,
    openings: Opening | Opening[] | null = null,
  ): THREE.Group | null {
    const template = getTemplate(templateId);
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.hypot(dx, dz);
    if (length < 0.05) return null;
    const group = buildElementGroup(template, length, params, opts, openings);
    const basis = typeof params.basisHoogte === "number" ? params.basisHoogte : 0;
    group.position.set(start.x, start.y + basis * MM, start.z);
    group.rotation.y = Math.atan2(-dz, dx);
    return group;
  }

  private commitComponent(start: THREE.Vector3, end: THREE.Vector3) {
    const length = Math.hypot(end.x - start.x, end.z - start.z);
    const template = getTemplate(this.activeTemplateId);
    // Point-placement: geen minimum-lengte-check, één klik is genoeg.
    if (template.placementKind !== "point" && length < 0.05) {
      this.setStatus("Element te kort — klik een eindpunt verder van het startpunt.");
      return;
    }
    this.pushUndo();
    const n = (this.elementCounters.get(template.id) ?? 0) + 1;
    this.elementCounters.set(template.id, n);
    const el: PlacedElement = {
      id: crypto.randomUUID(),
      templateId: template.id,
      name: `${template.name} ${String(n).padStart(2, "0")}`,
      start: start.clone(),
      end: end.clone(),
      params: { ...this.currentParams },
      storeyId: this.activeStoreyId,
      opening: null,
      openings: [],
      phase: "new",
      // v0.7-S5: plaatsing onder een actief type registreert de instantie
      typeId:
        this.activeTypeId && this.types.find((t) => t.id === this.activeTypeId)?.templateId === template.id
          ? this.activeTypeId
          : undefined,
    };
    // Hosting-relatie: bij deuren/ramen zoeken we de wand-onder-cursor en
    // koppelen die als host (PlacedElement.hostId). v0.7-S4: de host krijgt
    // meteen een gekoppelde sparing (id = kozijn-id) op kozijnmaat.
    if (template.ifcEntity === "IfcDoor" || template.ifcEntity === "IfcWindow") {
      const hostId = this.findHostAt(start.clone().lerp(end, 0.5));
      if (hostId) {
        el.hostId = hostId;
        const host = this.elements.find((h) => h.id === hostId);
        if (host) {
          const solids = template.solids(Math.max(length, 0.1), el.params);
          let w = 0, h = 0;
          for (const s of solids) {
            w = Math.max(w, s.cx + s.dx / 2);
            h = Math.max(h, s.zBottom + s.dz);
          }
          // positie van het kozijn-midden geprojecteerd op de host-as
          const hdx = host.end.x - host.start.x, hdz = host.end.z - host.start.z;
          const hlen = Math.hypot(hdx, hdz);
          if (hlen > 1e-6 && w > 0.05 && h > 0.05) {
            const ux = hdx / hlen, uz = hdz / hlen;
            const mid = start.clone().lerp(end, 0.5);
            const along = (mid.x - host.start.x) * ux + (mid.z - host.start.z) * uz;
            host.openings = [
              ...elementOpenings(host),
              {
                id: el.id, // koppeling: sparing verdwijnt mee met het kozijn
                shape: "rect",
                kind: template.ifcEntity === "IfcDoor" ? "deur" : "raam",
                xPos: Math.max(0, Math.min(hlen, along)),
                breedte: w,
                hoogte: h,
                zBottom: 0,
              },
            ];
            host.opening = null;
          }
        }
      }
    }
    this.elements.push(el);
    // v0.7-S3: lijnelementen joinen automatisch op eindpunt/lijf van buren;
    // v0.8: direct de hoekaansluiting (butt joint) doorrekenen
    if (template.placementKind !== "point" && template.placementKind !== "surface") {
      this.autoJoinAt(el, "start");
      this.autoJoinAt(el, "end");
      this.resolveJoins(el.id);
    }
    this.drawStart = null;
    this.lastMovePoint = null;
    this.hideSnapMarker();
    this.rebuildAuthored();
    this.emitElements();
    const suffix = el.hostId ? " (gekoppeld aan host-wand, sparing gemaakt)" : "";
    const lm = template.placementKind === "point" ? "punt" : `${(length * 1000).toFixed(0)} mm`;
    this.setStatus(`${el.name} geplaatst (${lm})${suffix}. Klik opnieuw of druk Esc.`);
  }

  /** Zoekt de wand die op of vlakbij `point` staat (voor host-koppeling van kozijnen). */
  private findHostAt(point: THREE.Vector3): string | null {
    for (const el of this.elements) {
      const t = getTemplate(el.templateId);
      if (t.ifcEntity !== "IfcWall") continue;
      // Ligt `point` binnen een kleine tolerantie langs de wand-as?
      const dx = el.end.x - el.start.x;
      const dz = el.end.z - el.start.z;
      const len = Math.hypot(dx, dz);
      if (len < 1e-6) continue;
      const ux = dx / len;
      const uz = dz / len;
      const rx = point.x - el.start.x;
      const rz = point.z - el.start.z;
      const along = rx * ux + rz * uz;
      const across = Math.abs(rx * uz - rz * ux);
      const depth = t.depth(el.params);
      if (along >= -0.3 && along <= len + 0.3 && across <= depth) return el.id;
    }
    return null;
  }

  private cancelDrawing() {
    this.drawStart = null;
    this.lineStart = null;
    this.rectStart = null;
    this.circleCenter = null;
    this.measureStart = null;
    this.lastMovePoint = null;
    this.alignRefId = null;
    this.mirrorStart = null;
    this.polyDraft = null;
    this.matchSourceId = null;
    this.hideSnapMarker();
    if (this.previewGroup) {
      this.authoredGroup.remove(this.previewGroup);
      disposeGroup(this.previewGroup);
      this.previewGroup = null;
    }
    this.removePreviewLine();
  }

  private rebuildAuthored() {
    for (const child of [...this.authoredGroup.children]) {
      if (child === this.previewGroup) continue;
      this.authoredGroup.remove(child);
      disposeGroup(child);
    }
    for (const el of this.elements) {
      const template = getTemplate(el.templateId);
      // v0.7-S6: laag = hoofdcategorie; subcategorie-string blijft werken als
      // iemand die nog in de map heeft staan (oude projecten/instellingen).
      if (this.layerVisibility.get(deriveMainCategory(template)) === false) continue;
      if (this.layerVisibility.get(template.category) === false) continue;
      const phase = el.phase ?? "new";
      if (!this.phaseSettings.visible[phase]) continue;
      const overrideColor = this.phaseSettings.color[phase];
      const group = this.buildComponentGroup(
        el.start,
        el.end,
        el.params,
        {
          selected: this.selectedIds.has(el.id),
          phaseColor: overrideColor && phase !== "new" ? overrideColor : undefined,
          phaseOpacity: this.phaseSettings.opacity[phase],
          phaseWireframe: this.phaseSettings.wireframe[phase],
        },
        el.templateId,
        elementOpenings(el),
      );
      if (group) {
        group.userData.elementId = el.id;
        this.authoredGroup.add(group);
      }
    }
  }

  // ------------------------------------------------------------------ lijnen & maatvoering
  private refreshPreviewLine(a: THREE.Vector3, b: THREE.Vector3) {
    this.removePreviewLine();
    const geometry = new THREE.BufferGeometry().setFromPoints([a, b]);
    const material = new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.7 });
    this.previewLine = new THREE.Line(geometry, material);
    this.world.scene.three.add(this.previewLine);
  }

  private removePreviewLine() {
    if (this.previewLine) {
      this.world.scene.three.remove(this.previewLine);
      this.previewLine.geometry.dispose();
      (this.previewLine.material as THREE.Material).dispose();
      this.previewLine = null;
    }
  }

  private rebuildLines() {
    for (const child of [...this.lineGroup.children]) {
      this.lineGroup.remove(child);
      disposeGroup(child);
    }
    for (const seg of this.lines) {
      const geometry = new THREE.BufferGeometry().setFromPoints([seg.a, seg.b]);
      const material = new THREE.LineBasicMaterial({ color: 0xf5f0ea });
      this.lineGroup.add(new THREE.Line(geometry, material));
    }
  }

  private rebuildMeasures() {
    for (const child of [...this.measureGroup.children]) {
      this.measureGroup.remove(child);
      disposeGroup(child);
    }
    for (const seg of this.measures) {
      const geometry = new THREE.BufferGeometry().setFromPoints([seg.a, seg.b]);
      const material = new THREE.LineBasicMaterial({ color: 0xf59e0b });
      this.measureGroup.add(new THREE.Line(geometry, material));

      const mid = seg.a.clone().add(seg.b).multiplyScalar(0.5);
      const label = this.makeLabel(`${(seg.length * 1000).toFixed(0)} mm`);
      label.position.copy(mid).add(new THREE.Vector3(0, 0.15, 0));
      this.measureGroup.add(label);
    }
  }

  private rebuildTexts() {
    for (const child of [...this.textGroup.children]) {
      this.textGroup.remove(child);
      disposeGroup(child);
    }
    for (const t of this.texts) {
      const label = this.makeLabel(t.text);
      label.position.copy(t.position).add(new THREE.Vector3(0, 0.15, 0));
      this.textGroup.add(label);
    }
  }

  private makeLabel(textContent: string): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "rgba(20, 17, 15, 0.85)";
    ctx.beginPath();
    ctx.roundRect(2, 2, 252, 60, 12);
    ctx.fill();
    ctx.font = "600 30px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#f59e0b";
    ctx.fillText(textContent, 128, 34);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.9, 0.225, 1);
    return sprite;
  }

  // ------------------------------------------------------------------ divers
  private emitModels() {
    this.callbacks.onModelsChanged?.([...this.models]);
  }

  /** Merk-/posnummering (Tekla-principe): identieke elementen delen één merk.
   *  W = wanden, P = panelen/roosters, B = balken/dragers. */
  private recomputeMerken() {
    const groups = new Map<string, string>();
    const counters = new Map<string, number>();
    for (const el of this.elements) {
      const template = getTemplate(el.templateId);
      const prefix =
        template.ifcEntity === "IfcBeam" ? "B" : template.ifcEntity === "IfcPlate" ? "P" : "W";
      const len = Math.round(Math.hypot(el.end.x - el.start.x, el.end.z - el.start.z) * 1000);
      const { basisHoogte: _basis, ...typeParams } = el.params as Record<string, unknown>;
      // sparingen tekenrichting-onafhankelijk maken: positie vanaf het dichtstbijzijnde
      // uiteinde, gesorteerd zodat de volgorde niet meetelt
      const opKey = elementOpenings(el)
        .map((op) => ({
          s: op.shape ?? "rect",
          b: Math.round(op.breedte * 1000),
          h: Math.round(op.hoogte * 1000),
          z: Math.round((op.zBottom ?? 0) * 1000),
          x: Math.round(Math.min(op.xPos, len / 1000 - op.xPos) * 1000),
        }))
        .sort((a, b) => a.x - b.x || a.b - b.b);
      const key = [el.templateId, len, JSON.stringify(typeParams), JSON.stringify(opKey)].join("|");
      let merk = groups.get(key);
      if (!merk) {
        const n = (counters.get(prefix) ?? 0) + 1;
        counters.set(prefix, n);
        merk = `${prefix}${String(n).padStart(2, "0")}`;
        groups.set(key, merk);
      }
      el.merk = merk;
    }
  }

  private emitElements() {
    this.recomputeMerken();
    this.callbacks.onElementsChanged?.([...this.elements]);
  }

  private emitLayers() {
    this.callbacks.onLayersChanged?.(this.getLayers());
  }

  private setStatus(msg: string) {
    this.callbacks.onStatus?.(msg);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.components.dispose();
  }
}
