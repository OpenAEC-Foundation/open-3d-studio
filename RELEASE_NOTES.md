# Open 3D Studio v0.8.0 — modelleerkern compleet + inhaalslag

Bundelt drie slagen in één release: de **modelleerkern** (v0.7-scope, hieronder),
de **inhaalslag** op bekende gaten, en de **v0.8-bewerkpunten**.

## v0.8 — verstek, polygoon-sparingen, match properties

- **Stompe hoekaansluiting (butt joint) op L-verbindingen** — bij hoeken van
  75–105° steekt de doorlopende wand een halve dikte van de aansluitende wand
  vóórbij het assnijpunt en stopt de aansluitende wand op het lijf van de
  doorlopende: geen dubbel volume meer op de hoek, en de BOM-lengtes kloppen.
  Scheve hoeken vallen terug op eindpunt-samenvallen. De aansluiting rekent
  live mee bij verslepen (meebewegende joins).
- **Polygoon-sparingen** — nieuw gereedschap: klik hoekpunten op één element,
  rechtsklik rondt af (min. 3 punten, Esc annuleert). Ook concave polygonen
  (scanline/even-odd, 16 strips). IFC: `IfcArbitraryClosedProfileDef`
  geëxtrudeerd door de elementdikte. Werkt op wanden én vloeren/daken.
- **Match properties (penseel)** — klik bron, dan doel-elementen: type-parameters
  en typeId gaan over (peil blijft instantie-eigen); alleen tussen elementen van
  hetzelfde template. Esc stopt.

## Inhaalslag

- **λ-waarden compleet** — alle 17 templates met materiaallagen hebben nu
  warmtegeleidingscoëfficiënten (NEN 1068-forfaitair), dus de Bbl-Rc-check
  werkt op de hele catalogus. Gecombineerde staal+wol-lagen rekenen met de
  isolatiewaarde.
- **i18n-inhaalslag** — alle v0.5–v0.7 UI-teksten (IDS-paneel, fasering, typen,
  sparingen, Speckle, plugin, Ecosysteem-ribbon, bewerken-knoppen) via
  i18n.ts met NL- én EN-vertaling. Engine-statusmeldingen blijven bewust NL
  (bestaande keuze); de template-editor volgt in een latere slag.
- **Wasm-singleton** (`getIfcApi()` in `src/core/ifcCommon.ts`) — export,
  structural export, family-import en heropenen delen één web-ifc-initialisatie
  i.p.v. elk hun eigen fetch+compile (honderden ms per operatie bespaard).
  De gedupliceerde IFC-GUID-encoder is samengevoegd in dezelfde module.

---

# Open 3D Studio v0.7.0-rc — modelleerkern volwassen (bewerken, typen, hoofdcategorieën)

De **Modelleerkern-release**: alle zes sprints uit `VOORSTEL_v0.7_modelleerkern.md`,
gebouwd op de 8 vastgelegde beslissingen (Martijn, 2026-07-16).

## S1 — Multi-select + klembord

- **Multi-select**: Ctrl-klik togglet elementen in/uit de selectie; **Shift+drag**
  = venster-selectie (L→R omsluitend / R→L kruisend, CAD-conventie, met
  amber marquee-overlay). Ctrl+A selecteert alles. De hele selectie versleept mee.
- **Klembord**: Ctrl+C/X/V — via localStorage, dus plakken werkt óók tussen twee
  open projecten. Plakken zet het plaksel als nieuwe selectie met +0,5 m offset;
  nogmaals plakken herhaalt. Delete/Backspace verwijdert de selectie.
- **Bulk-paneel** bij >1 selectie: kopieer/knip/verwijder + reeks/offset.

## S2 — Element-snapping, eind-handles, uitlijnen/spiegelen/reeks/offset

- **Element-snapping**: teken- en handle-punten snappen op endpoints en midpoints
  van bestaande elementen (0,25 m zoekradius, amber snap-marker); wint van
  raster- en stramien-snap.
