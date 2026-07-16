# Third-party licenties — Open 3D Studio

Open 3D Studio is uitgegeven onder de MIT-licentie. Deze notice-lijst geeft
weer welke open-source componenten in de gedistribueerde binary of website
worden meegeleverd of aangeroepen.

## Rust / desktop (`src-tauri/`)

| Component | Licentie | Doel |
|---|---|---|
| `tauri` | Apache-2.0 / MIT | Desktop-omhulling |
| `tauri-plugin-dialog` | Apache-2.0 / MIT | Native open/save-dialogen |
| `base64` | Apache-2.0 / MIT | IFC-chunked file-IO |
| `serde` | Apache-2.0 / MIT | Command-parameter serialisatie |
| `acadrust` (v0.4-Sprint 9) | **MPL-2.0** | DWG-export (AutoCAD 2013/2018) |

**Over `acadrust` en MPL-2.0.** DWG-export gebruikt `acadrust` van Hakan Aktt.
MPL-2.0 is een file-level copyleft: de MIT-status van Open 3D Studio blijft
behouden — alleen eventuele patches aan `acadrust`-bestanden zelf moeten
onder MPL-2.0 beschikbaar blijven. Ons beleid: patches altijd upstream
indienen, niet forken.

## Web / front-end (`src/`, `node_modules/`)

| Component | Licentie | Doel |
|---|---|---|
| `@thatopen/components` | MIT | 3D-viewer, camera, fragments-manager |
| `@thatopen/components-front` | MIT | Highlighter, ClipEdges |
| `@thatopen/fragments` | MIT | IFC-fragments, native raycast |
| `web-ifc` | MPL-2.0 | IFC4-lezen/schrijven |
| `three` | MIT | 3D-rendering |
| `jspdf` | MIT | PDF-sheet-export |
| `react` / `react-dom` | MIT | UI-framework |
| `vite` | MIT | Build-tooling |

## Data / standaarden

| Bron | Licentie / voorwaarden |
|---|---|
| NL-SfB Tabel 1 | Open, via modelleerafspraken.nl |
| BIM basis ILS v2 | Open, via digiGO |
| NEN-EN 10365 profieldata (staal) | Referentie — vrij te gebruiken maten |
| NEN 2580 | Nederlands norm — implementatie van de rekenregels is vrij |
| IFC4 (buildingSMART) | Open, via standards.buildingsmart.org |
| bSDD API | Open, gratis gebruik via api.bsdd.buildingsmart.org |
| BCF 3.0 (buildingSMART) | Open, via github.com/buildingSMART/BCF-XML |
