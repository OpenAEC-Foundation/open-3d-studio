# Studie & plan — de grote sprong van Open 3D Studio

*Versie 1.3 — juli 2026. Levend document: prioriteiten schuiven op basis van testervaringen.*

> **Stand v0.4.0-rc (2026-07-16)**: alle 9 sprints uit versie 1.2 werkend + de productie-diepgang.
> **40 templates** verspreid over 16 NL-SfB-categorieën, **14 IFC-entiteiten**, alle 4 placement-kinds
> bewezen (linear/point/surface/assembly), **198 constructieprofielen** in de catalogus. IFC-export
> gaat door de generieke entity-mapper met `PredefinedType`, `IfcMaterialLayerSetUsage`,
> `IfcMaterialProfileSetUsage` en `IfcRelFillsElement` voor hosting. DWG-export live via
> `acadrust` 0.4.1 (MPL-2.0) in de Tauri-backend. BCF 3.0 import + export met `jszip`.
> ClipEdges snijlijnen bij doorsnedes. Sheet-preview MVP met SVG-paper en sleepbare viewports.
> Fase Nul (fragments-native selectie via Highlighter + undo/redo in header) was al af.

Dit document analyseert wat Open 3D Studio kan leren van vier gevestigde modelleerpakketten
(Revit, Tekla Structures, HSBcad, Blender/Bonsai), toetst de huidige stand aan de
**BIM basis ILS 2.0** en zet dat om in een gefaseerd plan.

---

## 1. Wat we leren van bestaande modelleerpakketten

### 1.1 Revit — het type/instantie-denken

| Concept | Wat het is | Wat wij overnemen |
|---|---|---|
| **Families → typen → instanties** | Eén parametrische definitie, meerdere vastgelegde typen, geplaatste exemplaren | Onze templates worden **IfcTypes**: parameters splitsen in type-parameters (profiel, opbouw) en instantie-parameters (lengte, peil). Export als `IfcWallType` + `IfcWall` met `IfcRelDefinesByType` |
| **Levels & grids** | Verdiepingen en stramienen als plaatsingsbasis waar alles aan refereert | **Verdiepingenbeheer** (meerdere `IfcBuildingStorey`, ILS-naamgeving "00 begane grond") en **stramienen** (`IfcGrid`) met snappen |
| **Hosting** | Een deur zit ín een wand en verhuist mee | Openingen (`IfcOpeningElement` + `IfcRelVoidsElement`) en deur-/paneeltemplates die aan een wand gekoppeld zijn |
| **Views + schedules als filters op één model** | Aanzichten, doorsnedes en staten lopen live mee | Onze sheets/aantallenlijst doen dit al licht; uitbouwen naar associatieve maatvoering en live stuklijsten op sheets |

*Niet overnemen:* het gesloten bestandsformaat en de alles-in-één-monoliet — precies wat we met IFC-native willen doorbreken.

### 1.2 Tekla Structures — samenstellingen en nummering

| Concept | Wat het is | Wat wij overnemen |
|---|---|---|
| **Assemblies / merken** | Onderdelen gebundeld tot productie-eenheden met automatische **posnummers** (identieke delen krijgen hetzelfde nummer) | Een Storax-wand wordt een **samenstel** (`IfcElementAssembly`) van stijlen, lamellen en dragers; automatische merk-nummering voedt de aantallenlijst en de sheets |
| **Model = bron voor tekeningen en rapporten** | Werkplaatstekeningen worden gegenereerd, niet getekend | Productiebladen per samenstel: automatisch sheet met aanzichten, maten en stuklijst |
| **Detailniveau tot bout en las** | Uitvoeringsgereed modelleren | Voor Storax relevant: bevestigers en ankers als parametrische subonderdelen (later) |

### 1.3 HSBcad — elementeren en productie

