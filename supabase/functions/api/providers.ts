// The provider seam (PD02): rz() in index.ts is the one place that talks to Razorpay; in fake mode it answers from here instead.
// Fake mode exists for local tests only and refuses to run in production.
export type Mode = "live" | "fake";

/** "fake" only when PROVIDER_MODE=fake AND APP_ENV is not production. Throws when fake is asked for in production. */
export function providerMode(get: (k: string) => string | undefined = (k) => Deno.env.get(k)): Mode {
  if (get("PROVIDER_MODE") !== "fake") return "live";
  if (get("APP_ENV") === "production") throw new Error("fake_mode_in_production");
  return "fake";
}

const rate = 0.0236; // the fee the fake provider charges
const uuid = () => crypto.randomUUID();

/** Same shape rz() returns. The payment id carries the fake order it belongs to: pay_fake_<ok|declined|timeout>_<order_fake_…>. */
// deno-lint-ignore no-explicit-any
export async function fakeRz(admin: any, path: string, method: "GET" | "POST", body?: any): Promise<any> {
  if (method === "POST" && path === "/orders") return { id: `order_fake_${uuid()}`, amount: body?.amount, currency: "INR" };

  const refund = path.match(/^\/payments\/(pay_fake_[a-z]+_[^/]+)\/refund$/);
  if (method === "POST" && refund) {
    if (refund[1].startsWith("pay_fake_timeout_")) throw new Error("razorpay 504: timeout");
    return { id: `rfnd_fake_${uuid()}`, amount: body?.amount };
  }

  const pay = path.match(/^\/payments\/(pay_fake_([a-z]+)_(.+))$/);
  if (method === "GET" && pay) {
    const [, id, outcome, orderId] = pay;
    const [{ data: order }, { data: fee }] = await Promise.all([
      admin.from("orders").select("total").eq("razorpay_order_id", orderId).maybeSingle(),
      admin.from("artist_private").select("onboarding_amount").eq("onboarding_order_id", orderId).maybeSingle(),
    ]);
    const amount = Number(order?.total ?? fee?.onboarding_amount ?? 0);
    return {
      id, order_id: orderId, amount, method: "upi",
      status: outcome === "declined" ? "failed" : "captured",
      fee: Math.round(amount * rate),
    };
  }
  throw new Error(`fake razorpay: no answer for ${method} ${path}`);
}
