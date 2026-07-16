import * as WebIFC from "web-ifc";
import { getIfcApi } from "./ifcCommon";

/** Leest de O3S_Data-eigenschappen uit een IFC-bestand terug, zodat een eerder
 *  geëxporteerd model weer als bewerkbaar project geopend kan worden (round-trip). */
export async function readO3sDataFromIfc(bytes: Uint8Array): Promise<any[]> {
  const api = await getIfcApi();
  const modelID = api.OpenModel(bytes);
  const results: any[] = [];
  try {
    const ids = api.GetLineIDsWithType(modelID, WebIFC.IFCPROPERTYSINGLEVALUE);
    for (let i = 0; i < ids.size(); i++) {
      const line: any = api.GetLine(modelID, ids.get(i));
      if (line?.Name?.value === "O3S_Data" && line?.NominalValue?.value) {
        try {
          results.push(JSON.parse(String(line.NominalValue.value)));
        } catch {
          /* beschadigde regel overslaan */
        }
      }
    }
  } finally {
    api.CloseModel(modelID);
  }
  return results;
}