| Concept | Wat het is | Wat wij overnemen |
|---|---|---|
| **Elementeren** | Wanden opdelen in transporteerbare/produceerbare panelen met maximale maten | **Elementeer-stap** voor rooster-lamelwanden: automatische opdeling op max. paneelbreedte, met paneelmerken |
| **Productie-uitvoer** | Machinebestanden (CNC/BVX) en legplannen rechtstreeks uit het model | Exportformaat per paneel (eerst CSV-zaag-/zetlijst, later machineformaat in overleg met Storax) |
| **Fabrikant-specifieke bibliotheek** | Het pakket kent de producten van de fabrikant | Onze templatecatalogus is hier al op gebouwd; uitbreiden tot **deelbare componentbibliotheken per fabrikant** |

### 1.4 Blender/Bonsai — IFC-native als principe

| Concept | Wat het is | Wat wij overnemen |
|---|---|---|
| **Het IFC-bestand ÍS het model** | Geen export/import-conversie; openen, bewerken, opslaan van IFC zonder verlies | De stip op de horizon: van "exporteren naar IFC" naar **IFC round-trip** — eigen export heropenen en doorbewerken, daarna ook IFC's van derden kunnen aanpassen |
| **Open source als ecosysteem** | Community-templates, add-ons | Aansluiten op de OpenAEC-suite (BCF Manager, BIM Validator, 2D Studio) in plaats van alles zelf bouwen |

### 1.5 De huidige generatie — stand 2025/2026 (onderzocht juli 2026)

Wat de actuele releases laten zien, en wat dat voor ons betekent:

| Pakket | Actuele stand | Relevantie voor Open 3D Studio |
|---|---|---|
| **Revit 2026** | GPU-versnelde viewport (tech preview), reality-capture-meshes, wanden per ruimte plaatsen, parametrische wapening, fijnmazige zichtbaarheid/kleuring van gekoppelde coördinatiemodellen | Evolutie, geen revolutie — het familie/type-model is onveranderd. Onze federatie-weergave kan leren van hun kleur-/isolatiebediening per gekoppeld model |
| **Tekla Structures 2026** | AI-gestuurde tekeningsjabloon-selectie, cloud-console voor projectinstellingen, vernieuwde tekening-ribbon, model + tekening tegelijk open, Live Collaboration, **Tekla Model Assistant** (agentische AI: modelleren via natuurlijke taal, preview) | Bevestigt onze ribbon- en sheets-richting; agentische AI op een parametrisch model is exact waar onze template-architectuur zich voor leent |
| **hsbcad (2026)** | Jaarlijkse releases (sept.) van hsbDesign for Revit/AutoCAD + hsbMake; hsbShare-cloud; CNC-export per onderdeel, eigen werkplaatstekeningen | Het specialisten-op-platform-model: houtbouwkennis als laag bóven een host. Onze fabrikant-templates (Storax) volgen hetzelfde patroon — met IFC in plaats van Revit als host |
| **Blender/Bonsai 0.8.5** (0.8.6-alpha, juli 2026) | Gestaag door-ontwikkelende open source IFC-native authoring op IfcOpenShell | Blijft het bewijs én de referentie-implementatie voor onze Fase 3 (IFC als werkbestand) |

**De nieuwe generatie ("BIM 2.0", browser-native):**

| Speler | Kern | Les voor ons |
|---|---|---|
| **Qonic** | Cloud/browser, **volledig IFC-native** bewerken; april 2026: geannoteerde plattegronden/doorsnedes rechtstreeks uit IFC; geo-referentie aan nationale stelsels; AI-classificatie van IFC-elementen (buildingSMART-award) | De sterkste validatie van onze koers: IFC-native + browser + tekeningen-uit-model is commercieel levensvatbaar. Geo-referentie (RD-stelsel!) hoort in ons nulpunt-verhaal; AI-classificatie sluit aan op onze ILS-validatie |
| **Snaptrude** | Browser-BIM voor ontwerp; AI genereert BIM-model uit ruimteprogramma; Revit-integratie | Programma-gedreven genereren = onze template-gedachte op gebouwniveau |
| **Arcol / Motif** | Conceptfase in de browser; Motif bouwt "agent-native" vanaf nul (ex-Autodesk-CTO) | De hele nieuwe generatie is web-first en AI-first — onze stack (web + Tauri) zit aan de goede kant van die streep |

