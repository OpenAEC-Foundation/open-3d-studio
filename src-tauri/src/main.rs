// Open 3D Studio — desktop-schil (Tauri v2)
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::{engine::general_purpose::STANDARD, Engine};

/// Leest een bestand en geeft het terug als base64 (voor IFC/DXF/projectbestanden).
#[tauri::command]
fn read_file_b64(path: String) -> Result<String, String> {
    std::fs::read(&path)
        .map(|bytes| STANDARD.encode(bytes))
        .map_err(|e| format!("Lezen van {path} mislukt: {e}"))
}

/// Schrijft base64-inhoud naar een bestand (voor exports en projectbestanden).
#[tauri::command]
fn write_file_b64(path: String, contents: String) -> Result<(), String> {
    let bytes = STANDARD
        .decode(contents)
        .map_err(|e| format!("Ongeldige bestandsinhoud: {e}"))?;
    std::fs::write(&path, bytes).map_err(|e| format!("Schrijven naar {path} mislukt: {e}"))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![read_file_b64, write_file_b64])
        .run(tauri::generate_context!())
        .expect("fout bij het starten van Open 3D Studio");
}
