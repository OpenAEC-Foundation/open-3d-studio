# Open 3D Studio

Open-source 3D-modelleerstudio voor de bouw met **IFC als native output** — in de stijl van de
[OpenAEC Foundation](https://open-aec.com/) en aangedreven door
[That Open Engine](https://github.com/ThatOpen) (voorheen IFC.js).

De Revit-gedachte, maar open: je bouwt **componenttemplates** (parametrische families) in code,
tekent ermee bovenop één of meer ingeladen IFC-modellen, en exporteert het resultaat als
zelfstandig IFC4-aspectmodel.

## Wat kan het nu (v0.2)

- **3D-viewport** op basis van `@thatopen/components` (Three.js), met raster en orbit/pan/zoom
  — zonder extern logo in beeld.
- **Meerdere IFC-bestanden laden** (federatie) met zichtbaarheid per model.
- **Drie Storax-componenten tekenen** (klik start- en eindpunt, snap 50 mm, ook op geladen
  IFC-geometrie): *rooster-lamelwand*, *los roosterpaneel* en *drager (koker)*. Nieuwe
  componenten zijn één bestand in `src/catalog/`.
- **Parametrisch bewerken** — ook achteraf per element: maten, kleuren, peil, plus
  **lengte numeriek aanpassen** en **draaien** (±15°/±90° om het startpunt).
- **2D-aanzichten**: boven/voor/achter/links/rechts (orthografisch, rotatie vergrendeld)
  en 3D-perspectief, via de knoppenbalk in de viewport.
- **Doorsnede**: klikpunt bepaalt het snijvlak (gesnapt aan de dichtstbijzijnde hoofdas);
  weer te verwijderen via het lagenpaneel.
- **Lijnen tekenen** (kettinglijnen) en **meten** (maatlabel in mm), elk op een eigen laag.
- **Lagen**: zichtbaarheid per categorie (Roosterwanden, Roosters, Dragers, Lijnen, Maatvoering).
- **Instelbaar nulpunt** (X/Y/Z in mm): assenkruis in beeld; IFC-export wordt relatief
  aan dit punt geschreven.
- **Aantallenlijst**: automatisch gegroepeerd per component/lengte/kleur, te exporteren als CSV.
- **IFC4-export** via `web-ifc`, conform de BIM basis ILS-gedachte: juiste entiteit per
  component (`IfcWall`, `IfcPlate.CURTAIN_PANEL`, `IfcBeam.BEAM`), échte geometrie
  (`IfcExtrudedAreaSolid` per lamel/stijl/plint), ruimtelijke structuur, kleuren
  (`IfcSurfaceStyle`), **NL-SfB-classificatie**, **IfcMaterial** en standaard-psets
  (`Pset_WallCommon` e.d.) naast de fabrikant-pset. De export laadt aantoonbaar weer in
  via de eigen viewer.
- **STL-export** (binair, mm) van alle getekende componenten voor 3D-printen.
- **PDF-export** (A3 liggend) van het huidige aanzicht met eenvoudige onderhoek.
- **Sheets**: tekeningbladen (A4–A1, liggend/staand) met max. 4 vensters, elk met eigen
  aanzicht en **ware schaal** (1:10 t/m 1:500), automatische indeling, vensterlabels en
  titelblok — export als PDF.
- **DXF-import** als onderlegger: LINE, LWPOLYLINE/POLYLINE (incl. bulge-bogen), CIRCLE,
  ARC, ELLIPSE en INSERT-blokken; eenheden uit `$INSUNITS`; per bestand een eigen laag.
  Snappen op DXF-lijnen werkt bij het tekenen. (DWG: eerst converteren naar DXF.)
- **2D-detailleren**: rechthoek-, cirkel- en teksttool; in 2D-aanzichten wordt getekend
  in het bijbehorende vlak door het nulpunt (plattegrond, gevel of zijaanzicht).

## Starten

```bash
npm install
npm run dev      # http://localhost:5173
```

De benodigde wasm- en workerbestanden worden bij `npm install` automatisch uit
`node_modules` naar `public/` gekopieerd; de app draait daarna volledig lokaal.

## Architectuur

```
src/
├── catalog/              ← componenttemplates ("families")
│   ├── registry.ts       ← catalogus; nieuw component hier registreren
│   └── storaxLamelWand.ts← Storax rooster-lamelwand (parameters + opbouw)
├── core/
│   ├── types.ts          ← ComponentTemplate, SolidBox, PlacedElement
│   ├── studio.ts         ← viewport, IFC-laden, tekentool, selectie
│   ├── meshBuilder.ts    ← solids → three.js-weergave
│   └── ifcExport.ts      ← solids → IFC4 (web-ifc), GUID's, psets, kleuren
└── ui/ + App.tsx         ← React-schil in OpenAEC-huisstijl
```

**Kernprincipe:** een template definieert zijn opbouw één keer als lijst van volumes
(`solids()`), en die ene definitie voedt zowel de 3D-weergave als de IFC-export.
Weergave en uitwisselbestand kunnen dus nooit uit elkaar lopen.

### Nieuw component toevoegen

1. Maak `src/catalog/mijnComponent.ts` en exporteer een `ComponentTemplate`
   (parameters, defaults, `solids()`, kleur, property set).
2. Registreer het in `src/catalog/registry.ts`.
3. De parameter-UI wordt automatisch gegenereerd uit de parameterdefinitie.

## Stack en licenties

| Onderdeel | Rol | Licentie |
|---|---|---|
| [@thatopen/components](https://github.com/ThatOpen/engine_components) | viewport, IFC-laden, fragments | MIT |
| [web-ifc](https://github.com/ThatOpen/engine_web-ifc) | IFC4 lezen/schrijven (WASM) | MPL-2.0 |
| React + Vite + TypeScript | applicatieschil | MIT |
| [OpenAEC style book](https://github.com/OpenAEC-Foundation/OpenAEC-style-book) | huisstijl (kleuren, typografie) | CC BY-SA 4.0 |

## Routekaart

- [ ] **DWG**: native DWG-import (Rust-parser via WASM, zoals OpenAEC's `acadifc` /
      open-2d-studio dat in Tauri doet); tot die tijd: DWG → DXF converteren
- [ ] 2D-DXF-export van lijnwerk en aanzichten
- [ ] Vectoriële PDF (vensters zijn nu rasterafbeeldingen op ware schaal)
- [ ] Maatvoering en teksten op sheets; noordpijl en schaalbalk
- [ ] Desktop-app: wrappen in het Tauri v2-template uit het OpenAEC style book
- [ ] Componenten verslepen/kopiëren; hoeken/aansluitingen
- [ ] Bibliotheek met standaard BIM-componenten conform BIM basis ILS
      (deuren, hekwerken, systeemwanden), gekoppeld aan NL-SfB
- [ ] Snappen op randen/hoeken van geladen IFC-geometrie
- [ ] `IfcWallType`/`IfcBeamType` + type-instantie-structuur (template = IfcType)
- [ ] Opslaan/openen van projectbestanden (elementen + parameters als JSON)
- [ ] Doorsnede-details: 2D-uitsnede met maatvoering als tekening
