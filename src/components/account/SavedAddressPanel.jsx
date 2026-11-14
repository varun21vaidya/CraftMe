import { useState } from 'react';
import { removeAddress, saveAddress, useSavedAddress } from '../../api/gateway';
import { cleanAddress, emptyAddress, serverFieldError, validateAddress } from '../../lib/address';
import { errorText } from '../../lib/format';
import { AddressFields } from '../checkout/AddressFields';
import { Dialog } from '../ui/Dialog';
import { useToast } from '../ui/Toast';

const FIELDS = Object.keys(emptyAddress);
const fromRow = (a) => (a ? Object.fromEntries(FIELDS.map((f) => [f, a[f] ?? ''])) : { ...emptyAddress });

/** S16: the one saved address (PD12 puts the phone here), with S16.dlg.addr to edit it and a confirm to remove it. */
export function SavedAddressPanel({ uid }) {
  const [address, loading, loadError, reload] = useSavedAddress(uid);
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [values, setValues] = useState(emptyAddress);
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const open = () => { setValues(fromRow(address)); setErrors({}); setFailure(null); setEditing(true); };
  const focusFirst = (found) => {
    const first = FIELDS.find((f) => found[f]);
    if (first) document.getElementById(`ship-${first}`)?.focus();
  };

  const save = async () => {
    const found = validateAddress(values);
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length) { focusFirst(found); return; }
    setBusy(true);
    const res = await saveAddress(uid, cleanAddress(values));
    setBusy(false);
    if (!res.ok) {
      const fields = Object.fromEntries((res.error.fields || []).map((f) => [f, serverFieldError(f)]));
      setErrors(fields);
      setFailure(errorText(res.error));
      focusFirst(fields);
      return;
    }
    setEditing(false);
    toast('Address saved');
    reload();
  };

  const remove = async () => {
    setBusy(true);
    const res = await removeAddress(uid);
    setBusy(false);
    setRemoving(false);
    if (res.ok) { toast('Address removed'); reload(); } else toast(errorText(res.error), { kind: 'err' });
  };

  return (
    <section className="panel stack" aria-labelledby="addr-h">
      <div className="row between"><h2 id="addr-h">Saved address</h2>
        {!loading && !loadError && (
          <span className="row">
            <button type="button" className="btn btn-secondary btn-sm" onClick={open}>{address ? 'Edit' : 'Add'}</button>
            {address && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRemoving(true)}>Remove</button>}
          </span>
        )}
      </div>
      {loading && <div className="skeleton" style={{ height: 64 }} aria-busy="true" />}
      {loadError && <p className="error-msg" role="alert">We couldn&apos;t load your address. <button type="button" className="btn btn-secondary btn-sm" onClick={reload}>Try again</button></p>}
      {!loading && !loadError && (address ? (
        <p data-testid="saved-address">
          <strong>{address.name}</strong><br />
          {[address.address, address.address2, address.landmark].filter(Boolean).join(', ')}<br />
          {address.city}, {address.state} {address.pin}<br />
          <span className="muted">+91 {address.phone}</span>
        </p>
      ) : <p className="muted">No saved address yet.</p>)}
      <p className="small muted">Used to fill Checkout. Each Order stores its own copy, so editing this never changes Orders already placed.</p>

      <Dialog open={editing} onClose={() => setEditing(false)} busy={busy} title={address ? 'Edit saved address' : 'Add an address'}
        footer={(
          <>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setEditing(false)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save address'}</button>
          </>
        )}>
        <div className="stack">
          <AddressFields values={values} errors={errors} onChange={(name, v) => setValues((s) => ({ ...s, [name]: v }))} />
          {failure && <p className="error-msg" role="alert">{failure}</p>}
        </div>
      </Dialog>

      <Dialog open={removing} onClose={() => setRemoving(false)} alert busy={busy} title="Remove your saved address?"
        footer={(
          <>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setRemoving(false)}>Cancel</button>
            <button type="button" className="btn btn-danger" disabled={busy} onClick={remove}>{busy ? 'Removing…' : 'Remove address'}</button>
          </>
        )}>
        <p>Checkout will no longer be filled in for you. Orders you have placed keep their own copy.</p>
      </Dialog>
    </section>
  );
}
