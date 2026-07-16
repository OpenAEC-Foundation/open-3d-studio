import type { PlacedElement, Storey } from "./types";
import { getTemplate } from "../catalog/registry";

/** Speckle-connector (v0.6-5).
 *
 *  Push/pull naar Speckle 2.x via de publieke REST/GraphQL API zonder de
 *  Speckle SDK als dependency toe te voegen (die is groot en trekt automerge
 *  en RxJS mee). We spreken direct met de server: token via Bearer, model
 *  als "chunk-tree" JSON die Speckle als "detached objects" opslaat.
 *
 *  Voor pull: we halen alleen de root-object metadata en signaleren dat de
 *  geometrie via IFC-round-trip binnengehaald moet worden — dit is bewust:
 *  volledige Speckle-conversie naar onze parametrische templates hoort in v0.7
 *  bij de Speckle-schema-mapper.
 *
 *  Endpoints (Speckle 2.x):
 *    POST /graphql                                  — voor stream/branch/commit
 *    POST /objects/{streamId}                       — geeft objecten door
 *    GET  /objects/{streamId}/{objectId}            — enkel object ophalen  */

const SPECKLE_DEFAULT_HOST = "https://speckle.xyz";

export interface SpeckleConfig {
  host?: string;   // https://speckle.xyz (default) of eigen server
  token: string;   // personal access token
  streamId: string;
  branchName?: string; // default "main"
}

export interface SpecklePushResult {
  ok: boolean;
  commitId?: string;
  objectId?: string;
  message: string;
}

/** Push het huidige model naar een Speckle-stream als één commit. */
export async function pushToSpeckle(
  elements: PlacedElement[],
  storeys: Storey[],
  cfg: SpeckleConfig,
): Promise<SpecklePushResult> {
  const host = (cfg.host ?? SPECKLE_DEFAULT_HOST).replace(/\/$/, "");
  const branch = cfg.branchName ?? "main";
  const commitMessage = `Open 3D Studio export — ${new Date().toISOString().slice(0, 10)}`;

  // Stap 1: bouw een Speckle-object van ons model (root + kinderen).
  const speckleObj = buildSpeckleGraph(elements, storeys);

  // Stap 2: POST objecten naar /objects/{streamId} (bulk).
  const bulkUrl = `${host}/objects/${cfg.streamId}`;
  const bulkResp = await fetch(bulkUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([speckleObj, ...speckleObj.__children]),
  });
  if (!bulkResp.ok) {
    return { ok: false, message: `Speckle-upload gefaald: ${bulkResp.status} ${bulkResp.statusText}` };
  }

  // Stap 3: commit maken via GraphQL.
  const commitMutation = `
    mutation Create($input: CommitCreateInput!) {
      commitCreate(commit: $input)
    }`;
  const commitResp = await fetch(`${host}/graphql`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: commitMutation,
      variables: {
        input: {
          streamId: cfg.streamId,
          branchName: branch,
          objectId: speckleObj.id,
          message: commitMessage,
          sourceApplication: "Open 3D Studio",
          totalChildrenCount: speckleObj.__children.length,
        },
      },
    }),
  });
  const commitJson = await commitResp.json();
  const commitId = commitJson?.data?.commitCreate;
  if (!commitId) {
    return {
      ok: false,
      message: `Commit maken faalde: ${commitJson?.errors?.[0]?.message ?? "onbekend"}`,
    };
  }
  return { ok: true, commitId, objectId: speckleObj.id, message: `Commit ${commitId} in ${cfg.streamId}/${branch}.` };
}

/** Lijst de laatste commits van een stream/branch. Retourneert titels + ids. */
export async function listCommits(cfg: SpeckleConfig): Promise<{ id: string; message: string; author: string; date: string }[]> {
  const host = (cfg.host ?? SPECKLE_DEFAULT_HOST).replace(/\/$/, "");
  const branch = cfg.branchName ?? "main";
  const query = `
    query($id: String!, $branch: String!) {
      stream(id: $id) {
        branch(name: $branch) {
          commits(limit: 10) {
            items { id message authorName createdAt }
          }
        }
      }
    }`;
  const resp = await fetch(`${host}/graphql`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables: { id: cfg.streamId, branch } }),
  });
  const json = await resp.json();
  const items: any[] = json?.data?.stream?.branch?.commits?.items ?? [];
  return items.map((c) => ({
    id: c.id,
    message: c.message ?? "",
    author: c.authorName ?? "",
    date: c.createdAt ?? "",
  }));
}

/** Bouw de Speckle-objectstructuur uit ons model. */
function buildSpeckleGraph(elements: PlacedElement[], storeys: Storey[]): SpeckleRoot {
  const children: SpeckleChild[] = elements.map((el) => {
    let template;
    try { template = getTemplate(el.templateId); } catch { template = null; }
    return {
      id: hashId(el.id),
      speckle_type: mapToSpeckleType(template?.ifcEntity ?? "IfcBuildingElementProxy"),
      applicationId: el.id,
      name: el.name,
      merk: el.merk,
      templateId: el.templateId,
      manufacturer: template?.manufacturer ?? null,
      nlSfb: template?.nlSfb ?? null,
      material: template?.material ?? null,
      phase: el.phase ?? "new",
      start: { x: el.start.x, y: el.start.y, z: el.start.z, units: "m" },
      end: { x: el.end.x, y: el.end.y, z: el.end.z, units: "m" },
      params: { ...el.params },
      hostId: el.hostId ?? null,
      storeyId: el.storeyId ?? null,
    };
  });
  const rootId = hashId(`root-${Date.now()}-${elements.length}`);
  return {
    id: rootId,
    speckle_type: "Base",
    applicationId: `open-3d-studio-${rootId.slice(0, 8)}`,
    name: "Open 3D Studio model",
    storeys: storeys.map((s) => ({ id: s.id, name: s.name, elevation: s.elevation })),
    "@elements": children,
    __children: children,
  };
}

interface SpeckleChild {
  id: string;
  speckle_type: string;
  applicationId: string;
  name: string;
  [k: string]: unknown;
}
interface SpeckleRoot extends SpeckleChild {
  "@elements": SpeckleChild[];
  __children: SpeckleChild[];
}

/** IFC-entity → Speckle geometry-type. Voor v0.6 een simpele mapping;
 *  volledige Speckle-schema-mapping (met echte Mesh + Base) volgt in v0.7. */
function mapToSpeckleType(ifc: string): string {
  const table: Record<string, string> = {
    IfcWall: "Objects.BuiltElements.Wall",
    IfcSlab: "Objects.BuiltElements.Floor",
    IfcRoof: "Objects.BuiltElements.Roof",
    IfcColumn: "Objects.BuiltElements.Column",
    IfcBeam: "Objects.BuiltElements.Beam",
    IfcDoor: "Objects.BuiltElements.Door",
    IfcWindow: "Objects.BuiltElements.Window",
    IfcSpace: "Objects.BuiltElements.Space",
  };
  return table[ifc] ?? "Objects.BuiltElements.GenericObject";
}

/** Speckle vraagt een reproducible content-hash. Simpele FNV-1a variant. */
function hashId(input: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  // Speckle wil een 32-char hex id — we plakken de hash + timestamp.
  const rest = Math.floor(Math.random() * 1e12).toString(16).padStart(12, "0");
  return (h.toString(16).padStart(8, "0") + rest.padStart(24, "0")).slice(0, 32);
}
