import { templates } from "../catalog/registry";

/** AI-modelleerassistent (experimenteel): natuurlijke taal → template-plaatsingen.
 *
 * Gebruikt de Claude API met een eigen API-sleutel van de gebruiker (Anthropic Console).
 * De parametrische templates vormen de commandoset; het model antwoordt met JSON.
 */

export interface AiPlacement {
  templateId: string;
  /** bouwkundige coördinaten in meters: x = oost, y = noord */
  start: [number, number];
  end: [number, number];
  params?: Record<string, number | string>;
}

export interface AiAntwoord {
  message: string;
  placements: AiPlacement[];
}

const MODEL = "claude-haiku-4-5-20251001";

export async function askAssistant(
  prompt: string,
  apiKey: string,
  context: { storeyName: string; gridInfo: string },
): Promise<AiAntwoord> {
  const catalog = templates.map((t) => ({
    templateId: t.id,
    naam: t.name,
    standaardParameters: t.defaults,
  }));

  const system = [
    "Je bent de modelleerassistent van Open 3D Studio, een open source IFC-modelleerprogramma.",
    "Je plaatst parametrische componenten door JSON terug te geven. Antwoord UITSLUITEND met één JSON-object, zonder toelichting eromheen:",
    '{"message": "korte NL-samenvatting van wat je plaatst", "placements": [{"templateId": "...", "start": [x, y], "end": [x, y], "params": {...}}]}',
    "Coördinaten zijn in METERS, bouwkundig: x = oost, y = noord. Lengtematen in params zijn in MILLIMETERS.",
    "Neem alleen params op die afwijken van de standaard. Plaats niets als de vraag onduidelijk is; leg dat dan uit in message met lege placements.",
    `Beschikbare componenttemplates: ${JSON.stringify(catalog)}`,
    `Actieve verdieping: ${context.storeyName}. ${context.gridInfo}`,
  ].join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API-fout ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const textOut: string =
    data.content?.find((c: { type: string }) => c.type === "text")?.text ?? "";
  const jsonMatch = textOut.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Assistent gaf geen geldig JSON-antwoord.");
  const parsed = JSON.parse(jsonMatch[0]);
  return {
    message: String(parsed.message ?? ""),
    placements: Array.isArray(parsed.placements) ? parsed.placements : [],
  };
}
