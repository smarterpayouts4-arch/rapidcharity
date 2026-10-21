export type CatalogItem = {
  id: string;
  label: string;
  shortName?: string;
  aliases?: string[];
  searchKeys?: string[];
  city?: string;
  province?: string;
  type?: string;
  levelCode?: string;
  isOther?: boolean;
};

const STOP_INST = new Set(["the", "of", "and", "university", "univ", "uni", "a"]);
const STOP_PROG = new Set([
  "the",
  "of",
  "in",
  "a",
  "an",
  "and",
  "program",
  "programme",
  "hons",
  "honours",
  "honors",
  "h",
]);
const NOISE = [
  /\b\d+(st|nd|rd|th)?\s*(semester|semster|sem|year|yr)s?\b/g,
  /\b(first|second|third|fourth|final)\s+(semester|year)\b/g,
  /\bpart\s*-?\s*(1|2|i|ii|one|two)\b/g,
  /\b\d\s*years?\s*(program|programme|degree)?\b/g,
  /\b(program|programme|degree|course)\b/g,
];

export function baseNormalize(s: string): string {
  let t = String(s)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[''.]/g, "");
  t = t
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bbachelors\b/g, "bachelor")
    .replace(/\bmasters\b/g, "master")
    .replace(/\bcollage\b/g, "college");
  return t.trim().split(/\s+/).filter(Boolean).join(" ");
}

export function searchKey(s: string, kind: "institutions" | "programs" | "cities"): string {
  let t = baseNormalize(s);
  if (kind === "programs") {
    for (const re of NOISE) t = t.replace(re, " ");
  }
  const stop = kind === "programs" ? STOP_PROG : STOP_INST;
  return t
    .split(/\s+/)
    .filter((w) => w && !stop.has(w))
    .join(" ");
}

export type SearchHit = {
  item: CatalogItem;
  score: number;
  matchedOn: string;
};

export function searchCatalog(
  query: string,
  items: CatalogItem[],
  kind: "institutions" | "programs" | "cities",
  filter: { levelCode?: string; type?: string[]; city?: string } = {},
  limit = 8,
): SearchHit[] {
  const q = searchKey(query, kind);
  if (!q || q.length < 2) return [];
  const out: SearchHit[] = [];
  for (const it of items) {
    if (it.isOther) continue;
    if (filter.levelCode && it.levelCode !== filter.levelCode) continue;
    if (filter.type && it.type && !filter.type.includes(it.type)) continue;
    if (filter.city && it.city !== filter.city) continue;
    const short = it.shortName ? searchKey(it.shortName, kind) : "";
    const keys = it.searchKeys ?? [];
    const all = [searchKey(it.label, kind), ...(it.aliases ?? []).map((a) => searchKey(a, kind))];
    let score = 0;
    let matchedOn = "";
    if (short && q === short) {
      score = 100;
      matchedOn = "short name (exact)";
    } else if (keys.includes(q)) {
      score = 90;
      matchedOn = "alias (exact)";
    } else if (all.some((k) => k.startsWith(q))) {
      score = 70;
      matchedOn = "prefix";
    } else if (all.some((k) => k.split(" ").some((w) => w.startsWith(q)))) {
      score = 55;
      matchedOn = "word prefix";
    } else if (all.some((k) => k.includes(q))) {
      score = 40;
      matchedOn = "contains";
    } else if (q.split(" ").every((w) => all.some((k) => k.includes(w)))) {
      score = 30;
      matchedOn = "all words";
    }
    if (score) {
      out.push({
        item: it,
        score: score - Math.min(it.label.length, 120) / 1000,
        matchedOn,
      });
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}
