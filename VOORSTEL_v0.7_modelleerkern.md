# Voorstel v0.7 — Modelleerkern volwassen: bewerken, typen en hoofdcategorieën

*Onderzoek + voorstel, 2026-07-16. Ter bespreking — beslispunten onderaan.*

## 1. Vaststelling: wat er nu is en wat ontbreekt

Geverifieerd in de v0.6.0-code (`src/core/studio.ts`, `src/App.tsx`, `src/core/types.ts`):

| Bewerkingsfunctie | Stand v0.6 | Referentie (Revit "Modify") |
|---|---|---|
| Selecteren | ✅ één element (klik) | klik + Ctrl-klik + venster + filter |
| Verplaatsen | ✅ verslepen (drag) | + Move met 2 punten en maatinvoer |
| Kopiëren | ⚠️ vaste offset haaks (1 m) | Copy met 2 punten, meerdere plakken |
| Knippen/plakken | ❌ | Ctrl+X/C/V, ook Paste Aligned |
| Roteren | ⚠️ vaste stappen ±15/±90° | Rotate om vrij punt met hoek |
| Spiegelen | ❌ | Mirror over as of 2 punten |
| Uitlijnen | ❌ | Align (as-op-as), Distribute |
| Trim/Extend | ❌ | wandeinden naar snijpunt |
| Hoekverbinding (join) | ❌ (PLAN Fase 1.4, nooit gebouwd) | wall joins: L / T / verstek, automatisch |
| Splitsen | ❌ | Split Element (op punt) |
| Reeks (array) | ❌ | Array lineair/radiaal |
| Offset | ❌ | Offset op afstand |
| Eigenschappen overnemen | ❌ | Match Type Properties |
| Gaten/sparingen | ⚠️ **1** rechthoekige sparing per element, alleen wandachtig | meerdere openingen, vorm vrij, ook vloer/dak/shaft |
| Typen aanmaken/bewerken | ⚠️ impliciet (typeKey bij export); presets als los bestand | Edit Type → Duplicate; type browser |
| Element-snapping | ⚠️ alleen 50 mm-raster + stramienpunten | endpoints, midpoints, edges, loodrecht, verlengden |

**Categorieën**: 24 losse `category`-strings ("Buitenwanden", "Roosters", "MEP — Ventilatie", "Gevelafwerking", …) zonder hiërarchie. De template-kiezer is één platte dropdown van 52+ items; het lagenpaneel toont alle 24 strings als aparte lagen. Er is geen begrip "hoofdcategorie Wanden" waar buitenwand + binnenwand + Storax-lamelwand onder vallen.

**Conclusie**: de studio kan plaatsen en parametrisch wijzigen, maar niet *bewerken* in de zin die een modelleur verwacht. Dit is de grootste kloof met een bruikbaar gereedschap en hoort vóór verdere feature-uitbreiding.

## 2. Onderzoek: hoe de referentiepakketten dit oplossen

### 2.1 Revit — het Modify-ribbon als contract

Revit's Modify-tab is al ~20 jaar stabiel en is de de-facto verwachting van elke BIM-modelleur: **Align · Offset · Mirror · Move · Copy · Rotate · Trim/Extend (3 varianten) · Split (2 varianten) · Array · Scale · Pin · Delete**, plus Match Type en Paste Aligned. Twee lessen:

1. **Bewerken werkt op de selectie, niet op een modus.** Eerst selecteren, dan gereedschap — of andersom; beide volgordes werken. Multi-select (Ctrl/venster) is de basis waar alles op rust.
2. **Wandverbindingen zijn automatisch.** Twee wanden waarvan eindpunten elkaar naderen joinen vanzelf (L), een eindpunt op een wandlijf wordt een T. De join is een *relatie* die meebeweegt bij verslepen — geen eenmalige geometrie-operatie. Disallow Join is de uitzondering, niet de regel.

