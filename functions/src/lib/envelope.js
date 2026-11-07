// One result shape for every command. The backend sends codes and reasons, never display text.
// ok: {ok:true, data, requestId}   failure: {ok:false, error:{code, reason?, fields?, ...}, requestId}

const CODES = ["unauthenticated", "forbidden", "invalid", "conflict", "rate_limited", "unavailable", "internal"];

/** Thrown by handlers and mapped to a failure envelope by the command wrapper. */
class CommandError extends Error {
  constructor(code, reason, extra = {}) {
    super(reason || code);
    if (!CODES.includes(code)) throw new Error(`unknown error code ${code}`);
    this.name = "CommandError"; // checked by name, not instanceof, so two loaded copies of this file still match
    this.code = code;
    this.reason = reason;
    this.extra = extra;
  }
}

const ok = (data, requestId) => ({ok: true, data: data ?? {}, requestId});
const fail = (code, requestId, extra = {}) => ({ok: false, error: {code, ...extra}, requestId});

/** @typedef {{ok:true,data:any,requestId:string}|{ok:false,error:{code:string,reason?:string,fields?:string[]},requestId:string}} Envelope */
module.exports = {CommandError, ok, fail};
