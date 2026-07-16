import type { ComponentTemplate, MaterialLayer, ParamDef, ParamValues, ProfileSpec, SolidBox } from "./types";

/** `.o3st` (Open 3D Studio Template) — serialiseerbare templates.
 *
 *  Het probleem: onze `ComponentTemplate` bevat functies (`solids`, `depth`,
 *  `color`, `psetProps`, `commonPset`) die niet naar JSON serializeren.
 *  Voor v0.6 kiezen we een **veilige subset**: het bestand beschrijft
 *  parameters + data-driven geometrie. Bij het inladen wordt een échte
 *  `ComponentTemplate` opgebouwd waarvan `solids()` afgeleid wordt uit een van
 *  drie procedurele shape-kinds. Zo hoeven `.o3st`-files nooit code te draaien;
 *  community-templates blijven inherent veilig te installeren.
 *
 *  Drie shape-kinds:
 *  - `layered`      : gestapeld in dikte-richting (spouwmuur, HSB-wand, dakopbouw)
 *  - `solid-box`    : één rechthoekig volume met breedte × dikte × hoogte
 *  - `profile-swept`: constant profiel extruderen langs de wandas (staal, glulam)
 *
 *  Deze drie dekken ~95 % van de bestaande templates. Complexere gevallen
 *  (trap-assembly, roostergevel) blijven in TypeScript. */

export interface O3stFile {
  format: "o3st";
  formatVersion: 1;
  id: string;
  name: string;
  category: string;
  manufacturer?: string;
  nlSfb?: string;
  material?: string;
  loadBearing?: boolean;
  isExternal?: boolean;
  placementKind?: "linear" | "point" | "surface" | "assembly";
  ifcEntity: string;
  ifcPredefinedType?: string;
  ifcObjectType?: string;
  materialLayers?: MaterialLayer[];
  profileSpec?: ProfileSpec;
  params: SerializedParamDef[];
  defaults: ParamValues;
  color?: string;                     // default hex-kleur; mag als functie te complex
  psetName: string;
  psetProps?: Record<string, string | number | boolean>;
  shape: ShapeSpec;
}

/** ParamDef zonder functies — `visibleWhen`/`formula` zijn niet serialiseerbaar. */
export type SerializedParamDef = Omit<ParamDef, "visibleWhen" | "formula">;

export type ShapeSpec =
  | { kind: "layered"; heightParam: string; /** default 2.8 m als heightParam ontbreekt */ defaultHeightM?: number }
  | { kind: "solid-box"; widthParam?: string; depthParam: string; heightParam: string }
  | { kind: "profile-swept" };

