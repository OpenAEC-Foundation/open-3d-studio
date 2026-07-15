# Open 3D Studio v0.1.0 — eerste testversie

Open-source 3D-modelleerstudio voor de bouw met **IFC als native output**, in de stijl van
de OpenAEC Foundation en aangedreven door That Open Engine.

## Installatie (Windows)

Download `Open.3D.Studio_0.1.0_x64-setup.exe` hieronder en voer het uit.
Windows SmartScreen kan waarschuwen omdat de installer (nog) niet ondertekend is:
kies "Meer informatie" → "Toch uitvoeren".

## Wat zit erin

- **3D-viewport** (That Open Engine) met IFC-federatie: laad meerdere IFC-bestanden naast elkaar
- **Storax-componenten tekenen**: rooster-lamelwand, los roosterpaneel en drager (koker) —
  parametrisch, ook achteraf te bewerken, draaien en lengte aanpassen
- **IFC4-export** conform de BIM basis ILS-gedachte: juiste entiteiten, NL-SfB-classificatie,
  materiaal, standaard-psets én fabrikant-psets, kleuren, instelbaar nulpunt
- **2D-aanzichten** (boven/voor/achter/links/rechts, orthografisch) en **doorsnede**
- **2D-detailleren**: lijnen, rechthoeken, cirkels, teksten en meten — in het vlak van het
  actieve aanzicht
- **DXF-import** als onderlegger (LINE, polylijnen incl. bogen, cirkels, bogen, ellipsen,
  blokken) met snappen op het lijnwerk
- **Sheets**: tekeningbladen A4–A1 met vensters op ware schaal (1:10–1:500) en titelblok → PDF
- **Lagen, aantallenlijst (CSV), STL-export** (3D-print) en **PDF-export**

## Testpunten voor deze versie

1. Laad een eigen IFC (en eventueel een DXF-plattegrond) en teken er wanden overheen
2. Exporteer naar IFC en open het bestand in je eigen viewer/checker
3. Maak een sheet (bovenaanzicht 1:50 + vooraanzicht) en exporteer de PDF
4. Controleer of alle exports (IFC/PDF/STL/CSV) netjes als download verschijnen

## Bekende beperkingen

- DWG moet eerst naar DXF geconverteerd worden (native DWG staat op de routekaart)
- Doorsnede snijdt eigen componenten; geladen IFC-modellen mogelijk niet in alle gevallen
- PDF-vensters zijn rasterafbeeldingen op ware schaal (vectorieel volgt)
- De installer is niet code-ondertekend