- **Eind-handles** (Tekla-les): het geselecteerde lijnelement toont bolletjes op
  start/end; verslepen wijzigt alleen dat eindpunt — trim/extend voor 90 % van
  de gevallen. Na loslaten wordt automatisch een verbinding gezocht.
- **Uitlijnen**: klik referentie-element, dan het te verschuiven element
  (haakse translatie, alleen ~evenwijdig). **Spiegelen**: 2-punts as over de
  selectie (kopie, Revit-default). **Reeks**: n× h.o.h. haaks op de as.
  **Offset**: evenwijdige kopie op afstand.

## S3 — Verbindingen (joins) + splitsen

- **ElementJoin als relatie** (beslissing 2): L-verbinding (eindpunt-op-eindpunt)
  en T-verbinding (eindpunt-op-lijf) ontstaan automatisch bij tekenen en
  handle-slepen; `resolveJoins` laat verbonden eindpunten meebewegen bij
  verslepen/draaien/lengte-wijziging. "Verbreek"-knop op de selectie.
- **Splitsen**: klik op een lijnelement — twee elementen, sparingen verdeeld op
  positie (xPos hermeten), joins op het oude eindpunt verhuizen mee.
- **IFC**: joins exporteren als `IfcRelConnectsPathElements` met
  ATSTART/ATEND/ATPATH.

## S4 — Openingen 2.0

- **Meerdere sparingen per element** (`openings[]` met id/vorm/kind/zBottom;
  legacy enkelvoudige sparing migreert automatisch bij laden).
- **Rechthoek + rond** (beslissing 6/8: rond via 12-strip-benadering, geen
  CSG-dependency); borstwering via zBottom.
- **Vloeren/daken**: gat in het vlak (2D-cut in as- én dwarsrichting).
- **Sparingstool** in de ribbon: klik op een element → sparing op dat punt.
- **Kozijn-koppeling**: een deur/raam op een host-wand maakt automatisch een
  gekoppelde sparing (kind raam/deur) op kozijnmaat; kozijn verwijderen ruimt
  de sparing op. IFC: elke sparing een eigen `IfcOpeningElement` (rond als
  `IfcCircleProfileDef`).

## S5 — Typen als eersteklas begrip

- **TypeDefinition** (template + vastgezette parameters + naam), opgeslagen in
  het project én in de gebruikersbibliotheek (localStorage, beslissing 4).
- **"Opslaan als type"** vanaf een geselecteerd element, **dupliceren**,
  **toepassen op selectie**, en **doorwerking**: type-params wijzigen update
  alle instanties.
- **Typen-paneel** + derde trap in de kiezer (hoofdcategorie → template → type);
  tekenen met een actief type zet `typeId` op de plaatsing.
- **IFC**: benoemde typen geven hun naam aan `IfcWallType` e.d. in plaats van
  een volgnummer.

## S6 — Hoofdcategorieën

- **12 vaste hoofdcategorieën** afgeleid van NL-SfB (Wanden = 21+22 samen,
  beslissing 1), override per template mogelijk (`mainCategory`).
- **Getrapte kiezer** vervangt de platte 52+-dropdown.
- **Ribbon-tekenknoppen per categorie** (beslissing 5, Revit-patroon): klik =
  tekenen met het laatst gebruikte template in die categorie.
- **Lagenpaneel op hoofdcategorie**: 12 lagen i.p.v. 24 losse strings.

## Test-bewijs (dev-server)

Alle checks runtime geverifieerd: multi-select (2), plakken (+2 elementen,
plaksel geselecteerd), join volgt mee bij verplaatsing van de partner, splitsen
(+1 element), ronde sparing op zBottom 1,0 m, type opslaan + toepassen
(typeId gezet), lagen tonen "Wanden"/"Installaties" i.p.v. "Buitenwanden",
undo/redo-round-trip behoudt openingen/joins/typen. IFC-export: 96 kB met
`IFCRELCONNECTSPATHELEMENTS`, typenaam "HSB testtype" en 1 opening/void-paar.
`tsc --noEmit` schoon; geen console-errors.

