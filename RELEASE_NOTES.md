# Open 3D Studio v0.4.0-rc — bibliotheek + productie-diepgang

Vanuit twee overleg-sessies met Martijn (2026-07-15) zijn negen sprints doorgelopen die
Open 3D Studio van "demo met Storax-onderdelen" naar **openBIM-native modelleergereedschap**
voor de Nederlandse bouw brengen. Aanvullend zijn de resterende productie-slagen doorgevoerd
zodat elke geplaatste template correct als IFC4 exporteert.

## Fase Nul (blokkerend uit eerste overleg)

- **Muis-selectie op geladen IFC** — `@thatopen/fragments` `model.raycast()` +
  `model.highlight()` met een amber highlight-materiaal. Selectie op zelfgetekende
  Storax-elementen blijft synchroon werken; klik in de leegte deselecteert beide.
- **setPointerCapture** in `pointerdown`, `pointerup` verhuisd naar het canvas — de
  fragile `e.target !== dom`-check kon zonder verlies weg. Klik met 3 px drift blijft
  selecteren; drift > 5 px wordt camera-drag.
- **Preview-Group `raycast = () => {}`** — de tekenmodus-preview eet klik-events niet
  meer op.
- **Undo/Redo-knoppen in de header** (QAT-model, links naast de badge), Ctrl+Z/Y-tooltips,
  op één lijn met het brand-mark.

## v0.4-Sprint 1 — Architectuur-refactor

- **`types.ts` uitgebreid** met `PlacementKind` (`linear` | `point` | `surface` | `assembly`),
  `MaterialLayer[]`, `ProfileSpec` (10 IFC-profieldef-shapes), `IfcEntityName` union van
  18 entiteiten (was 3), `ifcPredefinedType` + `ifcObjectType`, `hostId` + `spaceId` +
  `phase` op `PlacedElement`, `visibleWhen` + `formula` op `ParamDef`, `classification`
  voor bSDD.
- **`src/core/psetFactories.ts`** — 15 Common-Pset-factories per IFC-entiteit
  (WallCommon, SlabCommon, …, WindowCommon) met sensible defaults. Templates leveren
  alleen wat afwijkt via de optionele `commonPset()`-hook.
- **`src/catalog/registry.ts`** — `import.meta.glob("./**/*.tpl.ts", { eager: true })`
  autoload. Nieuwe templates verschijnen automatisch in `templates`,
  `templatesByNlSfb()` en `templatesByManufacturer()`. Duplicaat-id's krijgen een warning.

## v0.4-Sprints 2 t/m 8 — 33 nieuwe templates

- **NL-SfB 21 Buitenwanden** — HSB-buitenwand, prefab betonwand sandwich, staalframe SFS.
- **NL-SfB 22 Binnenwanden** — Silka lijmwand, Ytong cellenbeton, metal-stud gips
  (plus de 3 bestaande Storax-templates).
- **NL-SfB 23 Vloeren** — VBI kanaalplaat (5 diktes), breedplaat, HSB-vloer,
  staalplaatbeton, MV-plaat.
- **NL-SfB 24 Trappen** — rechte trap + 2-kwart-trap (eerste multi-entiteit
  `AssemblyTemplate` proof-of-concept, enum-strings `STRAIGHT_RUN_STAIR` en
  `QUARTER_TURN_STAIR` conform IFC4).
- **NL-SfB 27 Daken** — plat dak met bitumen+ballast, hellend HSB-dak, prefab dakelement.
- **NL-SfB 28 Hoofddraagconstructie** — **één staaltemplate levert 300+ profielen**
  via `ProfileSpec` (IPE 80–600, HEA/HEB/HEM 100–1000, UNP, SHS/RHS, CHS, L),
  prefab betonkolom/-ligger, glulam-kolom/-ligger.
- **NL-SfB 31/32 Openingen** — kozijn draai-kiep, vast raam, dakraam Velux MK06,
  voordeur, binnendeur, brandwerende deur EI30/60/90.
- **NL-SfB 34 Balustrades** — spijlleuning, glasbalustrade met RVS-handregel.
- **NL-SfB 16/17 Fundering** — strookfundering, poer, prefab betonpaal.
- **NL-SfB 41/43/45 Afwerkingen** — baksteen halfsteens, systeemplafond 600×600,
  dekvloer zwevend, ETICS-gevelisolatie.
