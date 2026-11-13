import { spawnSync } from 'node:child_process';

/** Runs one statement as the local superuser and returns the rows as text (psql -At). */
export function sql(text) {
  const run = spawnSync('docker', ['exec', '-i', 'supabase_db_craftme-local', 'psql', '-U', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1', '-c', text], { encoding: 'utf8' });
  if (run.status !== 0) throw new Error(run.stderr);
  return run.stdout.trim();
}
