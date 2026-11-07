// The wrapper logic every command shares: auth, role, schema, idempotency, error mapping.
// No Firebase imports here, so it runs in tests with an in-memory store.

const {ok, fail} = require("./envelope");

const failedFields = (err) => [...new Set((err.inner?.length ? err.inner : [err]).map((e) => e.path).filter(Boolean))];

/**
 * req: {uid, claims, data}; env: {store, clock, db, ports, log?}. Always resolves to an envelope.
 * Handlers receive {uid, claims, input, now (epoch ms), db, ports} and throw CommandError to fail.
 */
async function runCommand(req, spec, handler, env) {
  const raw = req.data || {};
  const requestId = typeof raw.requestId === "string" && raw.requestId.length > 0 && raw.requestId.length <= 100 ?
    raw.requestId : null;
  if (!requestId) return fail("invalid", "missing", {fields: ["requestId"]});
  if (!req.uid) return fail("unauthenticated", requestId);

  const role = spec.role || "buyer"; // buyer = any signed-in user
  const claims = req.claims || {};
  if ((role === "admin" && claims.admin !== true) || (role === "artist" && claims.artist !== true)) {
    return fail("forbidden", requestId);
  }

  let input;
  try {
    const {requestId: _ignored, ...rest} = raw;
    input = await spec.schema.validate(rest, {abortEarly: false, stripUnknown: true});
  } catch (e) {
    if (e.name === "ValidationError") return fail("invalid", requestId, {fields: failedFields(e)});
    throw e;
  }

  const key = `${req.uid}_${requestId}`;
  const claim = await env.store.claim(key);
  if (claim.state === "done") return claim.envelope;
  if (claim.state === "pending") return fail("conflict", requestId, {reason: "in_progress"});

  let envelope;
  let retryable = false;
  try {
    const data = await handler({
      uid: req.uid, claims, input, now: env.clock.now(), db: env.db, ports: env.ports,
    });
    envelope = ok(data, requestId);
  } catch (e) {
    if (e && e.name === "CommandError") {
      envelope = fail(e.code, requestId, {...(e.reason ? {reason: e.reason} : {}), ...e.extra});
      retryable = e.code === "unavailable" || e.code === "rate_limited";
    } else {
      (env.log || console.error)("command failed", {uid: req.uid, error: String((e && e.stack) || e)});
      envelope = fail("internal", requestId);
      retryable = true;
    }
  }
  // A transient failure must not be replayed forever: free the key so a retry can run.
  if (retryable) await env.store.release(key); else await env.store.finish(key, envelope);
  return envelope;
}

module.exports = {runCommand};
