import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repository = process.argv[2];
if (!repository) throw new Error('Usage: node tools/column-evidence.mjs <legacy-repository>');
const inventory = JSON.parse(readFileSync(new URL('../docs/source-inventory.json', import.meta.url)));
const evidence = [];
for (const file of inventory.files) {
  const sql = execFileSync('git', ['-C', resolve(repository), 'show', `${inventory.revision}:${file.path}`], { encoding: 'utf8' });
  const lines = sql.split(/\r?\n/);
  let table = null;
  let inCreate = false;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].replace(/--.*$/, '').trim();
    const create = line.match(/^create\s+table\s+(?:if\s+not\s+exists\s+)?([\w.]+)\s*\(/i);
    const alter = line.match(/^alter\s+table\s+(?:if\s+exists\s+)?([\w.]+)/i);
    if (create) { table = create[1]; inCreate = true; continue; }
    if (alter) { table = alter[1]; inCreate = false; }
    if (inCreate && /^\);/.test(line)) { table = null; inCreate = false; continue; }
    const add = line.match(/\badd\s+column\s+(?:if\s+not\s+exists\s+)?(\w+)\s+([\w[\]]+)/i);
    const declaration = inCreate ? line.match(/^(\w+)\s+([\w[\]]+)/) : null;
    const change = line.match(/\b(alter|drop|rename)\s+column\s+(?:if\s+exists\s+)?(\w+)/i);
    const candidate = add ?? declaration;
    if (table && candidate && !/^(constraint|primary|foreign|unique|check|exclude)$/i.test(candidate[1])) {
      evidence.push({ table, column: candidate[1], typeToken: candidate[2], operation: add ? 'add-candidate' : 'create-candidate', path: file.path, line: index + 1 });
    }
    if (table && change) evidence.push({ table, column: change[2], operation: change[1].toLowerCase() + '-review', path: file.path, line: index + 1 });
    if (!inCreate && line.endsWith(';')) table = null;
  }
}
const report = {
  revision: inventory.revision,
  limitations: 'Line-based discovery only: multiline/quoted/dynamic SQL and full type modifiers may be missed. No effective schema or completeness claim. Review original SQL and live catalog.',
  evidence,
};
writeFileSync(new URL('../docs/column-evidence.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(`Recorded ${evidence.length} column evidence locations for manual review.`);
