import type { ComponentTemplate, ParamValues, SolidBox } from "../../core/types";

/** 2-kwart-trap met tussenbordes — twee trapvluchten haaks op elkaar plus
 *  een `IfcSlab.LANDING` als tussenbordes. Vereenvoudigde geometrische weergave. */

const MM = 0.001;

function num(p: ParamValues, key: string): number {
  const v = p[key];
  return typeof v === "number" ? v : parseFloat(String(v));
}

export const kwartTrap: ComponentTemplate = {
  id: "trap-2kwart",
  name: "2-kwart-trap met bordes",
  category: "Trappen",
  nlSfb: "24.12",
  classification: { system: "NL-SfB", code: "24.12" },
  material: "Hout / staal, leuningen aan beide zijden",
  loadBearing: true,

  placementKind: "assembly",
  ifcEntity: "IfcStair",
  ifcPredefinedType: "QUARTER_TURN_STAIR",

  params: [
    { key: "aantalTreden", label: "Totaal aantal optredes", type: "length", min: 12, max: 22, step: 1 },
    { key: "optrede", label: "Optrede", type: "length", min: 150, max: 220, step: 1 },
    { key: "aantrede", label: "Aantrede", type: "length", min: 200, max: 300, step: 1 },
    { key: "trapbreedte", label: "Trapbreedte", type: "length", min: 800, max: 1200, step: 10 },
    { key: "basisHoogte", label: "Basispeil", type: "length", min: -5000, max: 20000, step: 10 },
  ],
  defaults: { aantalTreden: 17, optrede: 176, aantrede: 240, trapbreedte: 900, basisHoogte: 0 },

  depth(p) { return num(p, "trapbreedte") * MM; },
  color() { return "#a8845a"; },

  solids(_l, p): SolidBox[] {
    const n = Math.round(num(p, "aantalTreden"));
    const opt = num(p, "optrede") * MM;
    const aan = num(p, "aantrede") * MM;
    const br = num(p, "trapbreedte") * MM;
    const out: SolidBox[] = [];

    const helft = Math.floor(n / 2);
    // 1e vlucht: langs x-as
    const dikte = 0.04;
    for (let i = 0; i < helft; i++) {
      const cx = i * aan + aan / 2;
      const z = (i + 1) * opt - dikte;
      out.push({ cx, cy: 0, zBottom: z, dx: aan, dy: br, dz: dikte });
    }
    // Bordes op hoogte helft*opt, breedte × br
    const bordesX = helft * aan + br / 2;
    const bordesZ = helft * opt - dikte;
    out.push({ cx: bordesX, cy: 0, zBottom: bordesZ, dx: br, dy: br, dz: dikte });

    // 2e vlucht: langs -y-as vanaf bordes (kwart naar links t.o.v. de eerste vlucht)
    for (let i = 0; i < n - helft; i++) {
      const cy = -br / 2 - (i * aan + aan / 2);
      const z = (helft + i + 1) * opt - dikte;
      out.push({ cx: bordesX, cy, zBottom: z, dx: br, dy: aan, dz: dikte });
    }
    return out;
  },

  psetName: "Trap_2Kwart",
  psetProps(_l, p) {
    return { Type: "2-kwart-trap", AantalOptredes: Math.round(num(p, "aantalTreden")), Trapbreedte_mm: num(p, "trapbreedte") };
  },

  commonPset(_l, p) {
    return {
      NumberOfRiser: Math.round(num(p, "aantalTreden")),
      NumberOfTreads: Math.round(num(p, "aantalTreden")) - 2,
      RiserHeight: num(p, "optrede") / 1000,
      TreadLength: num(p, "aantrede") / 1000,
    };
  },
};
