// `npm run db:seed` runs this after `supabase db reset`: loads supabase/seed_qa.sql into the LOCAL stack only.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const DB_CONTAINER = 'supabase_db_craftme-local';

/** Reads KEY=value lines from .env.e2e (git-ignored). */
export const env = () => {
  const vars = {};
  if (fs.existsSync('.env.e2e')) for (const line of fs.readFileSync('.env.e2e', 'utf8').split(/\r?\n/)) { const m = line.match(/^(\w+)=(.*)$/); if (m) vars[m[1]] = m[2]; }
  return { ...vars, ...process.env };
};

export function seed() {
  const password = env().QA_PASSWORD;
  if (!password) throw new Error('Set QA_PASSWORD in .env.e2e (see .env.example)');
  const sql = fs.readFileSync(new URL('../../supabase/seed_qa.sql', import.meta.url), 'utf8');
  const run = spawnSync('docker', ['exec', '-i', DB_CONTAINER, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-v', `qa_password=${password}`], { input: sql, encoding: 'utf8' });
  if (run.status !== 0) throw new Error(run.stderr || run.stdout);
}

if (import.meta.url === `file:///${process.argv[1].replace(/\/g, '/')}`) { seed(); console.log('seeded'); }
