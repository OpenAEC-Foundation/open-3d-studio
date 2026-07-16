import { useState } from "react";
import type { O3stFile, ShapeSpec } from "../core/o3stTemplate";
import { templateToO3st } from "../core/o3stTemplate";
import { loadO3stTemplate, getTemplate } from "../catalog/registry";
import { openFilesDialog, saveFileAs } from "../core/fileio";

/** Editor voor `.o3st` community-templates (v0.6-1).
 *
 *  Zeer bewust minimalistisch: alleen de velden die met een simpel formulier
 *  te bewerken zijn. Voor complexere geometrie (assembly, formule-driven
 *  parameters) blijven TypeScript-templates aangewezen. */

const EMPTY: O3stFile = {
  format: "o3st",
  formatVersion: 1,
  id: "mijn-template",
  name: "Mijn template",
  category: "Overig",
  ifcEntity: "IfcWall",
  ifcPredefinedType: "SOLIDWALL",
  loadBearing: false,
  isExternal: false,
  placementKind: "linear",
  materialLayers: [
    { material: "Beton", thicknessMm: 200, category: "structure", lambda: 2.3 },
  ],
  params: [
    { key: "hoogte", label: "Hoogte", type: "length", min: 2000, max: 4000, step: 10 },
    { key: "basisHoogte", label: "Peil", type: "length", min: -5000, max: 20000, step: 10 },
  ],
  defaults: { hoogte: 2800, basisHoogte: 0 },
  color: "#a49f92",
  psetName: "Mijn_Custom",
  psetProps: {},
  shape: { kind: "layered", heightParam: "hoogte" },
};