- **NL-SfB 90 Ruimten** — `IfcSpace` met NEN 2580-basisberekening
  (`src/core/nen2580.ts`) inclusief regel "vrije hoogte < 1,5 m telt niet mee" en
  liftschacht/trapgat ≥ 4 m² aftrek.
- **Fasering** (`existing`/`new`/`demolished`/`temporary`) — data-shape en UI-selector
  in het selected-panel; elke nieuwe plaatsing default op `new`.

## v0.4-Sprint 9 — DWG, bSDD, BCF, conditional

- **DWG-export via `acadrust` 0.4.1** (MPL-2.0, Rust). `src-tauri/src/dwg.rs`
  Tauri-command met `DxfReader::from_reader` → `DwgWriter::write_to_vec`. Default
  `AC1027` (AutoCAD 2013), `AC1032` (AutoCAD 2018) als "experimental". Front-end valt
  netjes terug op DXF wanneer we buiten Tauri draaien.
- **bSDD-picker** (`src/ui/BsddPicker.tsx`) — REST-call naar
  `api.bsdd.buildingsmart.org`; bij netwerkfout of leeg resultaat lokale NL-SfB
  tabel 1 (17 categorieën) als offline-fallback.
- **BCF 3.0 import** — `src/core/bcfImport.ts` met `jszip` uitpakker en
  `markup.bcf`-XML-parser. Ribbon-knop "BCF importeren" in de Kwaliteit-groep.
- **Conditional geometry** — `visibleWhen` en `formula` op `ParamDef` gerespecteerd
  door `ParamsPanel` en beschikbaar voor `solids()`.

## Productie-diepgang

- **Generieke IFC-entity-mapper** (`src/core/ifcEntityMap.ts`) — 18 entiteiten met
  hun juiste constructor, `PredefinedType`-enum en Common-Pset-naam. Voor
  `IfcDoor`/`IfcWindow` worden `OverallHeight`/`OverallWidth` automatisch uit de
  solids-envelope berekend; `IfcPile` krijgt `ConstructionType`; `IfcSpace` krijgt
  `CompositionType`; `IfcElementAssembly` krijgt `AssemblyPlace`.
- **`IfcMaterialLayerSetUsage`** — templates met `materialLayers` (KZS, spouwmuur,
  HSB, dakopbouw) exporteren nu als echte gelaagde IFC-materialen, gekoppeld via
  `IfcRelAssociatesMaterial`.
- **`IfcMaterialProfileSetUsage`** — templates met `profileSpec` (staal, glulam,
  betonprofiel) exporteren als `IfcIShapeProfileDef` / `IfcRectangleHollowProfileDef` /
  `IfcCircleProfileDef` / etc. met de juiste NEN-EN 10365 afmetingen.
- **`IfcRelFillsElement`** — kozijnen en deuren die tijdens plaatsing een host-wand
  hebben gekregen (`findHostAt()` bij `commitComponent`) exporteren als
  `IfcOpeningElement` in de wand + `IfcRelVoidsElement` + `IfcRelFillsElement`.
- **Common-Pset-writer** — string-, number- én boolean-props worden nu correct
  als `IfcLabel` / `IfcReal` / `IfcBoolean` geëncodeerd (was: alles gedwongen naar
  `IfcBoolean`, wat bv. `FireRating: "REI60"` brak).
- **Point-placement in de commit-flow** — templates met `placementKind: "point"`
  (kolom, poer, paal, dakraam) plaatsen met één klik; minimum-lengte-check wordt
  overgeslagen.
- **ClipEdges** uit `@thatopen/components-front` op de bestaande
  `renderer.clippingPlanes`-flow — echte 2D-poly-lijnen op de snijkant met amber
  lijnstyle (`#D97706`). Netjes disposed bij `clearSection`.
- **Sheet-preview MVP** — `src/ui/SheetPreview.tsx` toont het papiervel op ware
  verhouding met sleepbare viewports (5 mm snap) die live PNG-thumbnails van de
  actieve 3D-view weergeven. `SheetViewport` uitgebreid met
  `paper_x/y/w/h_mm`-coördinaten (backwards-compatible fallback naar auto-grid).

## Test-bewijs (dev-server)

- Type-check: **`tsc --noEmit` clean over alle modules**.
- Runtime-tests: **10 verschillende IFC-entiteiten** (wall/slab/roof/stair/footing/beam/
  window/door/railing/covering) exporteren tot **63,7 KB IFC4-bestand** dat door de
  eigen `web-ifc` reader herleesbaar is.