## Nog uitgesteld

- Verstek-geometrie op L-hoeken (nu eindpunt-samenvallen; volumes overlappen
  minimaal op de hoek) — v0.8.
- Vrije polygoon-sparingen — v0.8 (beslissing 6).
- Match properties (penseel) — v0.8.

---

# Open 3D Studio v0.6.0 — ecosysteem (templates, families, MEP, wapening, Speckle, plugins, doorsnedes)

## Codereview-hardening — 10 bevindingen uit de multi-agent review opgelost

Na de eerste rc draaide een 8-hoeks review (line-by-line, removed-behavior,
cross-file, reuse, simplificatie, efficiency, altitude, conventies) met
adversariële verificatie per bevinding. De 10 zwaarste zijn gefixt:

1. **IFC-family-import registreerde een gedegradeerde template** — de gemeten
   bounding-box werd weggegooid door een onbedoelde .o3st-round-trip; elk
   geïmporteerd product plaatste als 0,01×0,3×2,8 m-sliver. Registreert nu
   direct het echte template.
2. **Fasering/hosting overleefde undo en save/reopen niet** — `serializeProject`
   persisteert nu `phase`/`hostId`/`spaceId`; fase gaat ook mee in de IFC
   (`Fase`-property + O3S_Data) en overleeft de IFC-round-trip.
3. **Kolomwapening rekende met de plan-lengte** als doorsnedehoogte, staaflengte
   én beugelverdeling. Nu: doorsnede uit profielmaten, staven/beugels uit de
   hoogte-parameter (300×300-kolom: 15 beugels van 960 mm, staven 2800 mm).
4. **Vloer-mesh-BOM was ~13× te laag** — het veld `lengthMm` bevatte een
   oppervlak. Nu echt afgewikkeld (tweezijdig Ø8-150) en het oppervlak uit de
   rechthoekzijden i.p.v. de diagonaal.
5. **Officiële (hoofdletter-)IDS-bestanden matchten nul elementen** — entity-
   matching is nu case-insensitief conform de IDS 1.0-spec; `IFCWALL` matcht.
6. **Vijf v0.4-checks waren verloren in de IDS-migratie** — terug als vaste
   `basisChecks()` bovenop elke IDS-run: bouwlaagnaamgeving, wees-elementen,
   Pset_-prefix, dragend/NL-SfB-consistentie, ontbrekende templates (die de
   IDS-run stil oversloeg) worden weer gemeld.
7. **Sloop-elementen telden mee als nieuwbouw** — COBie, structural, wapening,
   elementeren en de aantallenlijst sluiten fase "demolished" nu uit; de
   hoofd-IFC behoudt alle fasen mét Fase-property.
8. **Verdwenen runtime-templates crashten de app** — project openen slaat
   onbekende templates over (met melding), en de App-render valt terug op het
   eerste template i.p.v. te white-screenen.
9. **Valse sandbox-claims bij plugins** — documentatie en UI zeggen nu eerlijk
   dat plugins volledige toegang hebben (Worker-sandbox staat voor v0.7).
10. **Sheet-annotaties bleven achter bij viewport-drag** — maten en callouts
    schuiven nu mee; het dode `elementRef`-veld is verwijderd en de docs melden
    expliciet dat maten (nog) niet associatief zijn.

Plus kleiner werk uit de review: `IfcRelAssignsToGroup` verwijst alleen nog naar
daadwerkelijk geschreven members, de doorsnede-SVG toont lagen van één element
aaneengesloten op hun cy-offset (geen verstrooide rechthoeken meer),
lagenpaneel/AI-assistent/NL-SfB-groepering zien nu ook runtime-templates, de
template-editor voegt bij solid-box automatisch de diepte/hoogte-parameters toe,
snapshot-hergeneratie in de sheet-preview is gestabiliseerd (useCallback), en de
dode inclusive-logica in de IDS-range-parser is opgeruimd.

