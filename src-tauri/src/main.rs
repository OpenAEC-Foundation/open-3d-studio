// Open 3D Studio — desktop-schil (Tauri v2)
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("fout bij het starten van Open 3D Studio");
}