Revit-categorieën zijn hard (Walls, Floors, Roofs, …) en sturen alles: ribbon-knoppen (Architecture-tab: Wall/Door/Window/Floor/Roof), view-filters, schedules, tag-familes. Binnen/buiten is een *functie-parameter* op het wandtype, geen aparte categorie.

### 2.2 Tekla — precisie-bewerken op onderdelen

Tekla voegt toe: numeriek bewerken (elke maat direct intypen), handles op elementeinden (eindpunt verslepen i.p.v. hele element), en Copy/Move special (met rotatie/spiegeling in één stap). Les: **eind-handles** zijn voor lijnvormige elementen (wanden, liggers) het natuurlijkste bewerkmiddel en maken trim/extend half overbodig.

### 2.3 HSBcad/hout — openingen als eersteklas objecten

In houtbouwpakketten is een sparing een object mét betekenis (raam-, deur-, leidingsparing) dat het regelwerk lokaal wijzigt. Les voor ons: **Opening als object met eigen id, type en host** — niet een veldje op het element. Dat sluit ook aan op onze bestaande `IfcOpeningElement`-export en elementeer-logica (die snijdt al panelen op sparingen).

### 2.4 Bonsai/IFC — verbindingen zijn data

IFC kent `IfcRelConnectsPathElements` (wand-op-wand, ATSTART/ATEND/ATPATH) en `IfcRelConnectsElements`. Een join die wij als relatie modelleren exporteert dus 1-op-1 naar IFC — een join die alleen geometrisch is (eindpunten verschoven) niet. Les: **joins als relaties opslaan**, geometrie afleiden.

## 3. Voorstel A — bewerkingslaag

### 3.1 Datamodel

```ts
// Studio
selectedIds: Set<string>           // vervangt selectedId: string | null
clipboard: SerializedElement[]     // via serialize; ook naar localStorage (cross-project)

// PlacedElement
openings: Opening[]                // vervangt opening?: Opening | null (migratie: 1→[1])
typeId?: string                    // verwijzing naar TypeDefinition (§4)

// Opening — uitgebreid
interface Opening {
  id: string;
  shape: "rect" | "round";
  xPos: number;                    // langs de as (of x in vlak-coördinaten bij vloer/dak)
  yPos?: number;                   // voor vlak-elementen (vloer/dak): 2e coördinaat
  breedte: number;                 // bij round: diameter
  hoogte: number;
  zBottom?: number;                // onderkant sparing (nu impliciet 0)
  kind?: "raam" | "deur" | "leiding" | "vrij";
}

// Nieuw: verbindingen
interface ElementJoin {
  id: string;
  aId: string; aEnd: "start" | "end";
  bId: string; bEnd: "start" | "end" | "path";   // path = T-verbinding
}
joins: ElementJoin[]               // op Studio; export → IfcRelConnectsPathElements
```

`applyOpening()` in meshBuilder generaliseert naar meerdere openingen + rond (cirkel benaderd met segmenten of boolean via three-bvh-csg — voorstel: rechthoek exact, rond via 16-segment benadering, geen CSG-dependency in v0.7).

### 3.2 Gereedschappen (bouwvolgorde)