**Conclusies voor het plan** (verwerkt in de fasen hieronder):
1. Onze architectuurkeuze (browser-engine + IFC-native + desktop-schil) is dezelfde als die van de best gefinancierde nieuwkomers — doorzetten.
2. **Geo-referentie** (RD-coördinaten/`IfcMapConversion`) toevoegen aan het nulpunt-werk.
3. Een **AI-modelleerassistent** (natuurlijke taal → template-plaatsingen) is voor ons laaghangend fruit: onze componenten zijn al parametrische commando's — toegevoegd aan Fase 4.
4. Tekeningen rechtstreeks uit het model (Qonic) bevestigt de sheets-lijn van Fase 2.

---

## 2. BIM basis ILS 2.0 als meetlat

Bron: [digiGO — BIM basis ILS](https://www.digigo.nu/ilsen-en-richtlijnen/bim-basis-ils/).
Status per eis en wat het plan eraan doet:

| # | ILS-eis | v0.2 | Plan |
|---|---|---|---|
| 1 | IFC als uitwisselformaat | ✅ IFC4 | IFC2x3-compatibiliteitsexport overwegen |
| 2 | Correcte **bouwlaagindeling** en naamgeving ("00 begane grond") | ⚠️ één hardcoded verdieping | **Fase 1**: verdiepingenbeheer met ILS-naamgeving |
| 3 | Juiste **entiteit** + **TypeEnumeration** | ✅ IfcWall / IfcPlate.CURTAIN_PANEL / IfcBeam.BEAM | Bij elk nieuw template een bewuste entiteitkeuze |
| 4 | Consequent **Naam en Type** | ⚠️ naam ✅, typeobject ontbreekt | **Fase 1**: IfcTypes per template |
| 5 | **Viercijferige NL-SfB-code** | ✅ 22.21 (instelbaar per template) | Codelijst-picker met actuele NL-SfB-tabel |
| 6 | **Materiaal** ingevuld | ✅ IfcMaterial | Materiaal per onderdeel binnen samenstel |
| 7 | buildingSMART-**psets** (LoadBearing, IsExternal, FireRating) | ✅ LoadBearing/IsExternal | FireRating-parameter toevoegen |
| 8 | Doorbraken en voorzieningen correct | n.v.t. (nog geen openingen) | **Fase 1**: IfcOpeningElement bij openingen |
| 9 | Geen (BIM-)proxies | ✅ | Bewaken bij nieuwe templates |
| 10 | Aspectmodellen per discipline | ✅ federatie + eigen aspectmodel | Instelbare model-/bestandsnaamgeving |
| — | **Toetsbaarheid** | handmatig | **Fase 3**: ingebouwde IDS/ILS-check vóór export (koppeling OpenAEC BIM Validator) |

---

## 3. Het gefaseerde plan

### Fase 1 — Modelleerkern op orde (→ v0.3)
*Doel: van demonstrator naar bruikbaar modelleergereedschap.*

1. **Verdiepingen & peilen**: meerdere bouwlagen met ILS-naamgeving; elementen aan een laag gekoppeld; export met juiste `IfcBuildingStorey`-structuur
2. **Stramienen** (`IfcGrid`) tekenen + snappen op stramien-snijpunten en op randen/hoeken van bestaande geometrie (nu alleen 50mm-raster en DXF-lijnen)
3. **IfcTypes**: template = `IfcWallType`/`IfcBeamType`/`IfcPlateType`, instanties via `IfcRelDefinesByType` (Revit-model, ILS-eis 4)
4. **Bewerken**: verplaatsen, kopiëren, spiegelen; hoekverbindingen tussen wanden
5. **Openingen**: `IfcOpeningElement` in lamelwanden + eerste deur-/poorttemplate (Storax)
6. **Undo/redo** en autosave van het projectbestand
7. **IFC round-trip stap 1**: eigen export heropenen als bewerkbaar project (herkenning via pset)

### Fase 2 — Documentatie & productie (→ v0.4)
*Doel: van model naar werk- en productietekening (Tekla/HSBcad-les).*

1. **Associatieve maatvoering op sheets**, noordpijl, schaalbalk; **vectoriële PDF**
2. **2D-DXF-export** van aanzichten en plattegronden
3. **Merk-/posnummering** en `IfcElementAssembly` per wandsamenstel
4. **Elementeren**: wand automatisch opdelen in productiepanelen (max. maten), per paneel een productieblad met stuklijst
5. **Zaag-/zetlijsten** (CSV) per samenstel; machineformaat verkennen met Storax

### Fase 3 — IFC-native & samenwerking (→ v0.5)
*Doel: het Bonsai-principe — IFC als werkbestand.*

1. **IFC bewerken**: elementen uit geladen IFC's verplaatsen/kopiëren/verwijderen en opslaan
2. **IDS/ILS-validatie** ingebouwd: BIM basis ILS-check vóór elke export
3. **BCF**: issues aanmaken/lezen (koppeling OpenAEC BCF-platform)
4. **Native DWG** lezen via Rust-parser als WASM (route van OpenAEC's `acadifc`/open-2d-studio)

### Fase 4 — Ecosysteem & AI (→ v1.0)
1. **Deelbare componentbibliotheken**: templates als bestanden (.o3st), catalogus per fabrikant — Storax als eerste, daarna breder
2. **AI-modelleerassistent**: natuurlijke taal → template-plaatsingen ("teken 12 m roosterwand, 2,5 m hoog, langs stramien A") — onze parametrische templates zijn hiervoor al de perfecte commandoset (les van Tekla Model Assistant en Motif)
3. **Geo-referentie**: nulpunt koppelen aan RD-coördinaten (`IfcMapConversion`), zoals Qonic aan nationale stelsels koppelt
4. Volledige meertaligheid (ook statusmeldingen), code signing van de installer, auto-update
5. Integratie met de OpenAEC-suite en That Open-platformdiensten

---

## 4. Architectuurprincipes die de sprong dragen

1. **Eén definitie, alle uitvoer**: de `solids()`-definitie van een template voedt 3D, IFC,
   2D-aanzichten én straks productie-output — nooit dubbele geometrie-logica
2. **ILS by design**: elke export gaat door dezelfde validatielaag; wat niet ILS-conform
   kan worden gemaakt, komt niet in het IFC
3. **Open formaten eerst**: IFC, BCF, IDS, DXF — gesloten formaten alleen via converters
4. **Eén codebase, twee gezichten**: web (That Open Engine) en desktop (Tauri) blijven
   hetzelfde product
5. **Klein blijven**: wat de OpenAEC-suite of That Open al goed doet (validatie, BCF, 2D),
   koppelen we — niet nabouwen

**Voorgestelde eerste stap**: Fase 1, punten 1–3 (verdiepingen, stramienen, IfcTypes) —
dat zijn de fundamenten waar alle latere functies op rusten én de grootste ILS-gaten.

---

## 5. Roadmap v0.4 → v1.0 (na overleg 2026-07-15)

Vastgelegd op basis van 12 beslissingen in het overleg met Martijn. Zie ook de
overleg-artefacten (`beslissingen-v04.md` in memory).

### v0.4.0 — Fase Nul (P0, blokkerend) · ≈1 week

1. **Muis-selectie fixen** — `setPointerCapture` in pointerdown, robuustere `e.target`-check,
   preview-Group met `raycast = () => {}`. Voor IFC-modellen: `Highlighter` uit
   `@thatopen/components-front` 3.4.3 (zit al in `package.json`), of `model.raycast()`
   direct als de UX-eisen strenger worden.
2. **Undo/redo-knoppen in header** — met dropdown-historie van laatste ~20 acties;
   camera-navigatie expliciet uit de undo-stack.

### v0.4-Sprint 1 — Architectuur-refactor · 2 weken

`types.ts` uitbreiden: `PlacementKind` (`linear`/`point`/`surface`/`assembly`),
`MaterialLayer[]`, `ProfileSpec`, uitgebreide `ifcEntity`-union met `predefinedType?`,
`hostId`/`spaceId`/`phase` op `PlacedElement`. Catalog-refactor naar NL-SfB-directories
met `import.meta.glob('./**/*.tpl.ts', { eager: true })`. Common-Pset-factories
(`makeWallCommonPset()` etc.) — verplicht per `ifcEntity`, factory vult defaults,
template overschrijft afwijkingen. Storax-drieluik verhuist backwards-compatible naar
`22_binnenwand/`.

### v0.4-Sprint 2 — SurfaceTemplate + 5 vloeren · 2 weken

VBI kanaalplaat 150/200/260/320/400 (ILS v1.0 conform), breedplaatvloer, HSB-vloer,
staalplaatbeton, MV-plaat. `Pset_SlabCommon` verplicht. VBI-partnership documenteren.

### v0.4-Sprint 3 — LinearTemplate + MaterialLayer + 6 wanden · 2 weken

KZS Silka, cellenbeton Ytong, HSB, staalframe, prefab beton, metal-stud gips.
Xella-ILS-conformiteit checken.

### v0.4-Sprint 4 — ProfileSpec + staal + beton + hout · 1–2 weken

Eén staal-template met `profielCatalogus`-select levert 300+ profielen (IPE/HEA/HEB/HEM/UNP/
koker/buis/L/C/T/Z). NEN-EN 10365 als `_shared/profiles.ts` data-import.
`IfcMaterialProfileSetUsage`. Plus 2 beton (kolom, balk) en 2 hout (glulam kolom, balk).

### v0.4-Sprint 5 — Openings met echte hosting · 2–3 weken

`IfcOpeningElement` + `IfcRelVoidsElement` + `IfcRelFillsElement`. Vervangt huidige
"dumb" Opening-record. 6 templates: draai-kiep, vast, dakraam Velux, voordeur,
binnendeur, brandwerend. `Pset_WindowCommon` / `Pset_DoorCommon` via factory.

### v0.4-Sprint 6 — AssemblyTemplate + trap + dak · 2–3 weken

Rechte trap (`STRAIGHT_RUN_STAIR`) en 2-kwart (`QUARTER_TURN_STAIR`) als eerste
multi-entiteit-template: `IfcStair` + `IfcStairFlight` + `IfcSlab.LANDING` + `IfcRailing`.
Bewijst het mechanisme voor dakkapel/kozijn/spouwmuur. Plus 3 daken: plat, hellend
HSB (20–60° param), prefab.

### v0.4-Sprint 7 — Fundering + coverings · 2 weken

Strook (`STRIP_FOOTING`), poer (`PAD_FOOTING`), prefab paal (`IfcPile` ConstructionType=
`PRECAST_CONCRETE`). Plus 4 coverings: baksteen halfsteens, systeemplafond, dekvloer,
ETICS. `IfcCovering` met host-relatie via `hostId`.

### v0.4-Sprint 8 — Railings + IfcSpace/NEN 2580 + fasering · 1–2 weken

2 railings (spijl, glas). `IfcSpace` polygonaal met NEN 2580-oppervlakteberekening
(GBO, aftrek liftschacht ≥4 m², vrije hoogte <1,5 m). Meetinstructie GBO Woningen
(BBMI) als referentie. Fasering `existing`/`new`/`demolished`/`temporary` op
`PlacedElement` (data-shape zit al in S1-refactor).

### v0.4-Sprint 9 — DWG + bSDD + BCF-import + conditional geometry · 2 weken

**DWG-export** via `acadrust` (MPL-2.0, Rust) als Cargo-dep in `src-tauri/`. Rust-module
`src-tauri/src/dwg.rs` met Tauri-command `export_dwg(dxf_content, target_version, out_path)`.
Default AC1027 (AutoCAD 2013), R2018 als "experimental". `NOTICE.md` + About-dialoog.
CI-smoke-test round-trip.

**bSDD REST-picker** naast vrije NL-SfB-string (offline-fallback). `IfcClassificationReference`
met `Location`-URL.

**BCF 3.0 import** met viewpoints + comments + status-update. `bcfExport.ts` uitbreiden.

**Conditional geometry** — `visibleWhen: (p) => boolean` en `formula: (p) => value` op
`ParamDef`. Eén wandtemplate kan variant-set met/zonder isolatie leveren.

### v0.5 — Professionalisering · ≈13 weken (H2 2026 → Q1 2027)

- **IDS-input engine** (4–6w): buildingSMART XML-parser + generieke rule-engine over
  IFC-tree; vervangt hardcoded `ILSCheck`. Directe aansluiting op BIM Loket ILS Configurator.
- **Sheet-views met callout-verwijzing + associatieve maatvoering** (6–8w): view op sheet,
  automatische detail-nummer + sheet-nummer link, hatch per materiaal.
- **Structural view IFC-export** (`IfcStructuralAnalysisModel`, 3–4w): round-trip Scia/RFEM.
- **Rc/U-waarde** in `Pset_MaterialThermal` (1–2w): Bbl-eisen (Rc ≥ 4,7 gevel / 6,3 dak /
  3,7 vloer) + ILS-check op minimale Rc.
- **COBie-compatible export** (2–3w): `IfcSpace` / `IfcSystem` / `IfcAsset` + onderhoudsdata-psets.
- **ILS O&E via IDS-templates** (2w): SO/VO/DO/TO/UO fase-specifiek.
- **Fasering UI**: view-filters + graphic overrides op de S1-datashape.
- **Sheets-preview MVP** (uit vorig overleg, 3–4w): SVG paper-laag + `react-rnd` viewports +
  gedeelde offscreen renderer met `setViewport`/`setScissor`.
- **Doorsnedes fase 1** (uit vorig overleg, 2–3w): `ClipEdges` uit
  `@thatopen/components-front`, per `IfcMaterial` lijndikte/kleur.

### v1.0 — Ecosysteem · ≈13–15 weken (2027)

- **`.o3st` JSON-serialisatie + user-editable template-editor** (8–12w): non-devs kunnen
  bijdragen. Community-marketplace `catalog.opendriestudio.nl`.
- **IFC-family-import** als `IfcBuildingElementProxy` (4–6w): Ubbink, Rockpanel, Simpson,
  Wienerberger, Kingspan als read-only proxies.
- **MEP-basisset** 10–15 templates (6–8w): `IfcPipeSegment/Fitting`, `IfcDuctSegment/Fitting`,
  `IfcAirTerminal`, `IfcSpaceHeater`, `IfcOutlet`, `IfcCableSegment`. Connectoren-concept.
- **Wapening** (4–6w): `IfcReinforcingBar` + `IfcReinforcingMesh` met generator voor
  kolommen/balken/vloeren. B500B. Bewust niet op Tekla-niveau.
- **Speckle-connector** (3–4w): versioned object graph + branching. In plaats van eigen
  real-time multi-user sync.
- **Plugin-API** voor TS-scripting (4–6w): community-automatiseringen. Vervangt Grasshopper.
- **Doorsnedes fase 2 + 3** (uit vorig overleg): 2D-canvas + hatching + dimensies +
  `IfcAnnotation` round-trip.

### Bewust NOOIT

Real-time multi-user cloud sync (Qonic-domein — koppel Speckle) · eigen FEM-solver
(Scia/RFEM-domein) · eigen parametrische wapening-editor op Tekla-niveau · eigen MEP-toolkit
à la Stabicad/MagiCAD · eigen houtverbindings-solver à la Cadwork/Dietrich's · eigen
Grasshopper-node-editor · volledige IFC4-DTV round-trip voor derde-partij IFC's (Bonsai-domein).
Voor deze domeinen: koppelen i.p.v. nabouwen.

### Framing

Niet "concurrent van Revit" maar **"openBIM-native modelleergereedschap voor de Nederlandse
bouw met focus op fabrikant-catalogi en ILS/IDS-conformiteit"**. Onder die framing is
65/100 op de universele schaal 100/100 op de eigen niche.
