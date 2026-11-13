import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { call, useOrder } from '../../api/gateway';
import { useCart } from '../../contexts/CartContext';
import { Icon } from '../common/Icon';

const RETRY_MS = [2000, 4000, 8000];
const SLOW_MS = 30000;
const SETTLED = ['paid', 'shipped', 'received'];

/**
 * After the payment window returned a proof: ask the server to check it, and keep asking (same requestId) while the answer
 * is unknown. The order is also polled, so a webhook that lands first settles it too. Never says "failed" while unsure.
 */
export function ConfirmingPayment({ orderId, proof }) {
  const navigate = useNavigate();
  const { clear } = useCart();
  const [order] = useOrder(orderId);
  const requestId = useRef(crypto.randomUUID());
  const [outcome, setOutcome] = useState(null); // 'sold' | 'bad'
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    let live = true;
    const timers = [setTimeout(() => live && setSlow(true), SLOW_MS)];
    const attempt = async (n) => {
      const res = await call('confirmPayment', { orderId, ...proof, requestId: requestId.current });
      if (!live || res.ok) return; // success: the stage below moves the page on
      const reason = res.error?.reason;
      if (reason === 'sold_during_payment') return setOutcome('sold');
      if (['bad_signature', 'amount_mismatch'].includes(reason) || res.error?.code === 'forbidden') return setOutcome('bad');
      if (n < RETRY_MS.length) timers.push(setTimeout(() => attempt(n + 1), RETRY_MS[n])); // unavailable, internal, in_progress or offline
      return undefined;
    };
    if (proof) attempt(0); // without a proof (a reload of ?placed=1) the order poll alone decides
    return () => { live = false; timers.forEach(clearTimeout); };
  }, [orderId, proof]);

  const done = useRef(false);
  useEffect(() => {
    if (SETTLED.includes(order?.stage) && !done.current) {
      done.current = true;
      clear();
      navigate(`/orders/${orderId}?placed=1`, { replace: true });
    } else if (order?.stage === 'refunded') setOutcome('sold');
  }, [order?.stage, orderId, clear, navigate]);

  if (outcome === 'sold') {
    return (
      <div className="alert warn" role="alert"><Icon name="undo" /><div><strong>It sold while you were paying.</strong>Your money is being returned.<br />
        <Link className="btn btn-secondary btn-sm" to={`/orders/${orderId}`}>View the Order</Link></div></div>
    );
  }
  if (outcome === 'bad') {
    return (
      <div className="alert err" role="alert"><Icon name="alert" /><div><strong>We couldn&apos;t confirm that payment.</strong>If money left your account, it will be returned.<br />
        <Link className="btn btn-secondary btn-sm" to={`/orders/${orderId}`}>View the Order</Link></div></div>
    );
  }
  return (
    <div className="panel stack" aria-live="polite">
      <div className="row"><span className="spinner" aria-hidden="true" /><strong>Confirming your payment…</strong></div>
      {slow && (
        <p className="small muted">This is taking longer than usual. Your payment is safe. You can leave this page; your Order will show the result.{' '}
          <Link to={`/orders/${orderId}`}>Go to your Order</Link></p>
      )}
    </div>
  );
}
