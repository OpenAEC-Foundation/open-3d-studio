import type { ComponentTemplate } from "./types";

/** Hoofdcategorieën (v0.7-S6) — de vaste taxonomie waar kiezer, ribbon-tekenknoppen
 *  en lagenpaneel op draaien. Afgeleid van NL-SfB-hoofdgroepen (beslissing v0.7-1:
 *  wanden 21+22 als één categorie, binnen/buiten als filter). Template kan
 *  overriden via `mainCategory`. */

export const MAIN_CATEGORIES = [
  "Fundering",
  "Wanden",
  "Vloeren",
  "Trappen & hellingen",
  "Daken",
  "Draagconstructie",
  "Kozijnen & deuren",
  "Balustrades & leuningen",
  "Afwerkingen",
  "Installaties",
  "Ruimten",
  "Import & eigen",
] as const;

export type MainCategory = (typeof MAIN_CATEGORIES)[number];

const BY_NLSFB_PREFIX: [RegExp, MainCategory][] = [
  [/^1[367]/, "Fundering"],
  [/^2[12]/, "Wanden"],
  [/^23/, "Vloeren"],
  [/^24/, "Trappen & hellingen"],
  [/^27/, "Daken"],
  [/^28/, "Draagconstructie"],
  [/^3[12]/, "Kozijnen & deuren"],
  [/^34/, "Balustrades & leuningen"],
  [/^4\d/, "Afwerkingen"],
  [/^[56]\d/, "Installaties"],
  [/^90/, "Ruimten"],
];

export function deriveMainCategory(t: ComponentTemplate): MainCategory {
  if (t.mainCategory && (MAIN_CATEGORIES as readonly string[]).includes(t.mainCategory)) {
    return t.mainCategory as MainCategory;
  }
  const code = t.nlSfb ?? t.classification?.code ?? "";
  for (const [re, cat] of BY_NLSFB_PREFIX) {
    if (re.test(code)) return cat;
  }
  // fallback op categorie-string voor templates zonder NL-SfB (MEP had 5x/6x wel,
  // maar imports en plugin-templates niet)
  if (/^MEP/i.test(t.category)) return "Installaties";
  if (/^Import/i.test(t.category)) return "Import & eigen";
  if (/^Ruimte/i.test(t.category)) return "Ruimten";
  return "Import & eigen";
}

/** Groepeer templates per hoofdcategorie, in vaste volgorde. Lege categorieën vervallen. */
export function groupByMainCategory(
  templates: ComponentTemplate[],
): { category: MainCategory; templates: ComponentTemplate[] }[] {
  const map = new Map<MainCategory, ComponentTemplate[]>();
  for (const t of templates) {
    const c = deriveMainCategory(t);
    (map.get(c) ?? map.set(c, []).get(c)!).push(t);
  }
  return MAIN_CATEGORIES.filter((c) => map.has(c)).map((c) => ({
    category: c,
    templates: map.get(c)!,
  }));
}
