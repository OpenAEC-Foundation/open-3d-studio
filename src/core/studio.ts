import * as THREE from "three";
import * as OBC from "@thatopen/components";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { getTemplate, templates } from "../catalog/registry";
import type {
  LineSegment,
  LoadedModelInfo,
  MeasureSegment,
  ParamValues,
  PlacedElement,
  ProjectOrigin,
  Sheet,
  TextLabel,
  ViewName,
} from "./types";
import { buildElementGroup, disposeGroup } from "./meshBuilder";
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
  | "section";
export type { ViewName };

const MM = 0.001;
const SNAP = 0.05; // 50 mm raster-snap bij het tekenen

export const LAYER_LINES = "Lijnen";
export const LAYER_MEASURES = "Maatvoering";
export const LAYER_TEXTS = "Teksten";

export interface StudioCallbacks {
  onModelsChanged?: (models: LoadedModelInfo[]) => void;
  onElementsChanged?: (elements: PlacedElement[]) => void;
  onSelectionChanged?: (id: string | null) => void;
  onLayersChanged?: (layers: { name: string; visible: boolean }[]) => void;
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
  private layerVisibility = new Map<string, boolean>();
  private dxfGroups = new Map<string, THREE.Group>();

  private authoredGroup = new THREE.Group();
  private lineGroup = new THREE.Group();
  private measureGroup = new THREE.Group();
  private textGroup = new THREE.Group();
  private dxfRoot = new THREE.Group();
  private previewGroup: THREE.Group | null = null;
  private previewLine: THREE.Line | null = null;

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
    for (const t of templates) this.layerVisibility.set(t.category, true);
    this.layerVisibility.set(LAYER_LINES, true);
    this.layerVisibility.set(LAYER_MEASURES, true);
    this.layerVisibility.set(LAYER_TEXTS, true);
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
    );
    world.camera.controls.setLookAt(14, 10, 14, 0, 0, 0);
    this.raycaster.params.Line = { threshold: 0.05 };
    this.refreshOriginHelper();

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
      const bytes = await exportElementsToIfc(this.elements, { origin: this.origin });
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
      version: 1,
      app: "open-3d-studio",
      origin: { ...this.origin },
      elements: this.elements.map((e) => ({
        id: e.id,
        templateId: e.templateId,
        name: e.name,
        start: v(e.start),
        end: v(e.end),
        params: { ...e.params },
      })),
      lines: this.lines.map((l) => ({ id: l.id, a: v(l.a), b: v(l.b) })),
      measures: this.measures.map((m) => ({ id: m.id, a: v(m.a), b: v(m.b), length: m.length })),
      texts: this.texts.map((t) => ({ id: t.id, position: v(t.position), text: t.text })),
    };
  }

  /** Herstelt de modelinhoud uit een .o3s-projectbestand. */
  restoreProject(state: any) {
    const v = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2]);
    this.cancelDrawing();
    this.elements = (state.elements ?? []).map((e: any) => ({
      ...e,
      start: v(e.start),
      end: v(e.end),
      params: { ...e.params },
    }));
    this.lines = (state.lines ?? []).map((l: any) => ({ ...l, a: v(l.a), b: v(l.b) }));
    this.measures = (state.measures ?? []).map((m: any) => ({ ...m, a: v(m.a), b: v(m.b) }));
    this.texts = (state.texts ?? []).map((t: any) => ({ ...t, position: v(t.position) }));
    this.origin = state.origin ?? { x: 0, y: 0, z: 0 };
    this.elementCounters.clear();
    for (const el of this.elements) {
      this.elementCounters.set(el.templateId, (this.elementCounters.get(el.templateId) ?? 0) + 1);
    }
    this.selectedId = null;
    this.refreshOriginHelper();
    this.rebuildAuthored();
    this.rebuildLines();
    this.rebuildMeasures();
    this.rebuildTexts();
    this.emitElements();
    this.callbacks.onSelectionChanged?.(null);
    this.zoomAll();
    this.setStatus(`Project geladen: ${this.elements.length} element(en).`);
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
    // snap de kijkrichting naar de dichtstbijzijnde hoofdas
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
    this.setStatus(
      "Doorsnede actief: alles vóór het klikpunt is weggesneden. Verwijder de doorsnede via het lagenpaneel.",
    );
  }

  clearSection() {
    const renderer: THREE.WebGLRenderer = this.world.renderer.three;
    renderer.clippingPlanes = [];
    this.setStatus("Doorsnede verwijderd.");
  }

  hasSection(): boolean {
    return (this.world?.renderer?.three?.clippingPlanes?.length ?? 0) > 0;
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

  // ------------------------------------------------------------------ lagen
  getLayers(): { name: string; visible: boolean }[] {
    return [...this.layerVisibility.entries()].map(([name, visible]) => ({ name, visible }));
  }

  setLayerVisible(name: string, visible: boolean) {
    this.layerVisibility.set(name, visible);
    if (name === LAYER_LINES) this.lineGroup.visible = visible;
    else if (name === LAYER_MEASURES) this.measureGroup.visible = visible;
    else if (name === LAYER_TEXTS) this.textGroup.visible = visible;
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
      select: "Selecteren: klik een getekend element aan.",
      draw: `${getTemplate(this.activeTemplateId).name} tekenen: klik het startpunt (Esc annuleert, snap 50 mm).`,
      line: "Lijnen tekenen: klik punten achter elkaar (Esc of rechtermuisknop stopt).",
      rect: "Rechthoek: klik twee tegenoverliggende hoekpunten.",
      circle: "Cirkel: klik het middelpunt en daarna een punt op de cirkel.",
      measure: "Meten: klik twee punten.",
      text: "Tekst plaatsen: klik een punt (tekst instelbaar in het zijpaneel).",
      section: "Doorsnede: klik een punt; alles vóór dat punt (t.o.v. de kijkrichting) wordt weggesneden.",
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

  selectElement(id: string | null) {
    this.selectedId = id;
    this.rebuildAuthored();
    this.callbacks.onSelectionChanged?.(id);
  }

  updateElementParams(id: string, params: ParamValues) {
    const el = this.elements.find((e) => e.id === id);
    if (!el) return;
    el.params = { ...params };
    this.rebuildAuthored();
    this.emitElements();
  }

  /** Draait een element om zijn startpunt (graden, positief = tegen de klok in, bovenaanzicht). */
  rotateElement(id: string, deltaDeg: number) {
    const el = this.elements.find((e) => e.id === id);
    if (!el) return;
    const angle = (deltaDeg * Math.PI) / 180;
    const dx = el.end.x - el.start.x;
    const dz = el.end.z - el.start.z;
    // rotatie in het XZ-vlak (bovenaanzicht), tegen de klok in bij positieve hoek
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    el.end.x = el.start.x + dx * cos + dz * sin;
    el.end.z = el.start.z - dx * sin + dz * cos;
    this.rebuildAuthored();
    this.emitElements();
    this.setStatus(`${el.name} gedraaid (${deltaDeg > 0 ? "+" : ""}${deltaDeg}°).`);
  }

  /** Past de lengte van een element aan langs de huidige richting (mm). */
  setElementLength(id: string, lengthMm: number) {
    const el = this.elements.find((e) => e.id === id);
    if (!el) return;
    const dx = el.end.x - el.start.x;
    const dz = el.end.z - el.start.z;
    const current = Math.hypot(dx, dz);
    if (current < 1e-6 || lengthMm < 50) return;
    const f = (lengthMm * MM) / current;
    el.end.x = el.start.x + dx * f;
    el.end.z = el.start.z + dz * f;
    this.rebuildAuthored();
    this.emitElements();
  }

  removeElement(id: string) {
    this.elements = this.elements.filter((e) => e.id !== id);
    if (this.selectedId === id) this.selectedId = null;
    this.rebuildAuthored();
    this.emitElements();
    this.callbacks.onSelectionChanged?.(this.selectedId);
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
      if (e.button === 0) this.pointerDownPos = { x: e.clientX, y: e.clientY };
    });

    dom.addEventListener("pointerup", (e: PointerEvent) => {
      if (e.button !== 0 || !this.pointerDownPos) return;
      const moved = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
      this.pointerDownPos = null;
      if (moved > 5) return; // slepen = camera, geen klik
      this.handleClick(e);
    });

    dom.addEventListener("pointermove", (e: PointerEvent) => {
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
      }
    });
  }

  private isDrawingBusy(): boolean {
    return !!(
      this.drawStart ||
      this.lineStart ||
      this.rectStart ||
      this.circleCenter ||
      this.measureStart
    );
  }

  private handleClick(e: PointerEvent) {
    switch (this.tool) {
      case "draw": {
        const point = this.pickPoint(e);
        if (!point) return;
        if (!this.drawStart) {
          this.drawStart = point.clone();
          this.setStatus("Klik het eindpunt.");
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
      default:
        this.handleSelectClick(e);
    }
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

  private handleSelectClick(e: PointerEvent) {
    const hit = this.raycastGroups(e, [this.authoredGroup]);
    if (!hit) {
      this.selectElement(null);
      return;
    }
    let obj: THREE.Object3D | null = hit.object;
    while (obj && !obj.userData.elementId) obj = obj.parent;
    this.selectElement(obj?.userData.elementId ?? null);
  }

  /** Tekenvlak afhankelijk van het actieve aanzicht, door het nulpunt. */
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
      default: {
        const n = new THREE.Vector3(0, 1, 0);
        return new THREE.Plane(n, -n.dot(o));
      }
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

    point.x = Math.round(point.x / SNAP) * SNAP;
    point.z = Math.round(point.z / SNAP) * SNAP;
    point.y = Math.round(point.y / SNAP) * SNAP;
    return point;
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
      this.previewGroup = built;
      this.authoredGroup.add(built);
    }
  }

  private buildComponentGroup(
    start: THREE.Vector3,
    end: THREE.Vector3,
    params: ParamValues,
    opts: { preview?: boolean; selected?: boolean } = {},
    templateId = this.activeTemplateId,
  ): THREE.Group | null {
    const template = getTemplate(templateId);
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.hypot(dx, dz);
    if (length < 0.05) return null;
    const group = buildElementGroup(template, length, params, opts);
    const basis = typeof params.basisHoogte === "number" ? params.basisHoogte : 0;
    group.position.set(start.x, start.y + basis * MM, start.z);
    group.rotation.y = Math.atan2(-dz, dx);
    return group;
  }

  private commitComponent(start: THREE.Vector3, end: THREE.Vector3) {
    const length = Math.hypot(end.x - start.x, end.z - start.z);
    if (length < 0.05) {
      this.setStatus("Element te kort — klik een eindpunt verder van het startpunt.");
      return;
    }
    const template = getTemplate(this.activeTemplateId);
    const n = (this.elementCounters.get(template.id) ?? 0) + 1;
    this.elementCounters.set(template.id, n);
    const el: PlacedElement = {
      id: crypto.randomUUID(),
      templateId: template.id,
      name: `${template.name} ${String(n).padStart(2, "0")}`,
      start: start.clone(),
      end: end.clone(),
      params: { ...this.currentParams },
    };
    this.elements.push(el);
    this.drawStart = null;
    this.lastMovePoint = null;
    this.rebuildAuthored();
    this.emitElements();
    this.setStatus(
      `${el.name} geplaatst (lengte ${(length * 1000).toFixed(0)} mm). Klik een nieuw startpunt of druk op Esc.`,
    );
  }

  private cancelDrawing() {
    this.drawStart = null;
    this.lineStart = null;
    this.rectStart = null;
    this.circleCenter = null;
    this.measureStart = null;
    this.lastMovePoint = null;
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
      if (this.layerVisibility.get(template.category) === false) continue;
      const group = this.buildComponentGroup(
        el.start,
        el.end,
        el.params,
        { selected: el.id === this.selectedId },
        el.templateId,
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

  private emitElements() {
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