1. **Multi-select**: Ctrl-klik togglet, venster-selectie (links→rechts = omsluitend, rechts→links = kruisend, CAD-conventie), Esc deselecteert. Parameterpaneel toont gedeelde params bij homogene selectie.
2. **Klembord**: Ctrl+C/X/V. Plakken volgt de cursor (preview) en bevestigt met klik; Ctrl+V nogmaals plakt opnieuw. Klembord serialiseert naar localStorage → plakken tussen twee open projecten werkt.
3. **Eind-handles** (Tekla-les): geselecteerd lijnelement toont bolletjes op start/end; verslepen wijzigt alleen dat eindpunt (met element-snapping). Dit ís trim/extend voor 90 % van de gevallen.
4. **Element-snapping** (voorwaarde voor 3, 5, 6): snappen op endpoints, midpoints en loodrechte projectie op assen van bestaande elementen; visuele snap-markers (vierkant = endpoint, driehoek = midpoint, ⊥-symbool). Raster- en stramien-snap blijven.
5. **Uitlijnen/spiegelen/reeks/offset**: Align (klik doel-as, dan te verplaatsen element), Mirror (2 punten of stramienlijn, kopie-optie), Array (n × h.o.h. langs richting), Offset (afstand, kopie evenwijdig).
6. **Joins**: automatisch bij snap-op-eindpunt (L) en snap-op-lijf (T) tijdens tekenen/handle-slepen; join beweegt mee (relatie herberekent eindpunten). Geometrisch: hoekverstek in bovenaanzicht door beide wandcontouren tot snijlijn door te zetten (verstek alleen tussen wanden met zelfde `depth`-klasse; anders butt-joint). Handmatig: "Verbind"/"Verbreek verbinding"-knoppen.
7. **Splitsen**: klik op punt langs de as → twee elementen, params gekopieerd, openingen verdeeld op positie, joins blijven aan de buiteneinden.
8. **Match properties**: penseel — klik bron, klik doel(en); neemt type-params over, niet lengte/positie.
9. **Sparingstool**: klik op element → sparing op klikpunt met live preview; werkt op wanden én (nieuw) vloeren/daken (vlak-coördinaten). Kozijn plaatsen maakt automatisch een gekoppelde sparing (kind:"raam"/"deur") — vervangt de losse checkbox.

## 4. Voorstel B — typen als eersteklas begrip

Nu ontstaat een "type" pas bij IFC-export (hash van template+params). Voorstel:

```ts
interface TypeDefinition {
  id: string;
  name: string;               // "HSB-wand 396 Rc4.7 — variant B"
  templateId: string;
  typeParams: ParamValues;    // de vastgezette parameters
}
```

- **Opslag**: in het projectbestand én (optioneel, beslispunt 4) in een gebruikersbibliotheek (appdata) zodat typen projecten overstijgen.
- **Aanmaken**: (a) "Opslaan als type" vanaf geselecteerd element; (b) "Dupliceer type" in het parameterpaneel (Revit-patroon: dupliceren → naam → params wijzigen); (c) bestaande presets (.o3st-parameterpresets) migreren hiernaartoe.
- **Gebruik**: de kiezer wordt getrapte selectie *hoofdcategorie → template → type*; plaatsen zet `typeId` op het element; type-param wijzigen werkt door op álle instanties (met melding hoeveel).
- **Export**: `IfcWallType` e.d. krijgen de typenaam i.p.v. het gegenereerde volgnummer; de bestaande type-groepering blijft als vangnet voor elementen zonder typeId.
- **Relatie met .o3st**: een `.o3st` blijft een *template* (parametrische definitie); een type is een *instelling* daarvan. Type exporteren als deelbaar bestand = klein `.o3sty`-JSON met templateId-referentie.

## 5. Voorstel C — hoofdcategorieën

### 5.1 Taxonomie

Eén vaste lijst `MainCategory`, afgeleid van NL-SfB-hoofdgroep (override per template mogelijk):

| MainCategory | NL-SfB | Huidige categorie-strings die erin opgaan |
|---|---|---|
| Fundering | 13/16/17 | Fundering |
| Wanden | 21/22 | Buitenwanden, Binnenwanden, Roosterwanden, Dragers, Roosters |
| Vloeren | 23 | Vloeren |
| Trappen & hellingen | 24 | Trappen |
| Daken | 27 | Daken |
| Draagconstructie | 28 | Hoofddraagconstructie |
| Kozijnen & deuren | 31/32 | Buitenkozijnen, Buitendeuren, Binnendeuren |
| Balustrades & leuningen | 34 | Balustrades |
| Afwerkingen | 4x | Gevelafwerking, Gevelbekleding, Vloerafwerking, Plafonds |
| Installaties | 5x/6x | alle "MEP — …" |
| Ruimten | 90 | Ruimten |
| Import & eigen | — | "Import — <bron>", plugin-templates |

