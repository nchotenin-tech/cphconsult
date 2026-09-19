import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = process.argv[2];
if (!repository) throw new Error('Usage: node tools/inventory-source.mjs <legacy-repository>');
const revision = '56ba8b18ff58bfa5c58dc0b9ca555f993049298c';
const git = (...args) => execFileSync('git', ['-C', resolve(repository), ...args], {
  encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
});
git('cat-file', '-e', `${revision}^{commit}`);
const bootstrap = 'deployment/new-stack-bootstrap/00_bootstrap.sql';
const migrations = git('ls-tree', '-r', '--name-only', revision, '--', 'supabase/migrations')
  .trim().split(/\r?\n/).filter(path => path.endsWith('.sql')).sort();
const files = [bootstrap, ...migrations].map(path => {
  const sql = git('show', `${revision}:${path}`);
  const declarations = [];
  // Discovery only: not a SQL parser. Drops, overloads, dynamic SQL and later
  // replacements require review; no effective-policy claims are made here.
  const pattern = /\bcreate\s+(?:or\s+replace\s+)?(table|function|policy|trigger|view)\s+(?:if\s+not\s+exists\s+)?([\w."]+)/gi;
  for (const match of sql.matchAll(pattern)) declarations.push({
    kind: match[1].toLowerCase(), name: match[2],
    line: sql.slice(0, match.index).split('\n').length,
  });
  return { path, sha256: createHash('sha256').update(sql).digest('hex'), declarations };
});
const versions = new Map();
for (const path of migrations) {
  const version = path.split('/').at(-1).split('_')[0];
  versions.set(version, [...(versions.get(version) ?? []), path]);
}
const report = {
  revision, scope: 'Git SQL source only; not live catalog or effective policy inventory',
  migrationCount: migrations.length,
  duplicateVersionPrefixes: [...versions].filter(([, paths]) => paths.length > 1)
    .map(([version, paths]) => ({ version, paths })),
  declaredTables: [...new Set(files.flatMap(file => file.declarations)
    .filter(item => item.kind === 'table').map(item => item.name))].sort(),
  files,
};
const output = resolve(dirname(fileURLToPath(import.meta.url)), '../docs/source-inventory.json');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(`Indexed ${migrations.length} migrations and ${report.declaredTables.length} declared tables.`);
console.log(`Duplicate version prefixes requiring review: ${report.duplicateVersionPrefixes.length}`);
