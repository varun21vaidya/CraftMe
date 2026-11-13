// Razorpay Checkout runs in the browser from its own script tag; the server SDK is never imported here.
let loading;

const loadScript = () => {
  loading ||= new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve;
    s.onerror = () => { loading = null; reject(new Error('checkout script')); };
    document.head.appendChild(s);
  });
  return loading;
};

/** Opens the payment window. Resolves with the payment proof, {dismissed:true} if closed, or an unavailable error. */
export async function payWithRazorpay({ keyId, razorpayOrderId, amount, description, prefill }) {
  if (import.meta.env.DEV && String(keyId).startsWith('rzp_fake')) { // fake provider mode: a small test window instead of Razorpay
    const { openFakePay } = await import('../components/cart/FakePayDialog');
    return openFakePay({ razorpayOrderId, amount });
  }
  try {
    await loadScript();
  } catch {
    return { ok: false, error: { code: 'unavailable' } };
  }
  return new Promise((resolve) => {
    new window.Razorpay({
      key: keyId, order_id: razorpayOrderId, amount, currency: 'INR', name: 'CraftMe', description, prefill,
      handler: (r) => resolve({
        ok: true,
        razorpayPaymentId: r.razorpay_payment_id,
        razorpayOrderId: r.razorpay_order_id,
        signature: r.razorpay_signature,
      }),
      modal: { ondismiss: () => resolve({ ok: false, dismissed: true }) },
    }).open();
  });
}