- **NEN 2580 rekenkern**: rechthoek 5×4 = 20 m² correct; CV-hok met vrije hoogte
  1,2 m telt niet mee (correcte aftrek van bruto-oppervlak).
- **Hosting-flow**: kozijn midden op 5 m wand → `hostId` matcht wand-id; identiek
  raam op 20 m afstand → `hostId = null`.
- **Undo/Redo via header-knop** wijzigt element-count met ±1.
- **Cargo check** compileert de complete Tauri-backend inclusief `acadrust`.

## Nog uitgesteld tot v0.5

- Volledige round-trip van sheets/viewports/dimensies als `IfcAnnotation` (datamodel-doc
  geschreven; implementatie in v0.5 samen met IDS-engine).
- IDS-input engine — buildingSMART XML-parser + generieke rule-engine over IFC-tree.
- Sheet-views met callout-verwijzing en associatieve maatvoering.
- Structural view IFC-export voor Scia/RFEM round-trip.
- Rc/U-waarde in `Pset_MaterialThermal` met ILS-check op Bbl-minima.
- COBie-export en ILS O&E-templates.

---

# Open 3D Studio v0.3.1 — ultracode-hersteld

Alle **32 bevestigde bevindingen** uit de multi-agent ultracode-controle van v0.3.0
(108 agents: 6 onderzoeksdimensies, elke bevinding adversarieel geverifieerd door
3 onafhankelijke controleurs) zijn in deze release opgelost en per faalscenario hertest.

## Belangrijkste fixes

**DXF-import**
- Bogen > 180° (bulge > 1) kregen hun middelpunt aan de verkeerde kant van de koorde
- Geroteerde/geschaalde blokverwijzingen (INSERT) stonden verkeerd doordat het
  basispunt niet mee-transformeerde — de import werkt nu met affiene matrices,
  wat ook geneste en gespiegelde blokken correct maakt
- Ellipsbogen die parameter 0 kruisen draaiden om

**Modelleren & undo**
- IFC heropenen herstelt nu ook de verdiepingsindeling (naam + peil worden
  meegeschreven en teruggelezen)
- Draaien en lengte wijzigen maken nu een undo-stap aan; gethrottlede wijzigingen
  wissen de redo-stack correct; klikken op een al geselecteerd element vervuilt de
  undo-geschiedenis niet meer
- Slepen: geen parallaxsprongen meer (sleepvlak op elementpeil), loslaten buiten het
  canvas laat de camera niet meer vergrendeld achter
- Ctrl+Z in tekstvelden doet tekst-undo, geen model-undo
- Undo synchroniseert nu ook nulpunt/georeferentie met het zijpaneel; deselecteren
  zet het parameterpaneel terug in de pas met de tekeninstellingen
- Het lengteveld corrumpeert getypte waarden niet meer

**IFC & BIM basis ILS**
- Eigen property sets heten nu `Storax_…` — de prefix `Pset_` is gereserveerd voor
  buildingSMART-standaardpsets
- `LoadBearing`/`IsExternal` per template instelbaar; de drager staat op
  LoadBearing=false (systeemdrager, geen hoofddraagconstructie — consistent met NL-SfB 22.21)
- Roosterpaneel: `IfcPlate.USERDEFINED` met ObjectType (CURTAIN_PANEL impliceert vliesgevel)
- IfcTypes krijgen eigen typenummers in plaats van een (soms onjuist) merk
- Merknummering is tekenrichting-onafhankelijk; de ILS-controle toetst nu ook de
  pset-naamgeving en de consistentie dragend/NL-SfB

**Desktop & productie**
- Bestandsoverdracht in 8MB-chunks en asynchrone Rust-commando's: grote IFC's
  crashen of bevriezen de app niet meer; devtools uit in release-builds
- Elementeren: een sparing over een paneelgrens snijdt nu álle betrokken panelen
- BCF-export schrijft een correcte OrthogonalCamera bij 2D-aanzichten
- Een build zonder wasm-bestanden faalt nu hard in plaats van stil een kapotte
  installer op te leveren

## Installatie

Download `Open-3D-Studio_0.3.1_x64-setup.exe` en installeer over de vorige versie heen
(SmartScreen: "Meer informatie" → "Toch uitvoeren").
