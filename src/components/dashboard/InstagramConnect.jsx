import { useEffect, useState } from 'react';
import { call } from '../../api/gateway';
import { errorText } from '../../lib/format';
import { INSTAGRAM_CHANNEL, POPUP_NAME, instagramMessage } from '../../lib/instagram';

const REASONS = {
  not_connected: 'Connect your Instagram account first.',
  reconnect: 'Your Instagram connection needs renewing. Connect again.',
  instagram_down: 'Instagram isn’t answering right now. Try again in a minute.',
  already_added: 'already added',
  reel_limit: 'no free slot (12 reels at most)',
  not_yours: 'not found on your account',
};
const explain = (res) => REASONS[res.error?.reason] || errorText(res.error);

/** Connect an Instagram creator or business account and import its reels (they show as verified). Hidden until the server is set up. */
export function InstagramConnect({ onChanged }) {
  const [status, setStatus] = useState(null); // {enabled, connected, username, needsReconnect}
  const [media, setMedia] = useState(null); // {items, slotsLeft} while the picker is open
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const loadStatus = async () => {
    const res = await call('instagramStatus');
    setStatus(res.ok ? res.data : { enabled: false });
  };
  useEffect(() => { loadStatus(); }, []);
  // The login popup reports back here when Meta returns (see pages/InstagramReturn.jsx).
  useEffect(() => {
    let ch;
    try { ch = new BroadcastChannel(INSTAGRAM_CHANNEL); } catch { return undefined; }
    ch.onmessage = (e) => {
      setBusy(false);
      setMsg(instagramMessage(e.data?.result, e.data?.reason));
      loadStatus();
      onChanged?.();
    };
    return () => ch.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one listener for the card's lifetime
  }, []);

  if (!status?.enabled) return null;

  // Meta's login runs in a popup (that is how its Instagram step finds its way back). The window is opened
  // during the click, because browsers block popups opened after an await, then pointed at Meta's login.
  const connect = async () => {
    setMsg(null);
    setBusy(true);
    const popup = window.open('', POPUP_NAME, 'width=600,height=760');
    const res = await call('instagramStart');
    setBusy(false);
    if (!res.ok) {
      popup?.close();
      return setMsg(explain(res));
    }
    if (popup) {
      popup.location.href = res.data.url;
      return setMsg('Finish connecting in the Instagram window. This page updates when you are done.');
    }
    return window.location.assign(res.data.url); // popup blocked: same tab; the return page brings the artist back
  };

  const openPicker = async () => {
    setMsg(null);
    setBusy(true);
    const res = await call('instagramMedia');
    setBusy(false);
    if (!res.ok) {
      if (res.error?.reason === 'reconnect') setStatus((s) => ({ ...s, needsReconnect: true }));
      return setMsg(explain(res));
    }
    setPicked([]);
    return setMedia(res.data);
  };

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const importPicked = async () => {
    setBusy(true);
    const res = await call('instagramImport', { mediaIds: picked });
    setBusy(false);
    if (!res.ok) return setMsg(explain(res));
    const { added, refused } = res.data;
    setMsg(`Imported ${added.length} reel${added.length === 1 ? '' : 's'}.${refused.length ? ` Skipped ${refused.length}: ${[...new Set(refused.map((r) => REASONS[r.reason] || r.reason))].join(', ')}.` : ''}`);
    setMedia(null);
    return onChanged?.();
  };

  const disconnect = async () => {
    if (!window.confirm('Disconnect Instagram? Your reels stay, but lose the verified mark.')) return;
    setBusy(true);
    const res = await call('instagramDisconnect');
    setBusy(false);
    if (!res.ok) return setMsg(explain(res));
    setMedia(null);
    setMsg('Instagram disconnected.');
    await loadStatus();
    return onChanged?.();
  };

  return (
    <section className="panel stack" aria-labelledby="ig-title">
      <h2 id="ig-title">Instagram</h2>

      {!status.connected && (
        <>
          <p className="small muted">Connect your Instagram to import your reels with a verified mark. Needs a creator or business account (free to switch in Instagram: Settings, then Account type and tools).</p>
          <button className="btn btn-primary" onClick={connect} disabled={busy}>{busy ? 'Opening Instagram…' : 'Connect Instagram'}</button>
        </>
      )}

      {status.connected && (
        <>
          <p className="small">Connected as <strong>@{status.username}</strong></p>
          {status.needsReconnect && (
            <p className="alert info" role="alert">
              Your Instagram connection needs renewing. <button className="btn btn-secondary btn-sm" onClick={connect} disabled={busy}>Connect again</button>
            </p>
          )}
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <button className="btn btn-primary" onClick={openPicker} disabled={busy || status.needsReconnect}>Import from Instagram</button>
            <button className="btn btn-secondary" onClick={disconnect} disabled={busy}>Disconnect</button>
          </div>
        </>
      )}

      {media && (
        <div className="stack sm">
          {media.items.length === 0 && <p className="small muted">No reels or videos found on this account.</p>}
          {media.items.length > 0 && (
            <p className="small muted">{media.slotsLeft} free slot{media.slotsLeft === 1 ? '' : 's'}. Pick the reels to import.</p>
          )}
          <div className="grid g3">
            {media.items.map((m) => {
              const checked = picked.includes(m.id);
              const full = !checked && picked.length >= media.slotsLeft;
              return (
                <label key={m.id} className="stack sm" style={{ opacity: m.imported || full ? 0.5 : 1 }}>
                  {m.thumbnail
                    ? <img src={m.thumbnail} alt={m.caption || 'Reel'} loading="lazy" style={{ maxWidth: '100%', borderRadius: 8 }} />
                    : <span className="skeleton" style={{ display: 'block', height: 120 }} />}
                  <span className="row small" style={{ gap: 8 }}>
                    <input type="checkbox" checked={checked} disabled={m.imported || full} onChange={() => toggle(m.id)} />
                    {m.imported ? 'Already added' : 'Import'}
                  </span>
                </label>
              );
            })}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-primary" onClick={importPicked} disabled={busy || picked.length === 0}>
              {busy ? 'Importing…' : `Import ${picked.length || ''}`.trim()}
            </button>
            <button className="btn btn-secondary" onClick={() => setMedia(null)} disabled={busy}>Close</button>
          </div>
        </div>
      )}

      {msg && <p className="alert info" role="status">{msg}</p>}
    </section>
  );
}
