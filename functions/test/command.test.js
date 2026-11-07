import {describe, expect, it, vi} from "vitest";
import * as yup from "yup";
import run from "../src/lib/run.js";
import env from "../src/lib/envelope.js";
import crypto from "node:crypto";
import {fixedClock, memoryStore} from "./fakes.js";

const {runCommand} = run;
const {CommandError} = env;
const schema = yup.object({n: yup.number().integer().min(1).required()});
const mk = () => ({store: memoryStore(), clock: fixedClock(), db: {}, ports: {}});
const call = (spec, handler, e, data, who = {uid: "u1", claims: {}}) =>
  runCommand({...who, data}, spec, handler, e);

describe("command wrapper", () => {
  it("requires a request id and a signed-in caller", async () => {
    const e = mk();
    const h = vi.fn();
    expect(await call({schema}, h, e, {n: 1})).toMatchObject({ok: false, error: {code: "invalid", fields: ["requestId"]}});
    expect(await call({schema}, h, e, {requestId: "r", n: 1}, {})).toMatchObject({error: {code: "unauthenticated"}});
    expect(h).not.toHaveBeenCalled();
  });

  it("checks the role claim", async () => {
    const e = mk();
    const h = vi.fn();
    const r = await call({role: "admin", schema}, h, e, {requestId: "r", n: 1}, {uid: "u1", claims: {artist: true}});
    expect(r.error.code).toBe("forbidden");
    const ok = await call({role: "admin", schema}, async () => ({done: 1}), e, {requestId: "r2", n: 1}, {uid: "u1", claims: {admin: true}});
    expect(ok).toMatchObject({ok: true, data: {done: 1}});
  });

  it("reports invalid fields and strips unknown ones", async () => {
    const e = mk();
    const r = await call({schema}, vi.fn(), e, {requestId: "r", n: 0});
    expect(r).toMatchObject({ok: false, error: {code: "invalid", fields: ["n"]}});
    const seen = [];
    await call({schema}, async ({input}) => {
 seen.push(input);
}, e, {requestId: "r2", n: 2, price: 1});
    expect(seen[0]).toEqual({n: 2});
  });

  it("runs once per request id and replays the stored result", async () => {
    const e = mk();
    const h = vi.fn(async () => ({v: 1}));
    const a = await call({schema}, h, e, {requestId: "same", n: 1});
    const b = await call({schema}, h, e, {requestId: "same", n: 1});
    expect(h).toHaveBeenCalledTimes(1);
    expect(b).toEqual(a);
  });

  it("maps CommandError to a failure and keeps it stored", async () => {
    const e = mk();
    const h = vi.fn(async () => {
 throw new CommandError("conflict", "sold", {changedLines: []});
});
    const r = await call({schema}, h, e, {requestId: "x", n: 1});
    expect(r).toEqual({ok: false, error: {code: "conflict", reason: "sold", changedLines: []}, requestId: "x"});
    await call({schema}, h, e, {requestId: "x", n: 1});
    expect(h).toHaveBeenCalledTimes(1);
  });

  it("hides unexpected errors and lets the caller retry with the same id", async () => {
    const e = mk();
    let boom = true;
    const h = async () => {
 if (boom) throw new Error("secret detail"); return {fine: true};
};
    const r = await call({schema}, h, e, {requestId: "y", n: 1});
    expect(r).toEqual({ok: false, error: {code: "internal"}, requestId: "y"});
    boom = false;
    expect(await call({schema}, h, e, {requestId: "y", n: 1})).toMatchObject({ok: true, data: {fine: true}});
  });
});

