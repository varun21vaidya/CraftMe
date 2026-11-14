import { createClient } from '@supabase/supabase-js';
import { TERMS_VERSION } from '../../src/content/legal/version.js';
import { sql } from './db.js';
import { env } from './seed.mjs';
import { PEOPLE } from './ids.js';

/**
 * Signs the fixture user in through the Supabase client and stores the session in the page before the first navigation.
 * The fixture person has accepted the current Terms (so the gate stays out of other scripts); pass { terms: false } to leave it as it is.
 */
export async function signInAs(page, key, { terms = true } = {}) {
  const { VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: anon, QA_PASSWORD: password } = env();
  const { data, error } = await createClient(url, anon, { auth: { persistSession: false } })
    .auth.signInWithPassword({ email: PEOPLE[key].email, password });
  if (error) throw error;
  if (terms) sql(`update public.profiles set terms_accepted_at = now(), terms_version = '${TERMS_VERSION}' where id = '${PEOPLE[key].id}'`);
  const storageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`; // supabase-js's default key
  await page.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch { /* blocked */ } }, [storageKey, JSON.stringify(data.session)]);
}
