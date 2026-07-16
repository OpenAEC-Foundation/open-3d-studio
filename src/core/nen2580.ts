/** NEN 2580 — vloeroppervlakteberekening voor NL-woningen en -utiliteit.
 *
 *  Sinds 1-1-2022 verplicht voor NL-woningcorporaties. Deze module levert de kern-
 *  functies voor GO (gebruiksoppervlakte), NVO (netto-vloeroppervlakte) en GBO
 *  (gebruiksoppervlak binnen omhulling) en past de bekende aftrekregels toe:
 *    - vrije hoogte < 1,5 m → aftrek van vloeroppervlak
 *    - liftschacht ≥ 4 m² → aftrek
 *    - trapgat ≥ 4 m² → aftrek
 *    - installatieruimte < 4 m² → géén aftrek (blijft meetellen)
 *
 *  De sinds 2023 gepubliceerde Meetinstructie GBO Woningen (BBMI) is de
 *  operationele variant voor woningcorporaties — die bouwt op deze grondslagen.
 *
 *  Referenties:
 *    - NEN 2580:2007+C1:2008 (in gebruik in Bbl per 1-1-2022)
 *    - Meetinstructie GBO Woningen v3 (juni 2023) — BBMI
 */

export interface Punt2D {
  x: number; // meters
  y: number;
}

export interface Ruimte {
  id: string;
  naam: string;
  contour: Punt2D[];
  /** Netto vrije hoogte in meters. Onder 1,5 m telt de vloer niet mee. */
  vrijeHoogte: number;
  /** Aftrekgebieden binnen deze ruimte (liftschacht, trapgat) in m². */
  aftrekVanwegeSchacht?: number;
  aftrekVanwegeTrapgat?: number;
  soort?: "verblijfsruimte" | "verkeersruimte" | "sanitair" | "installatieruimte" | "berging";
}

/** Oppervlakte van een gesloten polygon in m² (Shoelace). */
export function polygonOppervlak(contour: Punt2D[]): number {
  if (contour.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < contour.length; i++) {
    const j = (i + 1) % contour.length;
    sum += contour[i].x * contour[j].y - contour[j].x * contour[i].y;
  }
  return Math.abs(sum) / 2;
}

export interface RuimteMeting {
  bruto: number;
  aftrek: number;
  netto: number;
  telMee: boolean;
  toelichting: string;
}

/** Meet één ruimte volgens NEN 2580 met de gebruikelijke aftrekken. */
export function meetRuimte(r: Ruimte): RuimteMeting {
  const bruto = polygonOppervlak(r.contour);
  let aftrek = 0;
  const toelichting: string[] = [];

  // Vrije hoogte < 1,5 m → volledige ruimte telt niet mee
  if (r.vrijeHoogte < 1.5) {
    return { bruto, aftrek: bruto, netto: 0, telMee: false, toelichting: "Vrije hoogte < 1,5 m — telt niet mee" };
  }

  // Liftschacht ≥ 4 m² → aftrek
  if (r.aftrekVanwegeSchacht && r.aftrekVanwegeSchacht >= 4) {
    aftrek += r.aftrekVanwegeSchacht;
    toelichting.push(`Liftschacht ${r.aftrekVanwegeSchacht.toFixed(1)} m² afgetrokken`);
  }

  // Trapgat ≥ 4 m² → aftrek
  if (r.aftrekVanwegeTrapgat && r.aftrekVanwegeTrapgat >= 4) {
    aftrek += r.aftrekVanwegeTrapgat;
    toelichting.push(`Trapgat ${r.aftrekVanwegeTrapgat.toFixed(1)} m² afgetrokken`);
  }

  const netto = Math.max(0, bruto - aftrek);
  return {
    bruto,
    aftrek,
    netto,
    telMee: true,
    toelichting: toelichting.length ? toelichting.join(", ") : "Geen aftrek",
  };
}

export interface GboRapport {
  gboTotaal: number;
  perRuimte: Array<{ ruimte: string; meting: RuimteMeting }>;
  aantalTellendeRuimten: number;
}

/** Berekent het totale GBO (gebruiksoppervlak binnen omhulling) uit een verzameling ruimten. */
export function berekenGbo(ruimten: Ruimte[]): GboRapport {
  const perRuimte = ruimten.map((r) => ({ ruimte: r.naam, meting: meetRuimte(r) }));
  const gboTotaal = perRuimte.reduce((sum, r) => sum + r.meting.netto, 0);
  const aantalTellendeRuimten = perRuimte.filter((r) => r.meting.telMee).length;
  return { gboTotaal, perRuimte, aantalTellendeRuimten };
}
