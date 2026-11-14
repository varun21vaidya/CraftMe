// Fails the production build while any legal page is still draft text (S19.i.02).
// Usage: node scripts/check-legal.mjs [directory]   (the directory defaults to src/content/legal)
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(process.argv[2] || fileURLToPath(new URL('../src/content/legal', import.meta.url)));
const pages = fs.readdirSync(dir).filter((f) => /\.jsx$/.test(f) && !/\.test\.jsx$/.test(f));
// each page file says `export const draft = true;` or `= false;`; a missing line counts as a draft
const drafts = pages.filter((f) => !/^\s*export const draft\s*=\s*false\s*;?\s*$/m.test(fs.readFileSync(path.join(dir, f), 'utf8')));

if (drafts.length) {
  console.error(`Legal text is still a draft in: ${drafts.map((f) => f.replace(/\.jsx$/, '')).join(', ')}.`);
  console.error('Put the final text in each file and set `export const draft = false;`.');
  process.exit(1);
}
console.log(`Legal text is final in all ${pages.length} pages.`);
