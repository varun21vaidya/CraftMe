import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { call, removeUploads, upload, useOrder } from '../api/gateway';
import { useAuth } from '../contexts/AuthContext';
import { Icon } from '../components/common/Icon';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { Dropzone } from '../components/ui/Dropzone';
import { Timeline } from '../components/ui/Timeline';
import LazyLoadImage from '../components/ui/LazyLoadImage';
import { isBadId } from '../lib/artist';
import { errorText, FIELD_TEXT, formatDay, formatINR, KIND_LABEL } from '../lib/format';
import { uploadAll } from '../lib/uploads';

const NOTE_MAX = 800;
const KINDS = [['torn', 'Torn, creased or crushed'], ['broken', 'Broken or cracked'], ['water', 'Water or moisture damage'], ['wrong_item', 'Not the item I ordered'], ['other', 'Something else']];
// the reason a failed report call gives -> the view that explains it
const FORCED = { window_closed: 'closed', already_exists: 'submitted', wrong_stage: 'stage', not_found: 'notfound' };
const first = (name) => String(name || 'the Artist').trim().split(/\s+/)[0];

const Shell = ({ order, id, children, lead }) => (
  <main className="wrap mid page">
    <Breadcrumbs items={[{ to: '/orders', label: 'My orders' }, { to: `/orders/${id}`, label: order?.code || 'Order' }, { label: 'Report damage' }]} />
    <div className="page-head"><div><h1>Report damage</h1>{lead && <p>{lead}</p>}</div></div>
    {children}
  </main>
);

function Gate({ title, id, contact = false }) {
  return (
    <div className="alert err" role="status"><Icon name="clock" /><div><strong>{title}</strong>
      <span className="row"><Link className="btn btn-secondary btn-sm" to={`/orders/${id}`}>Back to Order</Link>
        {contact && <Link className="btn btn-ghost btn-sm" to="/legal/contact">Contact CraftMe</Link>}</span></div></div>
  );
}

/** Read from the stored report, so it survives a refresh and shows on any device. */
function Submitted({ report, id }) {
  const decided = report.status === 'upheld' || report.status === 'rejected';
  const items = [
    { label: 'You sent the report', at: report.createdAt, state: 'done' },
    { label: 'CraftMe reviews your photos', state: decided ? 'done' : 'now', detail: decided ? undefined : 'We’ll reply within 2 working days.' },
    decided
      ? { label: report.status === 'upheld' ? 'Upheld. You’re refunded for the damaged items.' : 'Not upheld', at: report.decidedAt, state: 'done', detail: report.decision || undefined }
      : { label: 'Decision', state: 'future', detail: 'If upheld, you’re refunded for the damaged items. If not, we tell you why.' },
  ];
  return (
    <div className="stack lg">
      <div className="alert ok" role="status"><Icon name="check" /><div><strong>Report sent</strong>
        Reference <span className="mono">{report.code}</span>.{!decided && ' You’ll get a notification here when we’ve decided.'}</div></div>
      <section className="panel stack"><h3>What happens now</h3>
        <Timeline items={items} label="Report progress" />
        <div className="row"><Link className="btn btn-primary" to={`/orders/${id}`}>Back to Order</Link></div></section>
    </div>
  );
}

