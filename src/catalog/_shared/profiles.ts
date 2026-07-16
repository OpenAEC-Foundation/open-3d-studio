import type { ProfileSpec } from "../../core/types";

/** Constructieve profielcatalogus — samengesteld uit NEN-EN 10365 (staal) plus
 *  gebruikelijke NL-maten voor betonprefab en gelamineerd hout.
 *
 *  Elke entry is een `ProfileSpec` die exact aansluit op de IFC-profieldefinities:
 *    - IShape       → IfcIShapeProfileDef        (h, b, tw, tf, r)
 *    - RectangleHollow → IfcRectangleHollowProfileDef (h, b, wallThickness)
 *    - CircleHollow → IfcCircleHollowProfileDef  (radius, wallThickness)
 *    - UShape       → IfcUShapeProfileDef        (h, b, tw, tf, r)
 *    - LShape       → IfcLShapeProfileDef        (h, w, t, r)
 *    - Rectangle    → IfcRectangleProfileDef     (h, b)          (beton, glulam)
 *    - Circle       → IfcCircleProfileDef        (radius)         (ronde kolom)
 */

// -------------------- IPE -------------------- (EN 10365 tabel 1)
const IPE: ProfileSpec[] = [
  ["IPE 80",  80,  46, 3.8, 5.2, 5],
  ["IPE 100", 100, 55, 4.1, 5.7, 7],
  ["IPE 120", 120, 64, 4.4, 6.3, 7],
  ["IPE 140", 140, 73, 4.7, 6.9, 7],
  ["IPE 160", 160, 82, 5.0, 7.4, 9],
  ["IPE 180", 180, 91, 5.3, 8.0, 9],
  ["IPE 200", 200, 100, 5.6, 8.5, 12],
  ["IPE 220", 220, 110, 5.9, 9.2, 12],
  ["IPE 240", 240, 120, 6.2, 9.8, 15],
  ["IPE 270", 270, 135, 6.6, 10.2, 15],
  ["IPE 300", 300, 150, 7.1, 10.7, 15],
  ["IPE 330", 330, 160, 7.5, 11.5, 18],
  ["IPE 360", 360, 170, 8.0, 12.7, 18],
  ["IPE 400", 400, 180, 8.6, 13.5, 21],
  ["IPE 450", 450, 190, 9.4, 14.6, 21],
  ["IPE 500", 500, 200, 10.2, 16.0, 21],
  ["IPE 550", 550, 210, 11.1, 17.2, 24],
  ["IPE 600", 600, 220, 12.0, 19.0, 24],
].map(([designation, h, b, tw, tf, r]) => ({
  shape: "IShape",
  designation: designation as string,
  dimensions: { OverallDepth: h as number, OverallWidth: b as number, WebThickness: tw as number, FlangeThickness: tf as number, FilletRadius: r as number },
}));

