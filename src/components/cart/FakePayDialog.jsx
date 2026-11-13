import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { Dialog } from '../ui/Dialog';

// The stand-in for Razorpay's window when the server runs in fake provider mode (keyId starts with rzp_fake). Dev builds only.
// The payment id carries the order it belongs to, which is how the fake server finds the amount (supabase/functions/api/providers.ts).
function FakePay({ razorpayOrderId, amount, onDone }) {
  const [open, setOpen] = useState(true);
  const finish = (result) => { setOpen(false); onDone(result); };
  const proof = (outcome) => ({
    ok: true, razorpayOrderId, signature: 'fake', razorpayPaymentId: `pay_fake_${outcome}_${razorpayOrderId}`,
  });
  return (
    <Dialog open={open} title="Test payment window" onClose={() => finish({ ok: false, dismissed: true })}
      footer={(
        <>
          <button className="btn btn-secondary" onClick={() => finish({ ok: false, dismissed: true })}>Close</button>
          {/* like Razorpay's own window: a failed attempt never reaches CraftMe's handler, the Buyer just tries again */}
          <button className="btn btn-secondary" onClick={() => finish({ ok: false, failed: true })}>Fail</button>
          <button className="btn btn-primary" onClick={() => finish(proof('ok'))}>Pay</button>
        </>
      )}>
      <p>Fake provider mode. Paying ₹{(amount / 100).toLocaleString('en-IN')} sends no money.</p>
    </Dialog>
  );
}

export function openFakePay(props) {
  return new Promise((resolve) => {
    const host = document.body.appendChild(document.createElement('div'));
    const root = createRoot(host);
    root.render(<FakePay {...props} onDone={(result) => { resolve(result); setTimeout(() => { root.unmount(); host.remove(); }); }} />);
  });
}