function DamageForm({ order, id, onForced, onOpen }) {
  const { currentUser } = useAuth();
  const [lineIds, setLineIds] = useState([]);
  const [kind, setKind] = useState('');
  const [note, setNote] = useState('');
  const [items, setItems] = useState([]);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState(null); // 'uploading' | 'sending'
  const [notice, setNotice] = useState('');
  const summary = useRef(null);
  const alive = useRef(true);
  const sent = useRef(false);
  const paths = useRef([]);
  paths.current = items.filter((i) => i.path).map((i) => i.path);

  useEffect(() => onOpen(), []); // eslint-disable-line react-hooks/exhaustive-deps -- once, when the form first shows

  // leaving the page with unsent uploads removes them; whatever this misses the cleanup job removes after 24 hours
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (!sent.current && paths.current.length) removeUploads('damage', paths.current);
    };
  }, []);

  const onPhotos = (next) => {
    const gone = items.filter((i) => i.path && !next.some((n) => n.id === i.id));
    if (gone.length) removeUploads('damage', gone.map((g) => g.path));
    setItems(next);
    setErrors((e) => ({ ...e, photoPaths: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!lineIds.length) e.lineIds = FIELD_TEXT.lineIds;
    if (!kind) e.kind = FIELD_TEXT.kind;
    if (!note.trim()) e.note = FIELD_TEXT.note;
    if (items.length < 2) e.photoPaths = FIELD_TEXT.photoPaths;
    return e;
  };

  const send = async (ev) => {
    ev?.preventDefault();
    if (busy) return;
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) { setTimeout(() => summary.current?.focus(), 0); return; }
    setBusy(true);
    setNotice('');
    let list = items;
    if (list.some((i) => i.status !== 'done')) {
      setPhase('uploading');
      list = await uploadAll(list, async (file) => {
        if (!alive.current) return { ok: false };
        const r = await upload('damage', file, currentUser.uid);
        if (!alive.current && r.ok) removeUploads('damage', [r.path]); // left the page meanwhile
        return r;
      }, { onChange: (next) => alive.current && setItems(next) });
      if (!alive.current) return;
      if (list.some((i) => i.status !== 'done')) { setBusy(false); setPhase(null); return; }
    }
    setPhase('sending');
    const res = await call('reportDamage', { orderId: order.id, lineIds, note: note.trim(), photoPaths: list.map((i) => i.path), kind });
    if (!alive.current) return;
    setBusy(false);
    setPhase(null);
    if (res.ok) { sent.current = true; onForced('submitted', res.data); return; }
    const err = res.error;
    const forced = err.code === 'forbidden' ? 'notfound' : err.code === 'conflict' ? FORCED[err.reason] : null;
    if (forced) { // the report can't be made: the files are no use
      removeUploads('damage', list.map((i) => i.path));
      sent.current = true;
      onForced(forced);
    } else if (err.code === 'invalid' && err.fields?.length) {
      setErrors(Object.fromEntries(err.fields.map((f) => [f, FIELD_TEXT[f] || errorText(err)])));
      setTimeout(() => summary.current?.focus(), 0);
    } else {
      setNotice('We couldn’t send your report. Your photos are saved. Try again.');
    }
  };

  const toggle = (lid) => setLineIds((l) => (l.includes(lid) ? l.filter((x) => x !== lid) : [...l, lid]));
  const at = Math.max(1, ...items.map((i, n) => (i.status === 'uploading' || i.status === 'done' ? n + 1 : 0)));
  const label = phase === 'uploading' ? `Uploading photo ${at} of ${items.length}…` : phase === 'sending' ? 'Sending…' : 'Send report';
  const messages = Object.values(errors).filter(Boolean);
  const failed = items.some((i) => i.status === 'failed');

  return (
    <div className="split">
      <form className="stack lg" onSubmit={send} noValidate>
        <div className="alert info"><Icon name="clock" /><div><strong>Please tell us by {formatDay(order.damageWindowEnds)}.</strong>So we can sort it out quickly.</div></div>
        {messages.length > 0 && (
          <div className="alert err" role="alert" tabIndex={-1} ref={summary}><Icon name="alert" /><div><strong>Please fix these</strong>
            <ul>{messages.map((m) => <li key={m}>{m}</li>)}</ul></div></div>
        )}
        {notice && <div className="alert err" role="alert"><Icon name="alert" /><div>{notice}</div></div>}
        {failed && !busy && <div className="alert err" role="alert"><Icon name="alert" /><div>Some photos didn’t upload.<br /><button type="button" className="btn btn-secondary btn-sm" onClick={send}>Try again</button></div></div>}
        <fieldset disabled={busy} className="stack lg" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <section className="panel stack" aria-labelledby="dmg-items">
            <h3 id="dmg-items">Which items are damaged?</h3>
            {order.lines.map((l) => (
              <label key={l.listingId} className="option-card">
                <input type="checkbox" checked={lineIds.includes(l.listingId)} onChange={() => toggle(l.listingId)} />
                <div className="mat" style={{ width: 56, padding: 4, flex: 'none' }}>{l.artwork?.photos?.[0] && <LazyLoadImage src={l.artwork.photos[0]} alt="" width="100%" />}</div>
                <span className="grow"><strong>{l.title}</strong> × {l.quantity}<br /><span className="small muted">{KIND_LABEL[l.kind] || l.kind} · {formatINR(l.unitPaise * l.quantity)}</span></span>
              </label>
            ))}
            {errors.lineIds && <span className="error-msg"><Icon name="alert" size={14} />{errors.lineIds}</span>}
            <span className="hint">Refunds are decided for each item separately.</span>
          </section>
          <section className="panel stack">
            <h3>What’s wrong?</h3>
            <fieldset className="stack sm" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="sr">Type of damage</legend>
              {KINDS.map(([v, text]) => (
                <label key={v} className="radio"><input type="radio" name="kind" value={v} checked={kind === v} onChange={() => { setKind(v); setErrors((e) => ({ ...e, kind: undefined })); }} /> {text}</label>
              ))}
              {errors.kind && <span className="error-msg"><Icon name="alert" size={14} />{errors.kind}</span>}
            </fieldset>
            <div className={`field${errors.note ? ' has-error' : ''}`}>
              <label htmlFor="dd">Describe it <span className="req" aria-hidden="true">*</span></label>
              <textarea className="textarea" id="dd" maxLength={NOTE_MAX} value={note} aria-required="true" aria-invalid={errors.note ? true : undefined}
                aria-describedby="dd-c" placeholder="What did you find when you opened the parcel?"
                onChange={(e) => { setNote(e.target.value); setErrors((x) => ({ ...x, note: undefined })); }} />
              <span className="counter" id="dd-c">{note.length} / {NOTE_MAX}</span>
              {errors.note && <span className="error-msg"><Icon name="alert" size={14} />{errors.note}</span>}
            </div>
          </section>
          <section className="panel stack">
            <h3>Photos <span className="req" aria-hidden="true">*</span></h3>
            <p className="small muted" id="dz-help">Add at least 2: the outside of the parcel, and the damage up close. JPEG or PNG, up to 5 MB each, up to 6 photos.</p>
            <Dropzone files={items} onChange={onPhotos} disabled={busy} describedBy="dz-help" onRetry={() => send()} />
            {errors.photoPaths && <span className="error-msg"><Icon name="alert" size={14} />{errors.photoPaths}</span>}
          </section>
        </fieldset>
        <div className="row end">
          <Link className="btn btn-ghost" to={`/orders/${id}`}>Cancel</Link>
          <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>{label}</button>
        </div>
      </form>
      <aside className="stack sticky" aria-label="What to expect"><section className="panel stack"><h4>What to expect</h4>
        <ul className="list small">
          <li><Icon name="eye" size={18} />CraftMe reviews your photos and {first(order.artist?.displayName)}’s packing.</li>
          <li><Icon name="undo" size={18} />If we agree, you get your money back for the damaged items.</li>
          <li><Icon name="info" size={18} />You can send one Damage Report per Order.</li>
        </ul></section></aside>
    </div>
  );
}