De **Ecosysteem-release**: van "modelleerstudio voor Nederland" naar "platform waar de
gemeenschap zelf templates, families, plugins en workflows kan bouwen". Zeven punten
uit de v1.0-scope in PLAN.md §5 in een eerste werkende versie.

## v0.6-1 — .o3st template-editor

- **Nieuw formaat `.o3st`** (`src/core/o3stTemplate.ts`): JSON-serialisatie van
  templates zonder code. Drie procedurele shape-kinds — `layered`, `solid-box`,
  `profile-swept` — dekken ~95 % van de bestaande catalogus. Community-templates
  blijven daardoor inherent veilig te installeren.
- **Runtime-registry** (`src/catalog/registry.ts`) — `registerRuntimeTemplate`,
  `unregisterRuntimeTemplate`, `subscribeRuntimeTemplates`. Templates die na
  build-tijd worden geladen verschijnen live in de dropdown.
- **Editor-UI** (`src/ui/TemplateEditor.tsx`) — grid met velden voor id/naam/IFC-
  entiteit/psetName, editor voor materiaallagen (met λ), open/opslaan als `.o3st`,
  direct toevoegen aan de catalogus. Basiseren op bestaand template als
  startpunt (HSB-buitenwand / staalprofiel / plat dak).

## v0.6-2 — IFC-family-import als IfcBuildingElementProxy

- **`src/core/ifcFamilyImport.ts`** — laadt een externe IFC (Ubbink, Rockpanel,
  Kingspan, Simpson, Wienerberger) en converteert elk product met geometrie tot
  een read-only proxy-template. Bounding-box uit `GetFlatMesh` + `GetGeometry`.
- Elke proxy krijgt eigen `id`, category `Import — <bron>`, `manufacturer`,
  `psetName: "Import_Family"` met originele naam/beschrijving/afmetingen.
- Automatisch geregistreerd via de runtime-registry — direct plaatsbaar.

## v0.6-3 — MEP-basisset (11 templates)

- **`src/catalog/50_mep/`** — elf nieuwe templates over vier disciplines:
  - **Sanitair/verwarming**: pipe-segment (Cu/kunststof), pipe-fitting (bocht/T),
    space-heater (paneelradiator T11/T22/T33), sanitary-terminal (wastafel/wc/
    urinoir/bad/douche).
  - **Ventilatie**: duct-segment (rechthoekig), duct-fitting, air-terminal
    (diffusor/rooster/louvre).
  - **Elektra**: cable-segment (VD/XMvK/YMvK/UTP), outlet (stopcontact/data),
    cable-carrier (kabelgoot), light-fixture (LED-spot/paneel/lijn).
- **`IfcEntityName`** in `types.ts` uitgebreid met 11 MEP-entiteiten;
  `ifcEntityMap.ts` levert per entity de juiste constructor + `PredefinedType`-
  enum + Common-Pset-naam.

## v0.6-4 — Wapening-generator

- **`src/core/rebarGenerator.ts`** — genereert een simpele rebar-cage voor
  betonkolommen, -balken en -vloeren. Configureerbaar: hoofdstaven Ø,
  aantal, beugels Ø + hart-op-hart, betondekking. B500B staal.
- Levert `RebarBar[]` als data-struct (positions + lengths + rol) plus
  `rebarBomCsv()` en `rebarTotalsByDiameter()` (kg-totalen via
  π/4·Ø²·ρ met ρ_staal = 7850 kg/m³).
- **UI-knop "Wapening-BOM"** in de nieuwe Ecosysteem-ribbon exporteert CSV.

## v0.6-5 — Speckle-connector

- **`src/core/speckleConnector.ts`** — push/pull naar Speckle 2.x zónder de
  Speckle SDK als dependency toe te voegen (die trekt automerge + RxJS mee).
  Directe communicatie via REST (`/objects/{streamId}`) + GraphQL
  (`commitCreate`).
- Model → Speckle-graph: root `Base` met `@elements`-array; per element
  `Objects.BuiltElements.<Type>` met start/end/params/hostId/phase/storey.
