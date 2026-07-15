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

function b64encode(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
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
    await invoke("write_file_b64", { path, contents: b64encode(bytes) });
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
      const b64 = await invoke<string>("read_file_b64", { path });
      const name = path.replace(/^.*[\\/]/, "");
      files.push(new File([b64decode(b64) as unknown as BlobPart], name));
    }
    return files;
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = multiple;
    input.accept = filters.flatMap((f) => f.extensions.map((e) => `.${e}`)).join(",");
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.click();
  });
}
