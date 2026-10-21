// Reference implementation of the RAPID typeahead rules (see "Typeahead Rules" sheet).
// Works in Cloud Functions or the browser. items = lists/institutions.json or lists/programs.json .items
const STOP_INST = new Set(['the','of','and','university','univ','uni','a']);
const STOP_PROG = new Set(['the','of','in','a','an','and','program','programme','hons','honours','honors','h']);
const NOISE = [/\b\d+(st|nd|rd|th)?\s*(semester|semster|sem|year|yr)s?\b/g, /\b(first|second|third|fourth|final)\s+(semester|year)\b/g,
  /\bpart\s*-?\s*(1|2|i|ii|one|two)\b/g, /\b\d\s*years?\s*(program|programme|degree)?\b/g, /\b(program|programme|degree|course)\b/g];
function base(s) {
  let t = String(s).normalize('NFKC').toLowerCase().replace(/&/g, ' and ').replace(/[’'.]/g, '');
  t = t.replace(/[^a-z0-9]+/g, ' ').replace(/\bbachelors\b/g, 'bachelor').replace(/\bmasters\b/g, 'master').replace(/\bcollage\b/g, 'college');
  return t.trim().split(/\s+/).filter(Boolean).join(' ');
}
function key(s, kind) {
  let t = base(s);
  if (kind === 'programs') NOISE.forEach(re => { t = t.replace(re, ' '); });
  const stop = kind === 'programs' ? STOP_PROG : STOP_INST;
  return t.split(/\s+/).filter(w => w && !stop.has(w)).join(' ');
}
// returns [{item, score, matchedOn}] best first. filter: e.g. {levelCode:'BS4'} or {type:['nursing college','university']}
function search(query, items, kind, filter = {}, limit = 8) {
  const q = key(query, kind); if (!q) return [];
  const out = [];
  for (const it of items) {
    if (it.isOther) continue;
    if (filter.levelCode && it.levelCode !== filter.levelCode) continue;
    if (filter.type && !filter.type.includes(it.type)) continue;
    if (filter.city && it.city !== filter.city && !(it.campuses || []).some(c => c.city === filter.city)) continue;
    const short = it.shortName || it.code ? key(it.shortName || it.code, kind) : '';
    const keys = it.searchKeys || [];
    const all = [key(it.label, kind), ...(it.aliases || []).map(a => key(a, kind))];
    let score = 0, on = '';
    if (short && q === short) { score = 100; on = 'short name / code (exact)'; }
    else if (keys.includes(q)) { score = 90; on = 'alias (exact)'; }
    else if (all.some(k => k.startsWith(q))) { score = 70; on = 'prefix'; }
    else if (all.some(k => k.split(' ').some(w => w.startsWith(q)))) { score = 55; on = 'word prefix'; }
    else if (all.some(k => k.includes(q))) { score = 40; on = 'contains'; }
    else if (q.split(' ').every(w => all.some(k => k.includes(w)))) { score = 30; on = 'all words'; }
    if (score) out.push({ item: it, score: score - Math.min(it.label.length, 120) / 1000, matchedOn: on });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}
// exact resolution (for back-filling or "did you mean"): returns one id or null
function resolve(raw, items, kind) { const q = key(raw, kind); const hit = items.find(i => (i.searchKeys || []).includes(q)); return hit ? hit.id : null; }
module.exports = { base, key, search, resolve };