// -------------------- HEA / HEB / HEM -------------------- (selectie NEN-EN 10365)
function HE(prefix: "HEA" | "HEB" | "HEM"): ProfileSpec[] {
  // Standaardmaten die 90% van NL-constructieprojecten dekken
  const rows: Array<[string, number, number, number, number, number]> = [
    // designation, h, b, tw, tf, r
    [`${prefix} 100`, prefix === "HEA" ? 96  : prefix === "HEB" ? 100 : 120, 100, prefix === "HEA" ? 5.0 : prefix === "HEB" ? 6.0 : 12.0, prefix === "HEA" ? 8.0  : prefix === "HEB" ? 10.0 : 20.0, 12],
    [`${prefix} 120`, prefix === "HEA" ? 114 : prefix === "HEB" ? 120 : 140, 120, prefix === "HEA" ? 5.0 : prefix === "HEB" ? 6.5 : 12.5, prefix === "HEA" ? 8.0  : prefix === "HEB" ? 11.0 : 21.0, 12],
    [`${prefix} 140`, prefix === "HEA" ? 133 : prefix === "HEB" ? 140 : 160, 140, prefix === "HEA" ? 5.5 : prefix === "HEB" ? 7.0 : 13.0, prefix === "HEA" ? 8.5  : prefix === "HEB" ? 12.0 : 22.0, 12],
    [`${prefix} 160`, prefix === "HEA" ? 152 : prefix === "HEB" ? 160 : 180, 160, prefix === "HEA" ? 6.0 : prefix === "HEB" ? 8.0 : 14.0, prefix === "HEA" ? 9.0  : prefix === "HEB" ? 13.0 : 23.0, 15],
    [`${prefix} 180`, prefix === "HEA" ? 171 : prefix === "HEB" ? 180 : 200, 180, prefix === "HEA" ? 6.0 : prefix === "HEB" ? 8.5 : 14.5, prefix === "HEA" ? 9.5  : prefix === "HEB" ? 14.0 : 24.0, 15],
    [`${prefix} 200`, prefix === "HEA" ? 190 : prefix === "HEB" ? 200 : 220, 200, prefix === "HEA" ? 6.5 : prefix === "HEB" ? 9.0 : 15.0, prefix === "HEA" ? 10.0 : prefix === "HEB" ? 15.0 : 25.0, 18],
    [`${prefix} 220`, prefix === "HEA" ? 210 : prefix === "HEB" ? 220 : 240, 220, prefix === "HEA" ? 7.0 : prefix === "HEB" ? 9.5 : 15.5, prefix === "HEA" ? 11.0 : prefix === "HEB" ? 16.0 : 26.0, 18],
    [`${prefix} 240`, prefix === "HEA" ? 230 : prefix === "HEB" ? 240 : 270, 240, prefix === "HEA" ? 7.5 : prefix === "HEB" ? 10.0 : 18.0, prefix === "HEA" ? 12.0 : prefix === "HEB" ? 17.0 : 32.0, 21],
    [`${prefix} 260`, prefix === "HEA" ? 250 : prefix === "HEB" ? 260 : 290, 260, prefix === "HEA" ? 7.5 : prefix === "HEB" ? 10.0 : 18.0, prefix === "HEA" ? 12.5 : prefix === "HEB" ? 17.5 : 32.5, 24],
    [`${prefix} 280`, prefix === "HEA" ? 270 : prefix === "HEB" ? 280 : 310, 280, prefix === "HEA" ? 8.0 : prefix === "HEB" ? 10.5 : 18.5, prefix === "HEA" ? 13.0 : prefix === "HEB" ? 18.0 : 33.0, 24],
    [`${prefix} 300`, prefix === "HEA" ? 290 : prefix === "HEB" ? 300 : 340, 300, prefix === "HEA" ? 8.5 : prefix === "HEB" ? 11.0 : 21.0, prefix === "HEA" ? 14.0 : prefix === "HEB" ? 19.0 : 39.0, 27],
    [`${prefix} 320`, prefix === "HEA" ? 310 : prefix === "HEB" ? 320 : 359, 300, prefix === "HEA" ? 9.0 : prefix === "HEB" ? 11.5 : 21.0, prefix === "HEA" ? 15.5 : prefix === "HEB" ? 20.5 : 40.0, 27],
    [`${prefix} 340`, prefix === "HEA" ? 330 : prefix === "HEB" ? 340 : 377, 300, prefix === "HEA" ? 9.5 : prefix === "HEB" ? 12.0 : 21.0, prefix === "HEA" ? 16.5 : prefix === "HEB" ? 21.5 : 40.0, 27],
    [`${prefix} 360`, prefix === "HEA" ? 350 : prefix === "HEB" ? 360 : 395, 300, prefix === "HEA" ? 10.0 : prefix === "HEB" ? 12.5 : 21.0, prefix === "HEA" ? 17.5 : prefix === "HEB" ? 22.5 : 40.0, 27],
    [`${prefix} 400`, prefix === "HEA" ? 390 : prefix === "HEB" ? 400 : 432, 300, prefix === "HEA" ? 11.0 : prefix === "HEB" ? 13.5 : 21.0, prefix === "HEA" ? 19.0 : prefix === "HEB" ? 24.0 : 40.0, 27],
    [`${prefix} 450`, prefix === "HEA" ? 440 : prefix === "HEB" ? 450 : 478, 300, prefix === "HEA" ? 11.5 : prefix === "HEB" ? 14.0 : 21.0, prefix === "HEA" ? 21.0 : prefix === "HEB" ? 26.0 : 40.0, 27],
    [`${prefix} 500`, prefix === "HEA" ? 490 : prefix === "HEB" ? 500 : 524, 300, prefix === "HEA" ? 12.0 : prefix === "HEB" ? 14.5 : 21.0, prefix === "HEA" ? 23.0 : prefix === "HEB" ? 28.0 : 40.0, 27],
    [`${prefix} 550`, prefix === "HEA" ? 540 : prefix === "HEB" ? 550 : 572, 300, prefix === "HEA" ? 12.5 : prefix === "HEB" ? 15.0 : 21.0, prefix === "HEA" ? 24.0 : prefix === "HEB" ? 29.0 : 40.0, 27],
    [`${prefix} 600`, prefix === "HEA" ? 590 : prefix === "HEB" ? 600 : 620, 300, prefix === "HEA" ? 13.0 : prefix === "HEB" ? 15.5 : 21.0, prefix === "HEA" ? 25.0 : prefix === "HEB" ? 30.0 : 40.0, 27],
    [`${prefix} 700`, prefix === "HEA" ? 690 : prefix === "HEB" ? 700 : 716, 300, prefix === "HEA" ? 14.5 : prefix === "HEB" ? 17.0 : 21.0, prefix === "HEA" ? 27.0 : prefix === "HEB" ? 32.0 : 40.0, 27],
    [`${prefix} 800`, prefix === "HEA" ? 790 : prefix === "HEB" ? 800 : 814, 300, prefix === "HEA" ? 15.0 : prefix === "HEB" ? 17.5 : 21.0, prefix === "HEA" ? 28.0 : prefix === "HEB" ? 33.0 : 40.0, 30],
    [`${prefix} 900`, prefix === "HEA" ? 890 : prefix === "HEB" ? 900 : 910, 300, prefix === "HEA" ? 16.0 : prefix === "HEB" ? 18.5 : 21.0, prefix === "HEA" ? 30.0 : prefix === "HEB" ? 35.0 : 40.0, 30],
    [`${prefix} 1000`, prefix === "HEA" ? 990 : prefix === "HEB" ? 1000 : 1008, 300, prefix === "HEA" ? 16.5 : prefix === "HEB" ? 19.0 : 21.0, prefix === "HEA" ? 31.0 : prefix === "HEB" ? 36.0 : 40.0, 30],
  ];
  return rows.map(([designation, h, b, tw, tf, r]) => ({
    shape: "IShape",
    designation,
    dimensions: { OverallDepth: h, OverallWidth: b, WebThickness: tw, FlangeThickness: tf, FilletRadius: r },
  }));
}

