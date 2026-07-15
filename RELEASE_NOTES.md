# Open 3D Studio v0.3.0 — de grote sprong: alle vier de planfasen

Deze release werkt het volledige gefaseerde plan uit [PLAN.md](PLAN.md) af, in eerste
werkende versie. Installeren over een eerdere versie heen kan gewoon.

## Fase 1 — Modelleerkern

- **Verdiepingen** met BIM basis ILS-naamgeving ("00 begane grond"), peilen, actieve
  bouwlaag als tekenvlak; export met correcte `IfcBuildingStorey`-structuur
- **Stramienen** (assen 1…n / A…) met snappen op snijpunten en `IfcGrid`-export
- **IfcTypes**: elk template + typeparameters wordt een `IfcWallType`/`IfcBeamType`/
  `IfcPlateType`, instanties gekoppeld via `IfcRelDefinesByType`
- **Sparingen** in wandvormige elementen: geometrie wordt doorsneden én er wordt een
  `IfcOpeningElement` + `IfcRelVoidsElement` geëxporteerd
- **Verslepen** van het geselecteerde element, **kopiëren**, **undo/redo** (Ctrl+Z/Y)
- **IFC heropenen**: eerder geëxporteerde IFC's worden weer bewerkbare elementen (round-trip)

## Fase 2 — Documentatie & productie

- **Merk-/posnummering** (Tekla-principe): identieke elementen delen een merk (W01, P01, B01)
- **Elementeren** (HSBcad-principe): productierapport-PDF met panelen op maximale breedte
  en zaag-/stuklijsten per paneel
- **2D-DXF-export** van het bovenaanzicht (footprints met merklabels, lijnen, maten, lagen)
- **Sheets**: maatvoering als vector op ware schaal, schaalbalk en noordpijl per venster

## Fase 3 — Kwaliteit & samenwerking

- **Ingebouwde BIM basis ILS-controle** met rapportvenster (Start → ILS-controle)
- **BCF 2.1-issues** exporteren met camera-standpunt en schermafbeelding
- **RD-georeferentie** (EPSG:28992): `IfcMapConversion` + `IfcProjectedCRS` in de export

## Fase 4 — Ecosysteem & AI

- **Componentpresets** opslaan en laden (.o3st)
- **AI-modelleerassistent (experimenteel)**: beschrijf in gewone taal wat je wilt plaatsen;
  werkt met je eigen Claude API-sleutel (console.anthropic.com), die lokaal blijft

## Bewust nog niet in deze release

- Native **DWG** lezen (vergt een Rust/WASM-parserproject; DXF werkt) en 2D-DXF van gevels
- **Code signing** van de installer (certificaat vereist) en **auto-update**
- Statusmeldingen zijn nog Nederlandstalig in de EN-modus
- Interactief bewerken van elementen uit andere (niet-O3S) IFC-bestanden
