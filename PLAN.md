# Studie & plan — de grote sprong van Open 3D Studio

*Versie 1.0 — juli 2026. Levend document: prioriteiten schuiven op basis van testervaringen.*

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

### Fase 4 — Ecosysteem (→ v1.0)
1. **Deelbare componentbibliotheken**: templates als bestanden (.o3st), catalogus per fabrikant — Storax als eerste, daarna breder
2. Volledige meertaligheid (ook statusmeldingen), code signing van de installer, auto-update
3. Integratie met de OpenAEC-suite en That Open-platformdiensten

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
