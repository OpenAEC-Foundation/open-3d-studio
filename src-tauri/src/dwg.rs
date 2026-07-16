//! DWG-export via `acadrust` (MPL-2.0, Rust).
//!
//! Zelfde bibliotheek die Open CAD Studio onder de OpenAEC-vlag gebruikt.
//! MPL-2.0 is file-level copyleft: de MIT-licentie van Open 3D Studio blijft
//! intact — alleen eventuele patches aan `acadrust`-bronbestanden moeten
//! onder MPL-2.0 beschikbaar blijven. Beleid: patches altijd upstream indienen.
//!
//! Flow: DxfReader parseert het DXF dat de front-end levert, `DwgWriter`
//! schrijft dat vervolgens weg als AutoCAD 2013 (AC1027) of 2018 (AC1032).
//!
//! Zie NOTICE.md en PLAN.md § v0.4-Sprint 9.

use std::io::Cursor;

use acadrust::types::DxfVersion;
use acadrust::{DwgWriter, DxfReader};

#[derive(Debug, Clone, Copy, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum DwgVersion {
    /// AC1027 — AutoCAD 2013 (default, universeel geaccepteerd).
    R2013,
    /// AC1032 — AutoCAD 2018 (nog experimenteel bij acadrust).
    R2018,
}

impl DwgVersion {
    fn as_acadrust(self) -> DxfVersion {
        match self {
            DwgVersion::R2013 => DxfVersion::AC1027,
            DwgVersion::R2018 => DxfVersion::AC1032,
        }
    }
}

/// Converteert DXF-inhoud naar DWG en schrijft weg naar het opgegeven pad.
///
/// De front-end levert DXF-tekst (uit `dxfExport.ts`); we parsen dat met
/// `DxfReader::from_reader`, zetten `doc.version`, en schrijven weg via
/// `DwgWriter::write_to_vec`. Fouten worden als leesbare strings teruggegeven.
#[tauri::command]
pub async fn export_dwg(
    dxf_content: String,
    target_version: DwgVersion,
    out_path: String,
) -> Result<(), String> {
    let mut doc = DxfReader::from_reader(Cursor::new(dxf_content.into_bytes()))
        .map_err(|e| format!("DXF-parsen mislukt: {e}"))?
        .read()
        .map_err(|e| format!("DXF-lezen mislukt: {e}"))?;

    doc.version = target_version.as_acadrust();

    let bytes = DwgWriter::write_to_vec(&doc)
        .map_err(|e| format!("DWG-schrijven mislukt: {e}"))?;

    std::fs::write(&out_path, bytes)
        .map_err(|e| format!("Bestand schrijven naar {out_path} mislukt: {e}"))?;

    Ok(())
}
