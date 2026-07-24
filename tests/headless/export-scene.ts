import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as THREE from "three";
import { getTemplate } from "../../src/catalog/registry";
import { exportElementsToIfc } from "../../src/core/ifcExport";
import type { ElementJoin, PlacedElement, Storey, TypeDefinition } from "../../src/core/types";

/** Onafhankelijke IFC-poort, deel 1: exporteren.
 *
 *  Bouwt een kleine maar representatieve scène met échte catalogus-templates
 *  en draait de échte `exportElementsToIfc` — de code die de app gebruikt,
 *  niet een nabootsing. Het resultaat gaat naar tests/out/poort.ifc, waarna
 *  tests/validate_ifc.py er de IfcOpenShell-poort (schema + alle EXPRESS
 *  WHERE-regels) overheen legt. Samen: `npm run test:ifc`.
 *
 *  De scène raakt bewust veel exportpaden tegelijk: twee bouwlagen, stramien,
 *  RD-georeferentie, een benoemd type met twee instanties, een L-verbinding,
 *  een gehost kozijn en een gehoste deur (RelVoids + RelFills), een staal-
 *  profiel (IfcMaterialProfileSetUsage), een vlak-element en een wand met
 *  materiaallagen (IfcMaterialLayerSet). */

// Aan de werkmap geankerd, niet aan import.meta.url: de gebundelde versie
// draait uit tests/headless/dist/ en zou anders één map te diep schrijven.
// `npm run test:ifc` draait altijd vanaf de repowortel.
const OUT = resolve(process.cwd(), "tests/out/poort.ifc");

function tpl(id: string) {
  const t = getTemplate(id);
  if (!t) throw new Error(`Template "${id}" niet gevonden in de catalogus — poortscène kan niet gebouwd worden.`);
  return t;
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Element met de template-defaults als parameters, zoals de app dat ook doet. */
function el(
  id: string,
  templateId: string,
  name: string,
  start: THREE.Vector3,
  end: THREE.Vector3,
  extra: Partial<PlacedElement> = {},
): PlacedElement {
  return { id, templateId, name, start, end, params: { ...tpl(templateId).defaults }, storeyId: "s0", ...extra };
}

const storeys: Storey[] = [
  { id: "s0", name: "00 begane grond", elevation: 0 },
  { id: "s1", name: "01 eerste verdieping", elevation: 3 },
];

// three.js-wereld: y = omhoog, plattegrond in het x/z-vlak (export mapt y=-z, z=y).
const elements: PlacedElement[] = [
  el("wand-a", "hsb-buitenwand", "Wand A", v(0, 0, 0), v(5.4, 0, 0), { typeId: "type-hsb" }),
  el("wand-b", "hsb-buitenwand", "Wand B", v(5.4, 0, 0), v(5.4, 0, 4.2), { typeId: "type-hsb" }),
  el("raam-1", "kozijn-draai-kiep", "Raam 1", v(1.5, 0, 0), v(2.7, 0, 0), { hostId: "wand-a" }),
  el("deur-1", "voordeur", "Voordeur", v(5.4, 0, 1.0), v(5.4, 0, 1.93), { hostId: "wand-b" }),
  el("ligger-1", "staalprofiel-nen10365", "Stalen ligger", v(0, 2.7, 0), v(5.4, 2.7, 0)),
  el("vloer-1", "vbi-kanaalplaat", "Verdiepingsvloer", v(0, 3, 0), v(5.4, 3, 0), { storeyId: "s1" }),
  el("lamelwand-1", "storax-rooster-lamelwand", "Lamelwand", v(0, 3, 4.2), v(5.4, 3, 4.2), { storeyId: "s1" }),
];

const joins: ElementJoin[] = [{ id: "j1", aId: "wand-a", aEnd: "end", bId: "wand-b", bEnd: "start" }];

const types: TypeDefinition[] = [
  {
    id: "type-hsb",
    name: "HSB buitenwand — poortscène",
    templateId: "hsb-buitenwand",
    typeParams: { ...tpl("hsb-buitenwand").defaults },
  },
];

const bytes = await exportElementsToIfc(elements, {
  projectName: "Open 3D Studio — headless poortscène",
  storeys,
  grid: { enabled: true, countX: 3, spacingX: 5.4, countY: 2, spacingY: 5.4 },
  geoRef: { rdX: 155000, rdY: 463000, napZ: 2.5 },
  joins,
  types,
});

// Grove ondergrens, geen oordeel: het oordeel is aan de Python-poort.
if (bytes.byteLength < 1000) {
  console.error(`Export verdacht klein: ${bytes.byteLength} B — dat is geen model.`);
  process.exit(1);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, bytes);
console.log(`poort.ifc geschreven: ${bytes.byteLength} B, ${elements.length} elementen -> ${OUT}`);
