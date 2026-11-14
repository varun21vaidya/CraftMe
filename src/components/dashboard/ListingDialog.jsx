import { useEffect, useRef, useState } from 'react';
import { call, saveListing } from '../../api/gateway';
import { Dialog } from '../ui/Dialog';
import { Field } from '../ui/Field';
import { errorText, formatINR } from '../../lib/format';
import { KINDS, validateListing } from '../../lib/works';

const KIND_HINT = { original: 'One of a kind. Stock is always 1.', print: 'Reproductions. You set the stock.', product: 'Made in numbers, ready to ship.' };
const empty = { kind: '', size: '', medium: '', price: '', stock: '1' };

/**
 * Add or edit one Listing. `listing` null = a new one. `ensureDraft()` saves a new work first and gives its id (or null when it could not).
 * The type is fixed once created; an Original is disabled when the work already has an open one.
 */
export function ListingDialog({ open, onClose, uid, listing, hasOriginal, published = false, ensureDraft, onSaved }) {
  const [v, setV] = useState(empty);
  const [errors, setErrors] = useState({});
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const held = listing?.held || 0;
  const editing = Boolean(listing);

  useEffect(() => {
    if (!open) return;
    setV(listing ? { kind: listing.kind, size: listing.size || '', medium: listing.medium || '', price: String(listing.price / 100), stock: String(listing.stock) } : empty);
    setErrors({}); setProblem(''); setEstimate(null);
  }, [open, listing]);

  // "What you'd receive": asked 300 ms after the price stops changing; hidden when the call fails
  const asked = useRef(0);
  useEffect(() => {
    const rupees = Number(v.price);
    setEstimate(null);
    if (!open || !Number.isInteger(rupees) || rupees < 1) return undefined;
    const mine = ++asked.current;
    const id = setTimeout(async () => {
      const res = await call('earningsEstimate', { pricePaise: rupees * 100 });
      if (res.ok && mine === asked.current) setEstimate(res.data.net);
    }, 300);
    return () => clearTimeout(id);
  }, [v.price, open]);

  const set = (patch) => setV((x) => ({ ...x, ...patch }));
  const save = async () => {
    const found = validateListing(v, { held });
    if (!v.kind) found.kind = 'Choose a type.';
    setErrors(found); setProblem('');
    if (Object.keys(found).length) return;
    setBusy(true);
    const artworkId = await ensureDraft();
    if (!artworkId) { setBusy(false); setProblem('Add a title and category to save a draft.'); return; }
    const fields = { size: v.size.trim(), medium: v.medium.trim(), price: Number(v.price) * 100 };
    let res = await saveListing(uid, listing?.id ?? null, editing ? fields : { ...fields, artworkId, kind: v.kind, title: '', stock: v.kind === 'original' ? 1 : Number(v.stock) });
    if (res.ok && !editing && published) res = await saveListing(uid, res.id, { status: 'live' });
    if (res.ok && editing && v.kind !== 'original' && Number(v.stock) !== listing.stock) res = await call('setListingStock', { listingId: listing.id, stock: Number(v.stock) });
    setBusy(false);
    if (!res.ok) {
      if (res.error?.reason === 'stock_range' && res.error.held !== undefined) setErrors({ stock: `${res.error.held} are in someone’s checkout right now.` });
      else if (res.error?.reason === 'original_stock') setErrors({ stock: 'An Original’s stock is always 1.' });
      else setProblem(res.error?.code === 'conflict' && res.error?.reason === undefined ? 'You already have an open Original on this Artwork.' : errorText(res.error));
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} busy={busy} title={editing ? 'Edit Listing' : 'Add Listing'}
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button><button type="button" className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save Listing'}</button></>}>
      <div className="stack">
        {problem && <div className="alert err" role="alert">{problem}</div>}
        <div className="grid g3" role="radiogroup" aria-label="Type">
          {KINDS.map((k) => {
            const off = editing ? k.value !== v.kind : k.value === 'original' && hasOriginal;
            return (
              <label key={k.value} className="option-card" style={off ? { opacity: 0.55 } : undefined}>
                <input type="radio" name="kind" value={k.value} checked={v.kind === k.value} disabled={off} onChange={() => set({ kind: k.value, stock: k.value === 'original' ? '1' : v.stock })} />
                <span><strong>{k.value === 'product' ? 'Ready-made item' : k.value === 'print' ? 'Print' : 'Original'}</strong><br /><span className="small muted">{KIND_HINT[k.value]}</span></span>
              </label>
            );
          })}
        </div>
        {errors.kind && <span className="error-msg">{errors.kind}</span>}
        <div className="form-grid">
          <Field id="ls-size" label="Size" required error={errors.size}><input className="input" value={v.size} placeholder="e.g. 30 × 40 cm" onChange={(e) => set({ size: e.target.value })} /></Field>
          <Field id="ls-medium" label="Medium and finish" required error={errors.medium}><input className="input" value={v.medium} placeholder="e.g. Acrylic, unframed" onChange={(e) => set({ medium: e.target.value })} /></Field>
          <Field id="ls-price" label="Price (₹)" required hint="Prices include shipping within India." error={errors.price}>
            <input className="input" inputMode="numeric" value={v.price} onChange={(e) => set({ price: e.target.value.replace(/[^\d]/g, '') })} />
          </Field>
          {v.kind !== 'original' && (
            <Field id="ls-stock" label="Stock" required hint={editing && held > 0 ? `${held} are in someone’s checkout right now.` : undefined} error={errors.stock}>
              <input className="input" inputMode="numeric" value={v.stock} onChange={(e) => set({ stock: e.target.value.replace(/[^\d]/g, '') })} />
            </Field>
          )}
        </div>
        {estimate !== null && <p className="small" role="status">What you’d receive: about {formatINR(estimate)}<br /><span className="muted">An estimate, after CraftMe’s share and the payment cost.</span></p>}
      </div>
    </Dialog>
  );
}
