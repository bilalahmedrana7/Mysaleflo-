// Makes a consistent copy of the live database: npm run backup [target-folder]
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const file = process.env.DATA_FILE || path.join(process.env.DATA_DIR || './data', 'saleflo.db');
const outDir = process.argv[2] || path.join(path.dirname(file), 'backups');
if (!fs.existsSync(file)) {
  console.error(`Database not found: ${file}`);
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const target = path.join(outDir, `saleflo-${stamp}.db`);
const db = new DatabaseSync(file);
db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
db.close();

// Keep only the 14 most recent backups
const files = fs.readdirSync(outDir).filter((f) => /^saleflo-.*\.db$/.test(f)).sort();
for (const old of files.slice(0, Math.max(0, files.length - 14))) fs.unlinkSync(path.join(outDir, old));
console.log(`Backup saved: ${target}`);