- **Speckle-paneel** in de sidepanel: host, streamId, branch, token → één
  "Push commit"-knop.

## v0.6-6 — Plugin-API voor TS/JS-scripting

- **`src/core/pluginApi.ts`** — `.o3sp`-formaat (plain-text JS). Plugin heeft
  toegang tot een `PluginRuntime`-API: log, listTemplates, getTemplate,
  registerTemplate, unregisterTemplate, getElements, getStoreys, placeElement.
- **Sandbox** via `new Function()`-constructor met `"use strict"`; geen
  window/document/fetch/localStorage bereikbaar. (Voor v0.7 komt een
  Web Worker + MessageChannel-sandbox.)
- **Plugin-paneel** in de sidepanel: multi-line JS-editor + "Draai plugin" +
  "Laad .o3sp …". Ingebouwd voorbeeld `EXAMPLE_PLUGIN_JS` registreert een
  demo-schotje.

## v0.6-7 — Doorsnedes fase 2 en 3

- **`src/core/sectionSvg.ts`** — 2D-SVG-export van de doorsnede met:
  - Rechthoekige polygonen per `SolidBox`-laag
  - **Hatch per IfcMaterial-categorie** via SVG-patterns:
    structure = diagonale streep, insulation = golvend, cladding = horizontaal,
    membrane = dicht, finish = licht grijs, cavity = wit.
  - Papiervel + snijvlak-informatie in de kop.
- **`sectionAsAnnotation()`** — bouwt de payload voor `IfcAnnotation`-round-trip
  (fase 3). De wire-up naar `ifcExport.ts` volgt in v0.7 samen met sheets-round-trip.
- **UI-knop "Doorsnede-SVG"** in de Ecosysteem-ribbon.

## Ribbon-uitbreiding

De **Ecosysteem-tab** heeft vijf groepen:
- **Templates**: Template-editor, Laad .o3st
- **Bibliotheken**: IFC-family
- **Constructie**: Wapening-BOM
- **Doorsnede**: Doorsnede-SVG
- **Cloud**: Push Speckle

Nieuwe sidepanel-secties: **Speckle** (host/stream/branch/token) en **Plugin**
(JS-editor + Draai/Laad).

## Test-bewijs

- **Type-check**: `tsc --noEmit` clean over alle nieuwe modules
  (`o3stTemplate`, `ifcFamilyImport`, `rebarGenerator`, `speckleConnector`,
  `pluginApi`, `sectionSvg`) én de 12 MEP-templates.
- **Runtime**: catalogus bevat na start 51 templates (40 bouw + 11 MEP);
  runtime-registratie via `loadO3stTemplate` en `subscribeRuntimeTemplates`
  update de dropdown live. Plugin-voorbeeld registreert een 52ste template.
- **Rebar-generator**: kolom + vloer levert 2 diameters (Ø16 hoofd, Ø8 mesh),
  4,23 kg totaal via π/4·Ø²·ρ_staal.
- **.o3st round-trip**: HSB-buitenwand → serialiseren → `o3stToTemplate` levert
  5 SolidBox'en identiek aan het origineel (bevestigd via `solids(5, defaults)`).
- **Doorsnede-SVG**: 1709 tekens output met 6 hatch-patterns; opent in elke browser.
- **Plugin-voorbeeld**: `EXAMPLE_PLUGIN_JS` registreert `plugin-demo-schotje`
  succesvol; runtime-listener updatte de dropdown.

## Nog uitgesteld tot v0.7

- **Sheets/IfcAnnotation round-trip** — payload is er (`sectionAsAnnotation`),
  wire-up naar `ifcExport.ts` volgt.
- **Speckle-schema-mapper** — nu levert de pull alleen metadata; volledige
  geometrie-conversie in v0.7.
- **Wapening-IFC-export** — nu levert de generator een data-struct + CSV,
  omzetten naar echte `IfcReinforcingBar` / `IfcReinforcingMesh` in v0.7.
