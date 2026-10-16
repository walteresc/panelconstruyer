// Aplica un diccionario inglés → español sobre las posiciones extraídas por i18n-extract.mjs.
// Uso: node scripts/i18n-apply.mjs strings.json es-1.json es-2.json ...
import fs from 'node:fs';

const [stringsFile, ...dictFiles] = process.argv.slice(2);
const strings = JSON.parse(fs.readFileSync(stringsFile, 'utf8'));
const dict = Object.assign({}, ...dictFiles.map(f => JSON.parse(fs.readFileSync(f, 'utf8'))));
const DEAD = /apps\/web\/app\/(diagnostics|diagnostic-library|coverage|welcome|book|documents\/preview)(\/|$)/;

let applied = 0;
const missing = new Map();
for (const [file, entries] of Object.entries(strings)) {
  if (DEAD.test(file)) continue;
  let src = fs.readFileSync(file, 'utf8');
  const sorted = [...entries].sort((a, b) => b.start - a.start);
  let last = Infinity;
  for (const e of sorted) {
    if (e.kind === 'template') continue;
    if (e.end > last) continue; // solapado
    const es = dict[e.text];
    if (es === undefined) {
      missing.set(e.text, (missing.get(e.text) ?? 0) + 1);
      continue;
    }
    if (es === e.text) continue;
    let replacement;
    if (e.kind === 'jsx') {
      const lead = e.raw.match(/^\s*/)[0];
      const trail = e.raw.match(/\s*$/)[0];
      replacement = lead + es + trail;
    } else {
      const q = e.raw[0];
      if (q === '`') replacement = '`' + es.replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`';
      else replacement = q + es.replace(/\\/g, '\\\\').replace(new RegExp(q, 'g'), '\\' + q) + q;
    }
    src = src.slice(0, e.start) + replacement + src.slice(e.end);
    last = e.start;
    applied++;
  }
  fs.writeFileSync(file, src);
}
console.error(`reemplazos: ${applied} · sin traducción: ${missing.size}`);
fs.writeFileSync(process.env.MISSING_OUT ?? 'i18n-missing.txt', [...missing.keys()].join('\n'));
