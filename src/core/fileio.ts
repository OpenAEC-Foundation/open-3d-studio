/** Bestandsafhandeling die zowel in de browser als in de Tauri-desktopapp werkt.
 *
 * - Desktop (Tauri): native "Openen"/"Opslaan als"-vensters via de dialog-plugin;
 *   lezen/schrijven via Rust-commando's (base64 over de brug).
 * - Web: <input type="file"> en blob-downloads.
 */

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface FileFilter {
  name: string;
  extensions: string[];
}

/** 8 MB per chunk (afgestemd op de Rust-kant): voorkomt de V8-stringlimiet
 *  en houdt het geheugengebruik bij grote IFC-bestanden beheersbaar. */
const CHUNK_BYTES = 8 * 1024 * 1024;

function b64encode(bytes: Uint8Array): string {
  let bin = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    bin += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(bin);
}

function b64encodeChunks(bytes: Uint8Array): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK_BYTES) {
    chunks.push(b64encode(bytes.subarray(i, i + CHUNK_BYTES)));
  }
  return chunks.length > 0 ? chunks : [""];
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Slaat data op via "Opslaan als" (desktop) of als download (web).
 *  Geeft false terug als de gebruiker annuleert. */
export async function saveFileAs(
  data: Uint8Array | string,
  suggestedName: string,
  filters: FileFilter[],
): Promise<boolean> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  if (isTauri) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const path = await save({ defaultPath: suggestedName, filters });
    if (!path) return false;
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("write_file_b64_chunks", { path, chunks: b64encodeChunks(bytes) });
    return true;
  }
  const blob = new Blob([bytes as unknown as BlobPart]);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = suggestedName;
  a.click();
  URL.revokeObjectURL(a.href);
  return true;
}

/** Opent bestanden via een native venster (desktop) of file-input (web). */
export async function openFilesDialog(
  filters: FileFilter[],
  multiple = true,
): Promise<File[]> {
  if (isTauri) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selection = await open({ multiple, filters });
    if (!selection) return [];
    const paths = Array.isArray(selection) ? selection : [selection];
    const { invoke } = await import("@tauri-apps/api/core");
    const files: File[] = [];
    for (const path of paths) {
      const chunks = await invoke<string[]>("read_file_b64_chunks", { path });
      const name = path.replace(/^.*[\\/]/, "");
      files.push(new File(chunks.map((c) => b64decode(c)) as unknown as BlobPart[], name));
    }
    return files;
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = multiple;
    input.accept = filters.flatMap((f) => f.extensions.map((e) => `.${e}`)).join(",");
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.oncancel = () => resolve([]); // annuleren laat de Promise niet hangen
    input.click();
  });
}
