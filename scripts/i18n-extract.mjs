// Extrae textos visibles (inglés) de apps/web para traducirlos al español.
// Uso: node scripts/i18n-extract.mjs [carpeta...] > strings.json
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require(require.resolve('typescript', { paths: [path.resolve('apps/web')] }));

const roots = process.argv.slice(2).length ? process.argv.slice(2) : ['apps/web/app', 'apps/web/components', 'apps/web/lib'];
const SKIP_ATTR = new Set(['className', 'key', 'id', 'type', 'name', 'value', 'href', 'src', 'htmlFor', 'role', 'data-testid', 'method', 'action', 'target', 'rel', 'autoComplete', 'inputMode', 'variant', 'size', 'tone', 'style', 'width', 'height', 'viewBox', 'd', 'fill', 'stroke', 'xmlns', 'to', 'mode', 'kind', 'status', 'as', 'locale', 'lang', 'dir', 'tabIndex', 'accept', 'pattern', 'min', 'max', 'step', 'cols', 'rows', 'colSpan', 'rowSpan']);
const PROP_KEYS = new Set(['label', 'title', 'description', 'subtitle', 'heading', 'text', 'message', 'hint', 'placeholder', 'cta', 'empty', 'emptyMessage', 'summary', 'tooltip', 'caption', 'helper', 'error', 'success', 'tagline', 'body', 'name', 'subject', 'detail', 'help']);

const files = [];
const walk = d => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (!['node_modules', '.next'].includes(e.name)) walk(p);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.(test|spec)\./.test(e.name) && !e.name.endsWith('.d.ts')) {
      files.push(p);
    }
  }
};
roots.forEach(walk);

const looksProse = s => /[A-Za-z]{2,}/.test(s) && !/^[a-z0-9_\-./:#@%]+$/.test(s) && !/^(https?:|\/|#|\.|\w+\.\w+)/.test(s) && !/\b(flex|grid|text-|bg-|px-|py-|border|rounded|hover:|w-|h-|gap-|items-|justify-)\b/.test(s);
const out = {};
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found = [];
  const add = (node, text, kind) => {
    const t = text.replace(/\s+/g, ' ').trim();
    if (t && looksProse(t)) found.push({ text: t, kind, line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, start: node.getStart(), end: node.getEnd(), raw: node.getText() });
  };
  const visit = node => {
    if (ts.isJsxText(node)) add(node, node.getText(), 'jsx');
    else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const p = node.parent;
      if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isLiteralTypeNode(p) || ts.isCaseClause(p) || ts.isImportTypeNode?.(p)) {
        /* no */
      } else if (ts.isJsxAttribute(p)) {
        if (!SKIP_ATTR.has(p.name.getText())) add(node, node.text, `attr:${p.name.getText()}`);
      } else if (ts.isPropertyAssignment(p) && p.initializer === node) {
        if (PROP_KEYS.has(p.name.getText().replace(/['"]/g, ''))) add(node, node.text, `prop:${p.name.getText()}`);
      } else if (ts.isCallExpression(p) || ts.isNewExpression(p)) {
        const callee = p.expression.getText();
        if (/^(set\w*|new Error|Error|toast|alert|confirm|throw|fail|notify|show\w*|\w*\.(set\w*|push|error|message))$/.test(callee) || /set(Error|Message|Status|Notice|Feedback|Toast|Success)/.test(callee)) add(node, node.text, `call:${callee}`);
      } else if (ts.isJsxExpression(p) || ts.isConditionalExpression(p) || ts.isBinaryExpression(p) || ts.isParenthesizedExpression(p)) {
        let anc = p;
        let inJsx = false;
        while (anc) {
          if (ts.isJsxExpression(anc) && !ts.isJsxAttribute(anc.parent)) {
            inJsx = true;
            break;
          }
          if (ts.isJsxAttribute(anc) || ts.isBlock(anc)) break;
          anc = anc.parent;
        }
        if (inJsx) add(node, node.text, 'jsxexpr');
      }
      if (!found.some(x => x.start === node.getStart()) && ts.isStringLiteral(node) && /^[A-Z][A-Za-z]/.test(node.text) && /[a-z]/.test(node.text) && node.text.length >= 3 && !/^[A-Z][A-Za-z0-9]*(-[A-Za-z]+)+$/.test(node.text) && !ts.isElementAccessExpression(p) && !ts.isImportDeclaration(p) && !ts.isLiteralTypeNode(p) && !ts.isCaseClause(p) && !ts.isJsxAttribute(p) && !ts.isExportDeclaration(p)) add(node, node.text, 'cap');
    } else if (ts.isTemplateExpression(node)) {
      const raw = node.getText();
      if (/[A-Za-z]{3,}\s+[A-Za-z]{2,}/.test(node.head.text + node.templateSpans.map(s => s.literal.text).join(' '))) found.push({ text: raw, kind: 'template', line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, start: node.getStart(), end: node.getEnd(), raw });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (found.length) out[f.replace(/\\/g, '/')] = found;
}
const total = Object.values(out).reduce((n, a) => n + a.length, 0);
const unique = new Set(Object.values(out).flat().map(x => x.text)).size;
console.error(`archivos: ${Object.keys(out).length} · textos: ${total} · únicos: ${unique}`);
process.stdout.write(JSON.stringify(out, null, 1));