// -------------------- UNP -------------------- (kanaalprofielen)
const UNP: ProfileSpec[] = [
  ["UNP 80",  80,  45, 6.0, 8.0, 8],
  ["UNP 100", 100, 50, 6.0, 8.5, 8.5],
  ["UNP 120", 120, 55, 7.0, 9.0, 9],
  ["UNP 140", 140, 60, 7.0, 10.0, 10],
  ["UNP 160", 160, 65, 7.5, 10.5, 10.5],
  ["UNP 180", 180, 70, 8.0, 11.0, 11],
  ["UNP 200", 200, 75, 8.5, 11.5, 11.5],
  ["UNP 220", 220, 80, 9.0, 12.5, 12.5],
  ["UNP 240", 240, 85, 9.5, 13.0, 13],
  ["UNP 260", 260, 90, 10.0, 14.0, 14],
  ["UNP 280", 280, 95, 10.0, 15.0, 15],
  ["UNP 300", 300, 100, 10.0, 16.0, 16],
  ["UNP 320", 320, 100, 14.0, 17.5, 17.5],
  ["UNP 350", 350, 100, 14.0, 16.0, 16],
  ["UNP 380", 380, 102, 13.5, 16.0, 16],
  ["UNP 400", 400, 110, 14.0, 18.0, 18],
].map(([designation, h, b, tw, tf, r]) => ({
  shape: "UShape",
  designation: designation as string,
  dimensions: { OverallDepth: h as number, FlangeWidth: b as number, WebThickness: tw as number, FlangeThickness: tf as number, FilletRadius: r as number },
}));