- **Web Worker plugin-sandbox** — echt geïsoleerde plugin-executie.
- **Load conditions in structural view** (nu alleen geometrie).

---

# Open 3D Studio v0.5.0-rc — professionalisering (IDS, thermisch, structural, COBie)

De **Professionalisering-release**: van "modelleerstudio met veel templates" naar
"modelleerstudio die aansluit op de professionele workflows van energie-adviseurs,
constructeurs en beheerders". Zeven sprints uit `PLAN.md`-sectie 5 (v0.5).

## v0.5-S1 — IDS-input engine

- **Volledige buildingSMART IDS v1.0-parser** (`src/core/ids/parser.ts`) —
  leest `<entity>`, `<classification>`, `<material>`, `<property>` en
  `<attribute>`-facets met `simpleValue`, `restriction/enumeration`,
  `restriction/pattern` en `min/maxInclusive`-range-matching. Ondersteunt
  `applicability` + `requirements` per specification, met `cardinality`
  `required`/`optional`/`prohibited`.
- **Generieke rule-engine** (`src/core/ids/engine.ts`) — vervangt de hardcoded
  `checkIls()`. Levert bevindingen in het bestaande `IlsBevinding`-formaat
  zodat het rapportage-UI ongewijzigd blijft.
- **Zeven ingebouwde presets** (`src/core/ids/presets.ts`) — BIM basis ILS 2.0,
  Bbl Rc-controle, en ILS O&E-fasen SO/VO/DO/TO/UO. Direct kiesbaar via de
  dropdown in het IDS-controle-paneel.
- **Eigen IDS-XML importeren** — knop "IDS-bestand …" laadt een `.ids`/`.xml`
  uit de BIM Loket IDS Configurator of andere IDS-generator.

## v0.5-S2 — Rc/U-waarde en Bbl-check

- **`lambda`-veld op `MaterialLayer`** (W/(m·K)) — templates die meelaagse
  opbouw hebben (HSB-buitenwand, prefab betonwand sandwich, ETICS,
  plat dak, hellend HSB-dak) kregen realistische λ-waarden voor
  bouwmaterialen (minerale wol 0,035; PIR 0,023; beton 2,3; hout 0,13).
- **Rc-berekening** (`src/core/thermal.ts`) — sommeert d/λ over de warmte-
  relevante lagen; U = 1/(Rc + Rsi + Rse) met Rsi=0,13 en Rse=0,04.
- **`Storax_Thermal`-pset** — elke geplaatst element krijgt `Rc`, `Rsi`,
  `Rse`, `U` als IfcReal-properties.
- **`Pset_MaterialThermal`** — één pset per uniek IfcMaterial met
  `ThermalConductivity` en `SpecificHeatCapacity` (default 1000 J/(kg·K)).
- **`Bbl 2024 — Rc-waarden`-preset** — controleert Rc ≥ 4,7 (gevel NL-SfB 21),
  ≥ 6,3 (dak 27) en ≥ 3,7 (vloer 23).

## v0.5-S3 — Sheet-callouts + associatieve maatvoering

- **`SheetAnnotation`-type** — `dimension` (twee paper-punten, auto-lengte
  op basis van schaal) en `callout` (positie + detailnummer + refSheet).
- **SheetPreview** heeft nu drie tools: **Selecteren** (viewports verslepen),
  **Maat** (klik twee punten binnen dezelfde viewport), **Callout** (klik
  op positie, vult detailnr + refSheet via prompt). Alle annotaties in
  paper-mm.
- **`sheetPdf`** rendert dimensies (met tick-marks en label) en callouts
  (amber cirkel met detailnummer + sheetreferentie) in de geëxporteerde PDF.

## v0.5-S4 — Structural view (IfcStructuralAnalysisModel)

- **`src/core/structuralExport.ts`** — zelfstandige aspect-IFC-export met:
  - `IfcStructuralAnalysisModel` (LOADING_3D)
  - `IfcStructuralCurveMember` (RIGID_JOINED_MEMBER) voor dragende
    balken/kolommen/leden met polyline-geometrie
  - `IfcStructuralSurfaceMember` (SHELL) voor dragende wanden/vloeren/daken
    met polyloop-face
  - `IfcRelAssignsToGroup` koppelt alle members aan het analysis-model.
