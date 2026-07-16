import { useEffect, useMemo, useState } from "react";

/** bSDD-picker — kies een classificatie uit buildingSMART Data Dictionary.
 *
 *  De picker roept de bSDD REST-API aan (api.bsdd.buildingsmart.org). Bij een
 *  offline sessie of API-fout valt hij netjes terug op de ingebouwde NL-SfB
 *  tabel 1 (12 hoofdcategorieën uit modelleerafspraken.nl). De gebruiker kan
 *  altijd zelf een vrije NL-SfB-code intypen — beslissing #8 uit het overleg. */

export interface BsddChoice {
  system: string;   // bv. "NL-SfB", "Uniclass", "OmniClass"
  code: string;
  label: string;
  location?: string; // bSDD-URL naar het concept
}

interface BsddEntry {
  code: string;
  name: string;
  system: string;
  location?: string;
}

const NL_SFB_OFFLINE: BsddEntry[] = [
  { code: "11", system: "NL-SfB", name: "Bodemvoorzieningen" },
  { code: "13", system: "NL-SfB", name: "Vloeren op grondslag" },
  { code: "16", system: "NL-SfB", name: "Funderingsconstructie" },
  { code: "17", system: "NL-SfB", name: "Paalfundering" },
  { code: "21", system: "NL-SfB", name: "Buitenwanden" },
  { code: "22", system: "NL-SfB", name: "Binnenwanden" },
  { code: "23", system: "NL-SfB", name: "Vloeren, galerijen, balkons" },
  { code: "24", system: "NL-SfB", name: "Trappen, hellingen" },
  { code: "27", system: "NL-SfB", name: "Daken" },
  { code: "28", system: "NL-SfB", name: "Hoofddraagconstructie" },
  { code: "31", system: "NL-SfB", name: "Buitenkozijnen, -deuren, -ramen" },
  { code: "32", system: "NL-SfB", name: "Binnenkozijnen, -deuren, -ramen" },
  { code: "34", system: "NL-SfB", name: "Balustrades, leuningen" },
  { code: "41", system: "NL-SfB", name: "Buitenafwerking" },
  { code: "42", system: "NL-SfB", name: "Binnenafwerking" },
  { code: "43", system: "NL-SfB", name: "Vloerafwerking" },
  { code: "45", system: "NL-SfB", name: "Plafondafwerking" },
];

async function fetchBsdd(query: string): Promise<BsddEntry[]> {
  const url = `https://api.bsdd.buildingsmart.org/api/TextSearch/v2?SearchText=${encodeURIComponent(query)}&TypeFilter=Class`;
  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`bSDD status ${res.status}`);
    const json: any = await res.json();
    const items: BsddEntry[] = [];
    for (const cls of json?.classes ?? []) {
      items.push({
        code: cls.referenceCode ?? cls.code ?? "",
        name: cls.name ?? "",
        system: cls.dictionaryName ?? "",
        location: cls.uri,
      });
    }
    return items.slice(0, 40);
  } catch {
    return [];
  }
}

export function BsddPicker(props: {
  value?: string;
  onChoice: (c: BsddChoice) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(props.value ?? "");
  const [results, setResults] = useState<BsddEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      // fallback: NL-SfB lokaal filteren op prefix
      setResults(NL_SFB_OFFLINE.filter((e) => e.code.startsWith(query.trim())));
      setOffline(true);
      return;
    }
    setBusy(true);
    let alive = true;
    fetchBsdd(query.trim()).then((online) => {
      if (!alive) return;
      if (online.length === 0) {
        setOffline(true);
        setResults(
          NL_SFB_OFFLINE.filter(
            (e) =>
              e.code.includes(query.trim()) ||
              e.name.toLowerCase().includes(query.trim().toLowerCase()),
          ),
        );
      } else {
        setOffline(false);
        setResults(online);
      }
      setBusy(false);
    });
    return () => {
      alive = false;
    };
  }, [query]);

  const items = useMemo(() => results, [results]);

  return (
    <div className="bsdd-picker">
      <input
        type="text"
        placeholder={props.placeholder ?? "bSDD — zoek NL-SfB / Uniclass / OmniClass …"}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="bsdd-status">
        {busy ? "Zoeken …" : offline ? "Offline — NL-SfB lokaal" : `${items.length} treffer(s)`}
      </div>
      {items.length > 0 && (
        <ul className="bsdd-results">
          {items.map((r) => (
            <li key={`${r.system}-${r.code}`}>
              <button
                type="button"
                onClick={() =>
                  props.onChoice({
                    system: r.system,
                    code: r.code,
                    label: r.name,
                    location: r.location,
                  })
                }
              >
                <strong>{r.code}</strong> — {r.name}
                <span className="bsdd-sys">{r.system}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