export default function DamageReportPage() {
  const { id } = useParams();
  const [order, loading, error, reload] = useOrder(id);
  const [forced, setForced] = useState(null);
  const [fresh, setFresh] = useState(null);
  // once the form is open the poll no longer closes it under the buyer: their text and photos stay, and the server answers on Send
  const [opened, setOpened] = useState(false);
  const force = (view, data) => { setForced(view); setFresh(data || null); reload(); };

  if (loading) return <Shell id={id}><div className="skeleton" style={{ height: 320 }} aria-busy="true" /></Shell>;
  if (error && !order && !isBadId(error)) {
    return <Shell id={id}><div className="empty" role="alert"><h3>We couldn’t load this Order</h3><button className="btn btn-primary" onClick={reload}>Try again</button></div></Shell>;
  }
  if (!order || forced === 'notfound') {
    return <Shell id={id}><div className="empty"><h3>We couldn’t find this order</h3><Link className="btn btn-primary" to="/orders">My orders</Link></div></Shell>;
  }

  const report = order.damageReports?.[0] || (forced === 'submitted' ? { code: fresh?.code, status: 'open', createdAt: Date.now() } : null);
  const closed = forced === 'closed' || (!opened && order.stage === 'received' && Date.now() > order.damageWindowEnds);
  let body;
  if (report) body = <Submitted report={report} id={id} />;
  else if (forced === 'stage' || (!opened && order.stage !== 'received')) body = <Gate title="You can report damage once the Order is Received." id={id} />;
  else if (closed) body = <Gate title={`The time to report damage ended on ${formatDay(order.damageWindowEnds)}.`} id={id} contact />;
  else body = <DamageForm order={order} id={id} onForced={force} onOpen={() => setOpened(true)} />;
  return <Shell order={order} id={id} lead={report || closed ? null : 'Tell us what happened and show us. CraftMe decides, usually within 2 working days.'}>{body}</Shell>;
}
