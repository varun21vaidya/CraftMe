import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { call, useListingsByIds } from '../api/gateway';
import { payWithRazorpay } from '../api/checkout';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { errorText, formatClock, formatINR } from '../lib/format';
import { useCountdown } from '../lib/useCountdown';

const schema = Yup.object({
  name: Yup.string().trim().required('Add your name'),
  phone: Yup.string().matches(/^[6-9]\d{9}$/, 'Enter a 10-digit mobile number').required('Add a phone number'),
  address: Yup.string().trim().required('Add your address'),
  city: Yup.string().trim().required('Add your city'),
  state: Yup.string().trim().required('Add your state'),
  pin: Yup.string().matches(/^\d{6}$/, 'Enter a 6-digit PIN code').required('Add your PIN code'),
});
const FIELDS = [['name', 'Full name'], ['phone', 'Phone'], ['address', 'Address'], ['city', 'City'], ['state', 'State'], ['pin', 'PIN code']];

/** Shown while a payment is open: the stock is kept for the Buyer until the clock runs out. */
function HeldPayment({ hold, onPay, busy }) {
  const left = useCountdown(hold.holdUntil);
  if (left === 0) {
    return (
      <div className="empty" role="alert">
        <h3>Your time ran out</h3><p>We’ve released the items. Go back to your Cart to try again.</p>
        <Link className="btn btn-primary" to="/cart">Back to Cart</Link>
      </div>
    );
  }
  return (
    <div className="panel stack">
      <h2>Complete your payment</h2>
      <p className="muted">We’re keeping your items for {formatClock(left)}.</p>
      <button className="btn btn-primary btn-lg" onClick={onPay} disabled={busy}>Pay {formatINR(hold.amount)}</button>
    </div>
  );
}

export default function CheckoutPage() {
  const { currentUser } = useAuth();
  const { cart, clear } = useCart();
  const navigate = useNavigate();
  const listings = useListingsByIds(cart.items.map((i) => i.listingId));
  const [hold, setHold] = useState(null); // {orderId, razorpayOrderId, keyId, amount, holdUntil}
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [phone, setPhone] = useState(''); // the number from the address form, so Razorpay doesn't ask for it again

  if (!cart.items.length && !hold) return <Navigate to="/cart" replace />;

  const pay = async (h, contact = phone) => {
    setBusy(true);
    setError(null);
    const proof = await payWithRazorpay({
      keyId: h.keyId, razorpayOrderId: h.razorpayOrderId, amount: h.amount, description: 'CraftMe order',
      prefill: { name: currentUser.displayName || '', email: currentUser.email || '', ...(contact && { contact: `+91${contact}` }) },
    });
    if (!proof.ok) {
      setBusy(false);
      if (!proof.dismissed) setError(errorText(proof.error));
      return;
    }
    const res = await call('confirmPayment', { orderId: h.orderId, ...proof });
    setBusy(false);
    if (!res.ok) return setError(errorText(res.error));
    clear();
    return navigate(`/orders/${h.orderId}`, { replace: true });
  };

  const place = async (address, { setSubmitting }) => {
    setError(null);
    const lines = cart.items.map((i) => ({ listingId: i.listingId, quantity: i.qty, seenUnitPaise: listings[i.listingId]?.price }));
    const res = await call('placeOrder', { artistId: cart.artistId, lines, address });
    setSubmitting(false);
    if (!res.ok) return setError(errorText(res.error));
    setHold(res.data);
    setPhone(address.phone);
    return pay(res.data, address.phone);
  };

  return (
    <main className="wrap page" style={{ maxWidth: 640 }}>
      <div className="page-head"><div><h1>Checkout</h1></div></div>
      {error && <p className="alert err" role="alert">{error} <Link to="/cart">Check your Cart</Link></p>}
      {hold ? <HeldPayment hold={hold} onPay={() => pay(hold)} busy={busy} /> : (
        <Formik initialValues={{ name: '', phone: '', address: '', city: '', state: '', pin: '' }} validationSchema={schema} onSubmit={place}>
          {({ values, errors, touched, handleChange, handleBlur, isSubmitting }) => (
            <Form className="panel stack" noValidate>
              <h2>Where should we send it?</h2>
              {FIELDS.map(([name, label]) => (
                <div className="field" key={name}>
                  <label htmlFor={name}>{label}</label>
                  <input id={name} name={name} className="input" value={values[name]} onChange={handleChange} onBlur={handleBlur} />
                  {touched[name] && errors[name] && <span className="error-msg">{errors[name]}</span>}
                </div>
              ))}
              <button className="btn btn-primary btn-lg" type="submit" disabled={isSubmitting}>Continue to payment</button>
            </Form>
          )}
        </Formik>
      )}
    </main>
  );
}
