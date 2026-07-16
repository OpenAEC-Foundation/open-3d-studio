import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";

/** Rechte trap — één trapvlucht (IfcStairFlight) binnen een IfcStair-assembly.
 *
 *  Eerste `AssemblyTemplate` proof-of-concept: één template levert de treden,
 *  de zomen en de leuning als samengestelde solids. IFC-export (v0.4-S9) verpakt
 *  dit als `IfcStair` (assembly) met `IfcStairFlight` + `IfcRailing` als members. */

const MM = 0.001;

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const rechteTrap: ComponentTemplate = {
  id: "trap-recht",
  name: "Rechte trap (IfcStair assembly)",
  category: "Trappen",
  nlSfb: "24.11",
  classification: { system: "NL-SfB", code: "24.11" },
  material: "Hout / staal, leuning aan één zijde",
  loadBearing: true,

  placementKind: "assembly",
  ifcEntity: "IfcStair",
  ifcPredefinedType: "STRAIGHT_RUN_STAIR",

  params: [
    { key: "aantalTreden", label: "Aantal optredes", type: "length", min: 8, max: 22, step: 1 },
    { key: "optrede", label: "Optrede", type: "length", min: 150, max: 220, step: 1 },
    { key: "aantrede", label: "Aantrede", type: "length", min: 180, max: 320, step: 1 },
    { key: "trapbreedte", label: "Trapbreedte", type: "length", min: 800, max: 1500, step: 10 },
    { key: "leuningHoogte", label: "Leuninghoogte", type: "length", min: 800, max: 1100, step: 10 },
    { key: "basisHoogte", label: "Basispeil (b.k. onderste tred)", type: "length", min: -5000, max: 20000, step: 10 },
  ],
  defaults: { aantalTreden: 17, optrede: 176, aantrede: 240, trapbreedte: 900, leuningHoogte: 900, basisHoogte: 0 },

  depth(p) { return num(p, "trapbreedte") * MM; },
  color() { return "#a8845a"; },

  solids(_l, p): SolidBox[] {
    const n = Math.round(num(p, "aantalTreden"));
    const opt = num(p, "optrede") * MM;
    const aan = num(p, "aantrede") * MM;
    const br = num(p, "trapbreedte") * MM;
    const lh = num(p, "leuningHoogte") * MM;
    const out: SolidBox[] = [];

    // Treden: elke tred een blok van aantrede × trapbreedte × 40mm dikte
    const dikte = 0.04;
    for (let i = 0; i < n; i++) {
      const cx = i * aan + aan / 2;
      const z = (i + 1) * opt - dikte;
      out.push({ cx, cy: 0, zBottom: z, dx: aan, dy: br, dz: dikte });
    }

    // Boomhoutzoom aan beide zijden (dunne balk langs de opgaande diagonaal, benadering)
    const zomHoogte = opt + 0.05;
    for (let i = 0; i < n; i++) {
      const cx = i * aan + aan / 2;
      const zBot = i * opt;
      out.push({ cx, cy: -br / 2 + 0.02, zBottom: zBot, dx: aan, dy: 0.04, dz: zomHoogte });
      out.push({ cx, cy: br / 2 - 0.02, zBottom: zBot, dx: aan, dy: 0.04, dz: zomHoogte });
    }

    // Leuning rechts: horizontale liggende buis boven de treden
    const totLen = n * aan;
    const topZ = (n - 1) * opt + lh;
    out.push({ cx: totLen / 2, cy: br / 2 - 0.02, zBottom: topZ - 0.04, dx: totLen, dy: 0.04, dz: 0.04 });
    // Balusters om de 3 treden
    for (let i = 0; i < n; i += 3) {
      const cx = i * aan + aan / 2;
      const zBase = i * opt + opt;
      const hgt = topZ - zBase;
      if (hgt > 0.1) out.push({ cx, cy: br / 2 - 0.02, zBottom: zBase, dx: 0.03, dy: 0.03, dz: hgt });
    }
    return out;
  },

  psetName: "Trap_Recht",
  psetProps(_l, p) {
    return {
      Type: "Rechte trap",
      AantalOptredes: Math.round(num(p, "aantalTreden")),
      Optrede_mm: num(p, "optrede"),
      Aantrede_mm: num(p, "aantrede"),
      Trapbreedte_mm: num(p, "trapbreedte"),
    };
  },

  commonPset(_l, p) {
    return {
      NumberOfRiser: Math.round(num(p, "aantalTreden")),
      NumberOfTreads: Math.round(num(p, "aantalTreden")) - 1,
      RiserHeight: num(p, "optrede") / 1000,
      TreadLength: num(p, "aantrede") / 1000,
      RequiredHeadroom: 2.05,
    };
  },
};