Binnen/buiten (21 vs 22) wordt **subcategorie/filter binnen Wanden**, zoals Revit's Function-parameter — één plek voor al het wandgereedschap, met de NL-SfB-code als het harde onderscheid dat blijft bestaan voor ILS/export.

### 5.2 Wat de hoofdcategorie aanstuurt

1. **Kiezer**: getrapt — hoofdcategorie-tabs met daarbinnen template → type (einde van de platte 52+-dropdown).
2. **Ribbon "Tekenen"**: één knop per hoofdcategorie (Wand · Vloer · Dak · Kolom/Ligger · Kozijn · Trap · Installatie …), Revit-patroon: klik = teken met laatst gebruikte type in die categorie; pijltje = variant kiezen.
3. **Lagenpaneel**: hoofdcategorieën als lagen (12 i.p.v. 24 losse strings), uitklapbaar naar subcategorie.
4. **Category-defaults**: default `placementKind`, snapping-gedrag (kozijn snapt op wand-as, vloer op contour), parameterpaneel-groepering en sparingstool-gedrag per categorie.
5. **Datamodel**: `mainCategory?: MainCategory` op ComponentTemplate; ontbreekt hij, dan afleiden uit NL-SfB. Bestaande `category`-string blijft als weergave-subcategorie — geen breaking change voor templates of .o3st-bestanden.

## 6. Fasering (voorstel ≈ 11–13 weken)

| Sprint | Inhoud | Duur |
|---|---|---|
| S1 | Multi-select (Ctrl, venster) + klembord (C/X/V, cross-project) + bulk verwijderen/dupliceren | 2 w |
| S2 | Element-snapping (endpoint/midpoint/⊥) + eind-handles + uitlijnen + spiegelen + reeks + offset | 2–3 w |
| S3 | Joins (L/T, automatisch + handmatig, meebewegend) + splitsen + `IfcRelConnectsPathElements` | 2–3 w |
| S4 | Openingen 2.0: meerdere per element, rond+rechthoek, vloeren/daken, sparingstool, kozijn→sparing-koppeling | 2 w |
| S5 | Typen: TypeDefinition, opslaan-als/dupliceren, typenbrowser, doorwerking op instanties, IfcType-namen | 2 w |
| S6 | Hoofdcategorieën: taxonomie + getrapte kiezer + ribbon-knoppen + lagen op hoofdcategorie | 1–2 w |

Volgorde-rationale: S2 (snapping) is voorwaarde voor S3; S6 kan desgewenst naar voren omdat hij onafhankelijk is (beslispunt 7).

## 7. Beslispunten

1. **Wanden één hoofdcategorie** (21+22 samen, binnen/buiten als filter — Revit-model) of gescheiden houden?
2. **Joins als meebewegende relatie** (voorstel; exporteert naar IFC) of eenmalige geometrische operatie (simpeler, breekt bij verslepen)?
3. **Klembord cross-project** via localStorage (voorstel) of alleen binnen de sessie?
4. **Typen ook in centrale gebruikersbibliotheek** (naast projectbestand) of alleen per project?
5. **Ribbon-knoppen per hoofdcategorie** (Revit-stijl, voorstel) of de getrapte kiezer alleen in het zijpaneel?
6. **Openingen v0.7**: rechthoek + rond (voorstel), vrije polygoon naar v0.8?
7. **Volgorde**: S1→S6 zoals voorgesteld, of hoofdcategorieën (S6) éérst als organiserend fundament?
8. **Ronde sparingen**: 16-segment-benadering (geen dependency, voorstel) of echte CSG via three-bvh-csg (mooier, +1 dependency, zwaarder)?
