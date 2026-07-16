import type { ComponentTemplate, MaterialLayer } from "./types";

/** Rc/U-waarde-berekening uit MaterialLayers (v0.5).
 *
 *  Rc = Σ (d / λ) voor thermisch relevante lagen — dat zijn isolatie- en structurele
 *  lagen; lucht(spouw) en membranen tellen niet mee zolang er geen ventilatie is
 *  (dan geeft NEN 6068 een klein bijdrage; we negeren dat bewust in dit MVP).
 *
 *  U = 1 / (Rc + Rsi + Rse) met Rsi ≈ 0,13 en Rse ≈ 0,04 m²·K/W voor gevels
 *  (NEN 1068 default). Onze U-waarde is dus indicatief.  */

const RSI = 0.13; // binnenwarmteovergang
const RSE = 0.04; // buitenwarmteovergang

/** Sommeer d/λ over de warmte-relevante lagen. Retourneert 0 als geen enkele laag
 *  een λ heeft — dan is Rc onbekend. */
export function computeRc(layers: MaterialLayer[]): number {
  let rc = 0;
  for (const layer of layers) {
    if (!layer.lambda || layer.lambda <= 0) continue;
    // Alle lagen tellen mee zolang ze een λ hebben — zo werken cladding-lagen ook
    // (isolatie + gips + houtvezel-buitenplaat = alle drie thermisch relevant).
    if (layer.category === "cavity") continue;
    if (layer.category === "membrane") continue;
    const dM = layer.thicknessMm / 1000;
    rc += dM / layer.lambda;
  }
  return Math.round(rc * 100) / 100; // twee decimalen — genoeg voor rapportage
}

/** U-waarde: 1 / (Rc + Rsi + Rse). Retourneert null als Rc onbekend is. */
export function computeU(rc: number): number | null {
  if (rc <= 0) return null;
  return Math.round((1 / (rc + RSI + RSE)) * 1000) / 1000;
}

/** Bundel de Rc/U-eigenschappen die in Storax_Thermal terechtkomen.
 *  Naam-prefix is Storax_ i.p.v. Pset_ omdat Pset_ voor buildingSMART is
 *  gereserveerd; ThermalTransmittance in Pset_WallCommon vullen we los. */
export function thermalPsetProps(template: ComponentTemplate): Record<string, number | string> | null {
  const layers = template.materialLayers ?? [];
  if (layers.length === 0) return null;
  const rc = computeRc(layers);
  if (rc <= 0) return null;
  const u = computeU(rc);
  const props: Record<string, number | string> = {
    Rc: rc,
    Rsi: RSI,
    Rse: RSE,
  };
  if (u !== null) props.U = u;
  return props;
}

/** Alle unieke materialen met een λ, voor Pset_MaterialThermal op IfcMaterial. */
export function materialThermalProps(layers: MaterialLayer[]): Map<string, { lambda: number }> {
  const out = new Map<string, { lambda: number }>();
  for (const layer of layers) {
    if (!layer.lambda || layer.lambda <= 0) continue;
    if (!out.has(layer.material)) out.set(layer.material, { lambda: layer.lambda });
  }
  return out;
}