/** Bouw een echte ComponentTemplate uit een O3stFile. */
export function o3stToTemplate(file: O3stFile): ComponentTemplate {
  // Vroege waarschuwing op de gedeelde ingest-laag (editor, .o3st-file, plugin):
  // shape-params die niet in params[] bestaan vallen stil terug op defaults —
  // dat levert een "werkend" maar onbedoelbaar template op.
  if (file.shape.kind === "solid-box") {
    for (const key of [file.shape.depthParam, file.shape.heightParam]) {
      if (key && !file.params.some((p) => p.key === key) && !(key in file.defaults)) {
        console.warn(
          `o3st "${file.id}": shape verwijst naar parameter "${key}" die niet in params/defaults staat — vaste fallback-maat wordt gebruikt.`,
        );
      }
    }
  }
  const MM = 0.001;
  const numP = (p: ParamValues, key: string, fallback = 0): number => {
    const v = p[key];
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : fallback;
    }
    return fallback;
  };

  const solidsFn = (length: number, p: ParamValues): SolidBox[] => {
    switch (file.shape.kind) {
      case "layered": {
        const layers = file.materialLayers ?? [];
        const totaal = layers.reduce((s, l) => s + l.thicknessMm * MM, 0);
        const h =
          (typeof file.shape.heightParam === "string"
            ? numP(p, file.shape.heightParam, (file.shape.defaultHeightM ?? 2.8) * 1000)
            : (file.shape.defaultHeightM ?? 2.8) * 1000) * MM;
        let cursor = -totaal / 2;
        const out: SolidBox[] = [];
        for (const laag of layers) {
          const dy = laag.thicknessMm * MM;
          out.push({ cx: length / 2, cy: cursor + dy / 2, zBottom: 0, dx: length, dy, dz: h });
          cursor += dy;
        }
        return out;
      }
      case "solid-box": {
        const w = file.shape.widthParam ? numP(p, file.shape.widthParam, length * 1000) * MM : length;
        const d = numP(p, file.shape.depthParam, 300) * MM;
        const h = numP(p, file.shape.heightParam, 2800) * MM;
        return [{ cx: w / 2, cy: 0, zBottom: 0, dx: w, dy: d, dz: h }];
      }
      case "profile-swept": {
        // Gebruik profileSpec voor dwarsdoorsnede-afmetingen. Fallback: 100 x 100.
        const spec = file.profileSpec;
        const dm = spec?.dimensions ?? {};
        const dy = ((dm.OverallWidth ?? dm.Width ?? dm.XDim ?? 100) as number) * MM;
        const dz = ((dm.OverallDepth ?? dm.Depth ?? dm.YDim ?? 200) as number) * MM;
        return [{ cx: length / 2, cy: 0, zBottom: 0, dx: length, dy, dz }];
      }
    }
  };

  const depthFn = (p: ParamValues): number => {
    switch (file.shape.kind) {
      case "layered":
        return (file.materialLayers ?? []).reduce((s, l) => s + l.thicknessMm * MM, 0);
      case "solid-box":
        return numP(p, file.shape.depthParam, 300) * MM;
      case "profile-swept": {
        const dm = file.profileSpec?.dimensions ?? {};
        return ((dm.OverallWidth ?? dm.Width ?? dm.XDim ?? 100) as number) * MM;
      }
    }
  };

  return {
    id: file.id,
    name: file.name,
    category: file.category,
    manufacturer: file.manufacturer,
    nlSfb: file.nlSfb,
    material: file.material,
    loadBearing: file.loadBearing,
    isExternal: file.isExternal,
    placementKind: file.placementKind ?? "linear",
    materialLayers: file.materialLayers,
    profileSpec: file.profileSpec,
    ifcEntity: file.ifcEntity as any,
    ifcPredefinedType: file.ifcPredefinedType,
    ifcObjectType: file.ifcObjectType,
    params: file.params,
    defaults: { ...file.defaults },
    solids: solidsFn,
    depth: depthFn,
    color: () => file.color ?? "#a49f92",
    psetName: file.psetName,
    psetProps: (length, p) => {
      const out: Record<string, string | number | boolean> = { ...(file.psetProps ?? {}) };
      out.Lengte_mm = Math.round(length * 1000);
      // ook alle numerieke params meenemen
      for (const [k, v] of Object.entries(p)) if (typeof v === "number") out[k] = v;
      return out;
    },
  };
}

/** Serialiseer een bestaand template naar `.o3st`. Alleen data-driven templates
 *  (met materialLayers of profileSpec) laten zich zinvol serialiseren; voor
 *  procedurele TS-templates gaat de solids-functie verloren en kiest de
 *  gebruiker in de editor een van de drie shape-kinds. */
export function templateToO3st(t: ComponentTemplate, shape: ShapeSpec): O3stFile {
  return {
    format: "o3st",
    formatVersion: 1,
    id: t.id,
    name: t.name,
    category: t.category,
    manufacturer: t.manufacturer,
    nlSfb: t.nlSfb,
    material: t.material,
    loadBearing: t.loadBearing,
    isExternal: t.isExternal,
    placementKind: t.placementKind,
    ifcEntity: t.ifcEntity,
    ifcPredefinedType: t.ifcPredefinedType,
    ifcObjectType: t.ifcObjectType,
    materialLayers: t.materialLayers,
    profileSpec: t.profileSpec,
    params: t.params.map(({ visibleWhen, formula, ...rest }) => rest as SerializedParamDef),
    defaults: { ...t.defaults },
    color: (() => {
      try { return t.color(t.defaults); } catch { return "#a49f92"; }
    })(),
    psetName: t.psetName,
    psetProps: (() => {
      try { return t.psetProps(1, t.defaults); } catch { return {}; }
    })(),
    shape,
  };
}
