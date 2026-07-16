/** BCF 3.0 import — round-trip met constructeur/installateur.
 *
 *  BCF-XML volgt de specificatie van buildingSMART:
 *  https://github.com/buildingSMART/BCF-XML/tree/release_3_0
 *
 *  Formaat: een `.bcfzip` bestand bevat per issue een map met `markup.bcf`
 *  (XML), `viewpoint.bcfv` en optionele `snapshot.png`. Deze module levert het
 *  datamodel en de parse-hulpfuncties; de daadwerkelijke ZIP-uitpak-stap
 *  gebruikt de browser-native `DecompressionStream` waar mogelijk of `jszip`
 *  wanneer die als dep is toegevoegd (nog te doen — dan is de import volledig
 *  functioneel).
 *
 *  Zie {@link bcfExport} voor de export-kant (`bcfExport.ts`). */

export interface BcfViewpoint {
  guid: string;
  cameraPosition?: { x: number; y: number; z: number };
  cameraDirection?: { x: number; y: number; z: number };
  cameraUp?: { x: number; y: number; z: number };
}

export interface BcfComment {
  guid: string;
  date: string;
  author?: string;
  text: string;
}

export interface BcfTopic {
  guid: string;
  title: string;
  status: "Open" | "InProgress" | "Closed" | "Resolved" | string;
  priority?: string;
  assignedTo?: string;
  creationDate?: string;
  description?: string;
  viewpoints: BcfViewpoint[];
  comments: BcfComment[];
}

/** Parse één `markup.bcf` XML-fragment naar een BcfTopic. */
export function parseMarkupXml(xml: string): BcfTopic | null {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const parseErr = doc.querySelector("parsererror");
  if (parseErr) return null;
  const topicEl = doc.querySelector("Topic");
  if (!topicEl) return null;

  const t = (sel: string): string | undefined =>
    topicEl.querySelector(sel)?.textContent ?? undefined;

  const guid = topicEl.getAttribute("Guid") ?? crypto.randomUUID();
  const status = topicEl.getAttribute("TopicStatus") ?? "Open";
  const title = t("Title") ?? "(zonder titel)";

  const comments: BcfComment[] = [];
  for (const c of Array.from(doc.querySelectorAll("Comment"))) {
    comments.push({
      guid: c.getAttribute("Guid") ?? crypto.randomUUID(),
      date: c.querySelector("Date")?.textContent ?? "",
      author: c.querySelector("Author")?.textContent ?? undefined,
      text: c.querySelector("Comment")?.textContent ?? "",
    });
  }

  const viewpoints: BcfViewpoint[] = [];
  for (const v of Array.from(doc.querySelectorAll("Viewpoints"))) {
    viewpoints.push({
      guid: v.getAttribute("Guid") ?? crypto.randomUUID(),
    });
  }

  return {
    guid,
    title,
    status,
    priority: t("Priority"),
    assignedTo: t("AssignedTo"),
    creationDate: t("CreationDate"),
    description: t("Description"),
    viewpoints,
    comments,
  };
}

/** Leest een `.bcfzip` uit en levert alle topics. */
export async function importBcfZip(bytes: ArrayBuffer): Promise<BcfTopic[]> {
  const mod = await import("jszip");
  const JSZip: any = mod.default ?? mod;
  const zip = await JSZip.loadAsync(bytes);
  const topics: BcfTopic[] = [];
  for (const [name, entry] of Object.entries(zip.files) as Array<[string, any]>) {
    if (!name.toLowerCase().endsWith("markup.bcf")) continue;
    if (entry.dir) continue;
    const xml = await entry.async("string");
    const topic = parseMarkupXml(xml);
    if (topic) topics.push(topic);
  }
  return topics;
}
