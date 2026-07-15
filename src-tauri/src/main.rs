// Open 3D Studio — desktop-schil (Tauri v2)
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::{engine::general_purpose::STANDARD, Engine};

/// 8 MB binaire chunks: voorkomt de V8-stringlimiet bij grote IFC-bestanden.
const CHUNK: usize = 8 * 1024 * 1024;

/// Leest een bestand als base64-chunks. `async` zodat de UI-thread vrij blijft.
#[tauri::command]
async fn read_file_b64_chunks(path: String) -> Result<Vec<String>, String> {
    let bytes =
        std::fs::read(&path).map_err(|e| format!("Lezen van {path} mislukt: {e}"))?;
    Ok(bytes.chunks(CHUNK).map(|c| STANDARD.encode(c)).collect())
}

/// Schrijft base64-chunks naar een bestand. `async` zodat de UI-thread vrij blijft.
#[tauri::command]
async fn write_file_b64_chunks(path: String, chunks: Vec<String>) -> Result<(), String> {
    let mut out: Vec<u8> = Vec::new();
    for chunk in chunks {
        out.extend(
            STANDARD
                .decode(chunk)
                .map_err(|e| format!("Ongeldige bestandsinhoud: {e}"))?,
        );
    }
    std::fs::write(&path, out).map_err(|e| format!("Schrijven naar {path} mislukt: {e}"))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            read_file_b64_chunks,
            write_file_b64_chunks
        ])
        .run(tauri::generate_context!())
        .expect("fout bij het starten van Open 3D Studio");
}
