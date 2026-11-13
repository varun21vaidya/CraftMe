// Direct calls to the local `api` Edge Function and Razorpay-style webhook, for the API-level QA scripts.
import { createHmac, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { env } from './seed.mjs';
import { PEOPLE } from './ids.js';

/** A Supabase client signed in as a fixture user. */
export async function clientAs(key) {
  const { VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: anon, QA_PASSWORD: password } = env();
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email: PEOPLE[key].email, password });
  if (error) throw error;
  return client;
}

/** POST /api as a user. Returns the envelope. */
export async function command(client, name, input = {}) {
  const { data: { session } } = await client.auth.getSession();
  const res = await fetch(`${env().VITE_SUPABASE_URL}/functions/v1/api`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: env().VITE_SUPABASE_PUBLISHABLE_KEY },
    body: JSON.stringify({ requestId: randomUUID(), ...input, name }),
  });
  return res.json();
}

/** The local webhook secret from supabase/.env.local. */
const webhookSecret = () => (fs.readFileSync('supabase/.env.local', 'utf8').match(/^RAZORPAY_WEBHOOK_SECRET=(.*)$/m) || [])[1]?.trim();

/** Sends a signed Razorpay event to /api/webhook. Returns the HTTP status. */
export async function webhook(event, eventId = randomUUID()) {
  const raw = JSON.stringify(event);
  const res = await fetch(`${env().VITE_SUPABASE_URL}/functions/v1/api/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', 'X-Razorpay-Event-Id': eventId,
      'X-Razorpay-Signature': createHmac('sha256', webhookSecret()).update(raw).digest('hex'),
    },
    body: raw,
  });
  return res.status;
}

/** A payment.captured event for a fake successful payment on a Razorpay order id. */
export const captured = (razorpayOrderId, outcome = 'ok') => ({
  event: 'payment.captured',
  payload: { payment: { entity: { id: `pay_fake_${outcome}_${razorpayOrderId}`, order_id: razorpayOrderId } } },
});