// -------------------- SHS / RHS koker --------------------
function hollowRect(prefix: "SHS" | "RHS"): ProfileSpec[] {
  const shsData: Array<[number, number, number]> = [
    [40, 40, 3], [50, 50, 3], [50, 50, 4], [60, 60, 4], [70, 70, 4], [80, 80, 4], [80, 80, 5], [90, 90, 5],
    [100, 100, 5], [100, 100, 6], [100, 100, 8], [120, 120, 5], [120, 120, 6], [120, 120, 8], [140, 140, 6],
    [140, 140, 8], [150, 150, 6], [150, 150, 8], [160, 160, 6], [160, 160, 8], [180, 180, 8], [200, 200, 8],
    [200, 200, 10], [200, 200, 12], [220, 220, 10], [250, 250, 10], [300, 300, 12], [350, 350, 12], [400, 400, 16],
  ];
  const rhsData: Array<[number, number, number]> = [
    [50, 30, 3], [60, 40, 3], [80, 40, 4], [100, 50, 4], [100, 60, 5], [120, 60, 5], [120, 80, 5], [140, 80, 5],
    [150, 100, 6], [160, 80, 6], [180, 100, 6], [200, 100, 6], [200, 120, 8], [250, 150, 8], [300, 200, 10],
    [400, 200, 12],
  ];
  const data = prefix === "SHS" ? shsData : rhsData;
  return data.map(([h, b, t]) => ({
    shape: "RectangleHollow",
    designation: `${prefix} ${h}x${b}x${t}`,
    dimensions: { XDim: h, YDim: b, WallThickness: t },
  }));
}

// -------------------- CHS buis --------------------
const CHS: ProfileSpec[] = [
  [42.4, 3.2], [48.3, 3.2], [60.3, 3.6], [76.1, 4.0], [88.9, 4.0], [101.6, 4.0], [114.3, 4.0], [139.7, 5.0],
  [168.3, 6.3], [193.7, 6.3], [219.1, 6.3], [244.5, 6.3], [273.0, 8.0], [323.9, 8.0], [355.6, 8.8], [406.4, 10],
  [457.0, 10], [508.0, 12.5],
].map(([od, t]) => ({
  shape: "CircleHollow",
  designation: `CHS Ø${od}x${t}`,
  dimensions: { Radius: od / 2, WallThickness: t },
}));

// -------------------- L-hoekstaal --------------------
const L: ProfileSpec[] = [
  [40, 40, 4], [50, 50, 5], [60, 60, 6], [80, 80, 8], [100, 100, 10], [120, 120, 12], [150, 150, 15], [200, 200, 20],
].map(([h, w, t]) => ({
  shape: "LShape",
  designation: `L ${h}x${w}x${t}`,
  dimensions: { Depth: h, Width: w, Thickness: t, FilletRadius: t },
}));

// -------------------- Prefab beton rechthoek + rond --------------------
const BETON_RECHT: ProfileSpec[] = [
  [200, 200], [250, 250], [300, 300], [400, 300], [400, 400], [500, 400], [500, 500], [600, 400], [800, 400],
].map(([h, b]) => ({
  shape: "Rectangle",
  designation: `Beton ${h}x${b}`,
  dimensions: { XDim: h, YDim: b },
}));

const BETON_ROND: ProfileSpec[] = [
  [300], [400], [500], [600],
].map(([d]) => ({
  shape: "Circle",
  designation: `Beton Ø${d}`,
  dimensions: { Radius: d / 2 },
}));

// -------------------- Glulam gelamineerd hout --------------------
const GLULAM: ProfileSpec[] = [
  [120, 100], [160, 140], [200, 160], [240, 180], [280, 200], [320, 200], [360, 240], [400, 240], [500, 280], [600, 300], [800, 300],
].map(([h, b]) => ({
  shape: "Rectangle",
  designation: `Glulam ${h}x${b}`,
  dimensions: { XDim: h, YDim: b },
}));

// -------------------- Alles bij elkaar --------------------
export const STEEL_PROFILES: ProfileSpec[] = [
  ...IPE,
  ...HE("HEA"),
  ...HE("HEB"),
  ...HE("HEM"),
  ...UNP,
  ...hollowRect("SHS"),
  ...hollowRect("RHS"),
  ...CHS,
  ...L,
];

export const CONCRETE_PROFILES: ProfileSpec[] = [...BETON_RECHT, ...BETON_ROND];
export const GLULAM_PROFILES: ProfileSpec[] = GLULAM;

export function findProfile(designation: string): ProfileSpec | undefined {
  return (
    STEEL_PROFILES.find((p) => p.designation === designation) ||
    CONCRETE_PROFILES.find((p) => p.designation === designation) ||
    GLULAM_PROFILES.find((p) => p.designation === designation)
  );
}

/** Optielijst voor een select-parameter (value = designation, label = designation). */
export function profileOptions(pool: ProfileSpec[]): Array<{ value: string; label: string }> {
  return pool.map((p) => ({ value: p.designation, label: p.designation }));
}
