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
