# Open 3D Studio v0.2.0 — ribbon, projectbestanden en native opslaan

Tweede testversie, gebaseerd op de eerste testronde-feedback.

## Installatie (Windows)

Download `Open-3D-Studio_0.2.0_x64-setup.exe` hieronder en voer het uit (SmartScreen:
"Meer informatie" → "Toch uitvoeren"). Installeren over v0.1.0 heen kan gewoon.

## Nieuw in v0.2.0

- **Ribbon** in OpenAEC-stijl met tabbladen Start / Tekenen / Aanzicht / Sheets
- **Taalkeuze NL/EN** en **licht/donker-kleurmodus** (rechtsboven in de ribbon)
- **Projectbestanden (.o3s)**: al je componenten, lijnen, maten, teksten, sheets en het
  nulpunt worden bewaard — "Opslaan als" en "Openen" op het Start-tabblad
- **Native bestandsvensters in de desktop-app**: openen én opslaan gaan nu via echte
  Windows-dialogen (dit lost het niet kunnen laden/opslaan uit v0.1.0 op)
- Alle exports (IFC, STL, PDF, CSV, sheets) via "Opslaan als" met vrije locatiekeuze
- **NL-SfB viercijferig** (22.21) conform BIM basis ILS 2.0
- Devtools beschikbaar in de desktop-app (Ctrl+Shift+I) voor foutmeldingen

## Verder

- Het plan voor de komende versies staat in [PLAN.md](PLAN.md): studie van
  Revit/Tekla/HSBcad/Bonsai, BIM basis ILS-toets en vier fasen naar v1.0

## Bekende beperkingen

- Statusmeldingen (onderin) zijn nog Nederlandstalig, ook in de EN-modus
- DWG eerst naar DXF converteren; doorsnede snijdt geladen IFC's mogelijk niet
- PDF-vensters zijn rasterafbeeldingen op ware schaal; installer niet ondertekend