- **Filter op `template.loadBearing !== false`** — alleen dragende elementen
  komen mee. Bewust géén load conditions in v0.5; Scia/RFEM verwacht dat de
  gebruiker die in de solver zelf invoert.

## v0.5-S5 — COBie-compatible export

- **`src/core/cobieExport.ts`** — ZIP met zes CSV-tabbladen van COBie 2.4:
  `Contact`, `Facility`, `Floor`, `Type`, `Component`, `System`. Headers
  volgen de UK-BIM-Alliance CSV-specificatie zodat de output door BIM-
  servers (Autodesk Construction Cloud, Solibri) direct importeerbaar is.
- **Type-groepering** — templates + hun type-parameters gaan naar
  één `Type`-rij; instanties naar `Component`-rijen.
- **System-groepering** per NL-SfB-hoofdgroep (2 cijfers) → `IfcSystem` in
  de COBie-export.

## v0.5-S6 — ILS O&E via IDS-templates

- **Vijf fase-templates** (SO/VO/DO/TO/UO) als IDS-XML in
  `src/core/ids/presets.ts`. Elke template controleert de eisen die voor
  díé projectfase relevant zijn:
  - **SO**: dragende elementen hebben entiteit + type
  - **VO**: alle bouwkundige elementen hebben NL-SfB en materiaal
  - **DO**: Pset_WallCommon compleet + Rc bekend voor thermische schil
  - **TO**: FireRating op deuren + U-waarde op ramen
  - **UO**: fabrikant + garantie + ServiceLife (COBie)

## v0.5-S7 — Fasering-UI

- **`PhaseSettings`-datastruct** op de Studio — per fase een `visible`-vlag,
  een `color`-override en een `wireframe`-vlag.
- **View-filters** — vinkjes in het Fasering-paneel schakelen elke fase
  aan/uit; de 3D-view en sheets verbergen die elementen.
- **Graphic overrides** — standaardstijl:
  - Nieuwbouw: template-kleur (100 % opacity)
  - Bestaand: warm grijs (60 % opacity)
  - Te slopen: dieprood met streeplijnen (55 %)
  - Tijdelijk: helder geel (75 %)
- **`meshBuilder`** krijgt drie extra opties: `phaseColor`, `phaseOpacity`,
  `phaseWireframe`. `EdgesGeometry` + `LineDashedMaterial` levert echte
  gestreepte overlay voor sloop.

## Ribbon-uitbreiding

De **Kwaliteit-groep** heeft nu zes knoppen:
IDS-controle (label toont actieve preset), IDS-bestand …, BCF export/import,
**Structural aspect**, **COBie ZIP**. Er is een IDS-controlepaneel in de
sidepanel met de preset-dropdown en de import-knop.

## Test-bewijs

- **Type-check**: `tsc --noEmit` clean over alle 21 core-modules,
  17 UI-modules en 40 templates.
- **IDS-parser**: `parseIdsXml(BIM_BASIS_ILS_2_XML)` levert 7 specifications
  met totaal 15 requirements.
- **Rc-berekening**: HSB-wand met 145 mm minerale wol (λ=0,035) geeft
  Rc ≈ 4,2 m²·K/W; met 220 mm ≈ 6,3.
- **COBie-ZIP**: bij 10 elementen levert de export 6 CSV's met totaal
  ≈ 8 KB, correct te openen in Excel/LibreOffice.

## Nog uitgesteld tot v0.6

- Volledige round-trip van sheets/viewports/annotaties als `IfcAnnotation`.
- Hatch per IfcMaterial in doorsnede-view (S3 uitbreiding).
- Load conditions in de structural view (staat gepland als aparte stap
  voor Scia-connector).
- Sheet-preview met offscreen-renderer per viewport (nu delen alle
  viewports één snapshot).

---

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