export function TemplateEditor(props: { onClose: () => void; onSaved: () => void }) {
  const [file, setFile] = useState<O3stFile>(EMPTY);
  const [message, setMessage] = useState<string>("");

  function patch<K extends keyof O3stFile>(key: K, value: O3stFile[K]) {
    setFile({ ...file, [key]: value });
  }

  async function importFile() {
    const files = await openFilesDialog([{ name: "Open 3D Studio-template", extensions: ["o3st"] }], false);
    if (!files.length) return;
    try {
      const json = JSON.parse(await files[0].text()) as O3stFile;
      if (json.format !== "o3st") throw new Error("Bestand is geen .o3st");
      setFile(json);
      setMessage(`Geladen: ${json.name}`);
    } catch (err) {
      setMessage(`Kon .o3st niet lezen: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function saveFile() {
    await saveFileAs(JSON.stringify(file, null, 2), `${file.id}.o3st`, [
      { name: "Open 3D Studio-template", extensions: ["o3st"] },
    ]);
    setMessage(`Opgeslagen als ${file.id}.o3st`);
  }

  function registerNow() {
    try {
      loadO3stTemplate(file);
      setMessage(`Template "${file.name}" geladen — verschijnt nu in de dropdown.`);
      props.onSaved();
    } catch (err) {
      setMessage(`Registreren mislukt: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function importFromExisting(id: string) {
    try {
      const t = getTemplate(id);
      const shape: ShapeSpec = t.materialLayers && t.materialLayers.length > 0
        ? { kind: "layered", heightParam: "hoogte" }
        : t.profileSpec
          ? { kind: "profile-swept" }
          : { kind: "solid-box", depthParam: "diepte", heightParam: "hoogte" };
      setFile(templateToO3st(t, shape));
      setMessage(`Overgenomen van ${t.name} — pas aan en sla op als nieuw id.`);
    } catch (err) {
      setMessage(String(err));
    }
  }

  return (
    <div className="modal-overlay" onClick={props.onClose}>
      <div className="modal template-editor" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <h2>Template-editor (.o3st)</h2>
        <p className="muted">
          Bouw een eigen componenttemplate en deel het als bestand. Alleen data —
          geen code — dus veilig te installeren.
        </p>
        <div className="btn-row">
          <button className="mini" onClick={importFile}>Openen .o3st …</button>
          <button className="mini" onClick={saveFile}>Opslaan als .o3st …</button>
          <button className="mini accent" onClick={registerNow}>Toevoegen aan catalogus</button>
        </div>
        <label className="param-row">
          <span>Basis op bestaand template</span>
          <select
            defaultValue=""
            onChange={(e) => e.target.value && importFromExisting(e.target.value)}
          >
            <option value="">— kies er één —</option>
            <option value="hsb-buitenwand">HSB-buitenwand</option>
            <option value="prefab-betonwand">Prefab betonwand</option>
            <option value="plat-dak">Plat dak</option>
            <option value="staalprofiel-nen10365">Staalprofiel</option>
          </select>
        </label>
        <div className="grid-two">
          <label className="param-row"><span>ID (uniek)</span>
            <input value={file.id} onChange={(e) => patch("id", e.target.value)} />
          </label>
          <label className="param-row"><span>Naam</span>
            <input value={file.name} onChange={(e) => patch("name", e.target.value)} />
          </label>
          <label className="param-row"><span>Categorie</span>
            <input value={file.category} onChange={(e) => patch("category", e.target.value)} />
          </label>
          <label className="param-row"><span>Fabrikant</span>
            <input value={file.manufacturer ?? ""} onChange={(e) => patch("manufacturer", e.target.value || undefined)} />
          </label>
          <label className="param-row"><span>IFC-entiteit</span>
            <select value={file.ifcEntity} onChange={(e) => patch("ifcEntity", e.target.value)}>
              {["IfcWall","IfcSlab","IfcRoof","IfcBeam","IfcColumn","IfcPlate","IfcMember","IfcCovering","IfcRailing","IfcBuildingElementProxy"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="param-row"><span>PredefinedType</span>
            <input value={file.ifcPredefinedType ?? ""} onChange={(e) => patch("ifcPredefinedType", e.target.value || undefined)} />
          </label>
          <label className="param-row"><span>NL-SfB (xx.xx)</span>
            <input value={file.nlSfb ?? ""} onChange={(e) => patch("nlSfb", e.target.value || undefined)} />
          </label>
          <label className="param-row"><span>Materiaal</span>
            <input value={file.material ?? ""} onChange={(e) => patch("material", e.target.value || undefined)} />
          </label>
          <label className="param-row"><span>Dragend</span>
            <input type="checkbox" checked={!!file.loadBearing} onChange={(e) => patch("loadBearing", e.target.checked)} />
          </label>
          <label className="param-row"><span>Buiten</span>
            <input type="checkbox" checked={!!file.isExternal} onChange={(e) => patch("isExternal", e.target.checked)} />
          </label>
          <label className="param-row"><span>Kleur</span>
            <input type="color" value={file.color ?? "#a49f92"} onChange={(e) => patch("color", e.target.value)} />
          </label>
          <label className="param-row"><span>Shape</span>
            <select
              value={file.shape.kind}
              onChange={(e) => {
                const kind = e.target.value as ShapeSpec["kind"];
                if (kind === "layered") {
                  patch("shape", { kind, heightParam: "hoogte" });
                } else if (kind === "solid-box") {
                  // solid-box leest diepte/hoogte uit params — zorg dat die
                  // parameters bestaan, anders valt o3stToTemplate stil terug
                  // op 300/2800 mm en is de slider onvindbaar voor de gebruiker.
                  const params = [...file.params];
                  const defaults = { ...file.defaults };
                  if (!params.some((p) => p.key === "diepte")) {
                    params.push({ key: "diepte", label: "Diepte", type: "length", min: 50, max: 1500, step: 10 });
                    defaults.diepte = 300;
                  }
                  if (!params.some((p) => p.key === "hoogte")) {
                    params.push({ key: "hoogte", label: "Hoogte", type: "length", min: 200, max: 6000, step: 10 });
                    defaults.hoogte = 2800;
                  }
                  setFile({
                    ...file,
                    params,
                    defaults,
                    shape: { kind, depthParam: "diepte", heightParam: "hoogte" },
                  });
                } else {
                  patch("shape", { kind: "profile-swept" });
                }
              }}
            >
              <option value="layered">layered (opbouwlagen)</option>
              <option value="solid-box">solid-box (rechthoekig volume)</option>
              <option value="profile-swept">profile-swept (extruderen langs profiel)</option>
            </select>
          </label>
        </div>

        <h3>Materiaallagen (voor `layered`)</h3>
        <table className="phase-table">
          <thead>
            <tr>
              <th>Materiaal</th>
              <th>Dikte mm</th>
              <th>λ W/mK</th>
              <th>Categorie</th>
              <th>✕</th>
            </tr>
          </thead>
          <tbody>
            {(file.materialLayers ?? []).map((l, i) => (
              <tr key={i}>
                <td><input value={l.material} onChange={(e) => {
                  const layers = [...(file.materialLayers ?? [])];
                  layers[i] = { ...layers[i], material: e.target.value };
                  patch("materialLayers", layers);
                }} /></td>
                <td><input type="number" style={{ width: 60 }} value={l.thicknessMm} onChange={(e) => {
                  const layers = [...(file.materialLayers ?? [])];
                  layers[i] = { ...layers[i], thicknessMm: Number(e.target.value) };
                  patch("materialLayers", layers);
                }} /></td>
                <td><input type="number" step={0.001} style={{ width: 70 }} value={l.lambda ?? ""} onChange={(e) => {
                  const layers = [...(file.materialLayers ?? [])];
                  const v = e.target.value === "" ? undefined : Number(e.target.value);
                  layers[i] = { ...layers[i], lambda: v };
                  patch("materialLayers", layers);
                }} /></td>
                <td>
                  <select value={l.category ?? ""} onChange={(e) => {
                    const layers = [...(file.materialLayers ?? [])];
                    layers[i] = { ...layers[i], category: e.target.value as any || undefined };
                    patch("materialLayers", layers);
                  }}>
                    <option value="">–</option>
                    <option value="structure">structure</option>
                    <option value="insulation">insulation</option>
                    <option value="cladding">cladding</option>
                    <option value="finish">finish</option>
                    <option value="membrane">membrane</option>
                    <option value="cavity">cavity</option>
                  </select>
                </td>
                <td>
                  <button className="mini" onClick={() => {
                    patch("materialLayers", (file.materialLayers ?? []).filter((_, j) => j !== i));
                  }}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="btn-row">
          <button className="mini" onClick={() => {
            patch("materialLayers", [
              ...(file.materialLayers ?? []),
              { material: "Nieuw materiaal", thicknessMm: 50 },
            ]);
          }}>Laag toevoegen</button>
        </div>

        {message && <p className="muted">{message}</p>}
        <div className="btn-row">
          <button className="mini" onClick={props.onClose}>Sluiten</button>
        </div>
      </div>
    </div>
  );
}
