// The single seam between the UI and the backend. Components call these functions and hooks only.
// Every function resolves to an envelope-shaped result and never throws: {ok:true,...} or {ok:false,error:{code,reason?}}.
// Backend: Supabase. Rows come back snake_case with ISO times; they are mapped here to the camelCase / epoch-ms shapes the pages use.
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

const fail = (code, requestId, extra = {}) => ({ ok: false, error: { code, ...extra }, requestId });

// ---------- row mapping ----------
const camelKey = (k) => k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const snakeKey = (k) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const ISO = /^\d{4}-\d{2}-\d{2}T/;
/** snake_case -> camelCase keys, ISO timestamps -> epoch milliseconds (what the pages compare with Date.now()). */
const camel = (v) => {
  if (Array.isArray(v)) return v.map(camel);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [camelKey(k), camel(x)]));
  return typeof v === 'string' && ISO.test(v) ? Date.parse(v) : v;
};
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [snakeKey(k), obj[k]]));

/** Which buttons exist for an order. Pure; the database functions enforce the same rules again. */
const allowedActions = (o, role, now) => {
  if (role === 'artist') {
    return { canShip: o.stage === 'paid', canViewAddress: ['paid', 'shipped', 'received'].includes(o.stage) };
  }
  const received = o.stage === 'received';
  return {
    canPay: o.stage === 'hold' && now < o.holdUntil,
    canConfirmReceived: o.stage === 'shipped',
    canReportDamage: received && !o.openReport && !o.damageReported && now <= o.damageWindowEnds,
    canReview: received && !o.reviewed && now <= o.reviewBy,
  };
};
const toOrder = (row) => {
  const { orderLines, ...rest } = camel(row);
  const order = { ...rest, lines: orderLines || [] };
  const now = Date.now();
  return { ...order, buyerActions: allowedActions(order, 'buyer', now), artistActions: allowedActions(order, 'artist', now) };
};
const toProfile = (row) => {
  const p = camel(row);
  return { ...p, photoURL: p.photoUrl };
};

/** Throws on a query error so the hooks can surface it; returns data. */
const must = ({ data, error }) => {
  if (error) throw error;
  return data;
};

// ---------- commands ----------
/** A Postgres function raises {"code","reason",...} as its message (see public.fail); anything else is unexpected. */
const fromDbError = (error, requestId) => {
  try {
    const { code, reason, ...extra } = JSON.parse(error.message);
    if (code) return fail(code, requestId, { ...(reason ? { reason } : {}), ...extra });
  } catch { /* not one of ours */ }
  return fail(error.code === '42501' ? 'forbidden' : 'unavailable', requestId);
};

// Commands that only touch the database run as Postgres functions (one transaction, ownership checked inside).
const RPC = {
  markShipped: (i) => ['mark_shipped', { p_order: i.orderId, p_courier: i.courier, p_tracking: i.trackingNumber ?? '' }],
  confirmReceived: (i) => ['confirm_received', { p_order: i.orderId }],
  reportDamage: (i) => ['report_damage', { p_order: i.orderId, p_line_ids: i.lineIds, p_note: i.note, p_photos: i.photoPaths ?? [] }],
  submitReview: (i) => ['submit_review', { p_order: i.orderId, p_rating: i.rating, p_comment: i.comment }],
  report: (i) => ['report', { p_target_type: i.targetType, p_target: i.targetId, p_reason: i.reason }],
  submitVerification: (i) => ['submit_verification', { p_legal_name: i.legalName, p_pan: i.pan, p_method: i.payoutMethod }],
  decideDamage: (i) => ['decide_damage', { p_order: i.orderId, p_decision: i.decision, p_note: i.note ?? '' }],
  decideReview: (i) => ['decide_review', { p_order: i.reviewId, p_decision: i.decision }],
  markVerified: (i) => ['mark_verified', { p_artist: i.uid }],
  restrictArtist: (i) => ['restrict_artist', { p_artist: i.artistId, p_restricted: i.restricted, p_reason: i.reason ?? '' }],
  buildPayoutRun: () => ['build_payout_run', {}],
  recordPayout: (i) => ['record_payout', { p_payout: i.payoutId, p_reference: i.reference }],
};

/** Calls a backend command. Pass your own requestId to make a retry replay the first result. */
export const call = async (name, input = {}) => {
  const requestId = input.requestId || crypto.randomUUID();
  try {
    if (RPC[name]) {
      const [fn, args] = RPC[name](input);
      const { data, error } = await supabase.rpc(fn, args);
      return error ? fromDbError(error, requestId) : { ok: true, data: data ?? {}, requestId };
    }
    // Commands that need Razorpay or the auth admin API run in the `api` Edge Function (placeOrder, confirmPayment, ...).
    const { data, error } = await supabase.functions.invoke('api', { body: { ...input, name, requestId } });
    return error || !data ? fail('unavailable', requestId) : data;
  } catch {
    return fail('unavailable', requestId);
  }
};

// ---------- session ----------
const toUser = (u) => ({
  uid: u.id,
  email: u.email,
  displayName: u.user_metadata?.full_name || u.user_metadata?.name || '',
  photoURL: u.user_metadata?.avatar_url || u.user_metadata?.picture || '',
  claims: u.app_metadata || {}, // roles live in app_metadata: only the server can set them
});
/** cb gets the signed-in user or null, once at start and again on every change. Returns the unsubscribe function. */
export const watchAuth = (cb) => {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session?.user ? toUser(session.user) : null));
  return () => data.subscription.unsubscribe();
};
/** Force-refresh after a command that changes roles (becomeArtist, setRole). */
export const refreshClaims = async () => {
  const { data } = await supabase.auth.refreshSession();
  return data.session?.user?.app_metadata || {};
};
export const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
  return error ? fail('unavailable') : { ok: true };
};
export const signOutUser = () => supabase.auth.signOut();

// ---------- reads ----------
/**
 * Runs fetcher() on mount and when deps change, and again every pollMs when set. Same tuple as the old live hooks:
 * [data, loading, error, reload]. A null fetcher means "nothing to load yet". Polling replaces live listeners (free-tier friendly).
 * reload() fetches again now (after the page itself changed the data).
 */
function useQuery(fetcher, deps, pollMs = 0) {
  const [state, setState] = useState({ data: undefined, loading: Boolean(fetcher), error: undefined });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!fetcher) {
      setState({ data: undefined, loading: false, error: undefined });
      return undefined;
    }
    let live = true;
    const run = async () => {
      try {
        const data = await fetcher();
        if (live) setState({ data: data ?? undefined, loading: false, error: undefined });
      } catch (error) {
        if (live) setState((s) => ({ ...s, loading: false, error }));
      }
    };
    run();
    const timer = pollMs ? setInterval(run, pollMs) : null;
    return () => {
      live = false;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetcher is rebuilt every render; deps say when it really changes
  }, [...deps, tick]);
  return [state.data, state.loading, state.error, () => setTick((n) => n + 1)];
}

const ORDERS = '*, order_lines(*)';
export const useOrder = (orderId) => useQuery(
  orderId ? async () => {
    const row = must(await supabase.from('orders').select(ORDERS).eq('id', orderId).maybeSingle());
    return row ? toOrder(row) : null;
  } : null,
  [orderId], 4000, // the payment webhook may land while the page is open
);
export const useMyOrders = (uid) => useQuery(
  uid ? async () => must(await supabase.from('orders').select(ORDERS).eq('buyer_id', uid).order('created_at', { ascending: false }).limit(50)).map(toOrder) : null,
  [uid], 15000,
);
export const useArtistInbox = (uid) => useQuery(
  uid ? async () => must(await supabase.from('orders').select(ORDERS).eq('artist_id', uid).order('created_at', { ascending: false }).limit(50)).map(toOrder) : null,
  [uid], 15000,
);
/** Browse: one query on artworks (the card data lives on the Artwork). cursor = last item's createdAt (epoch ms). */
const ARTIST_NAME = 'artist:profiles!artist_id(display_name)'; // the card's "by <name>" link, in the same request
export const useArtworks = ({ categories } = {}, cursor = null) => useQuery(async () => {
  let q = supabase.from('artworks').select(`*, ${ARTIST_NAME}`).eq('status', 'published').eq('artist_open', true);
  if (categories) q = q.in('category', categories);
  if (cursor) q = q.lt('created_at', new Date(cursor).toISOString());
  return must(await q.order('created_at', { ascending: false }).limit(24)).map(camel);
}, [categories?.join('|'), cursor]);
export const useArtwork =(id) => useQuery(
  id ? async () => camel(must(await supabase.from('artworks').select('*').eq('id', id).maybeSingle()) || null) : null,
  [id],
);
export const useArtist = (id) => useQuery(
  id ? async () => {
    const row = must(await supabase.from('profiles').select('*').eq('id', id).maybeSingle());
    return row ? toProfile(row) : null;
  } : null,
  [id],
);
/** The Artist's own works for their dashboard: drafts and taken-down works included, each with its Listings. */
export const useMyWorks = (uid) => useQuery(
  uid ? async () => must(await supabase.from('artworks').select('*, listings(*)').eq('artist_id', uid).neq('status', 'removed')
    .order('created_at', { ascending: false }).limit(100)).map(camel) : null,
  [uid],
);
/** An Artist's public works, on-sale ones first then sold ones. `limit` grows by 24 each "Show more". */
export const useArtistWorks = (id, limit = 24) => useQuery(
  id ? async () => must(await supabase.from('artworks').select('*').eq('artist_id', id).eq('status', 'published')
    .eq('artist_open', true).order('available', { ascending: false }).order('created_at', { ascending: false }).limit(limit)).map(camel) : null,
  [id, limit], 30000,
);
/** An Artwork's Listings while its page is open (refreshed so stock and price stay current). */
export const useListings = (artworkId) => useQuery(
  artworkId ? async () => must(await supabase.from('listings').select('*').eq('artwork_id', artworkId)
    .in('status', ['live', 'sold']).eq('artist_open', true)).map(camel) : null,
  [artworkId], 10000,
);
/**
 * The Listings in the Cart, so the Cart shows today's price. Returns {listingId: listing | null};
 * null means gone or no longer for sale.
 */
export function useListingsByIds(ids) {
  const key = ids.join(',');
  const [data] = useQuery(
    key ? async () => {
      const found = Object.fromEntries(must(await supabase.from('listings').select('*').in('id', key.split(','))).map((r) => [r.id, camel(r)]));
      return Object.fromEntries(key.split(',').map((id) => [id, found[id] || null]));
    } : null,
    [key], 10000,
  );
  return data || {};
}
export const useNotifications = (uid) => useQuery(
  uid ? async () => must(await supabase.from('notifications').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(20)).map(camel) : null,
  [uid], 20000,
);
/** An Artist's reels. mine = all of them (dashboard); otherwise only the highlighted ones (public page). */
export const useReels = (artistId, { mine = false } = {}) => useQuery(
  artistId ? async () => {
    let q = supabase.from('reels').select('*').eq('artist_id', artistId);
    if (!mine) q = q.eq('highlighted', true);
    return must(await q.order('position').order('created_at')).map(camel);
  } : null,
  [artistId, mine], 30000,
);
export const useReel = (id) => useQuery(
  id ? async () => camel(must(await supabase.from('reels').select('*').eq('id', id).maybeSingle()) || null) : null,
  [id],
);

// ---------- direct writes (column-limited by database grants and Row Level Security) ----------
/** Direct writes: a rejected grant or policy maps to the same codes the commands use. */
const safe = async (fn) => {
  try {
    return { ok: true, ...(await fn()) };
  } catch (e) {
    return fromDbError(e ?? {}); // keeps the database's reason (e.g. reel_limit) when it gave one
  }
};

export const saveProfile = (uid, fields) => safe(async () => {
  must(await supabase.from('profiles').update(pick(fields, ['displayName', 'bio', 'instagramHandle'])).eq('id', uid));
  return {};
});
export const markRead = (notificationId) => safe(async () => {
  must(await supabase.from('notifications').update({ read: true }).eq('id', notificationId));
  return {};
});
export const markAllRead = (uid) => safe(async () => {
  must(await supabase.from('notifications').update({ read: true }).eq('user_id', uid).eq('read', false));
  return {};
});
/** Adds, edits or removes one of the Artist's reels. The database enforces the limits and the link format. */
export const saveReel = (uid, fields, id) => {
  const data = pick(fields, ['url', 'cover', 'highlighted', 'position', 'title']);
  return safe(async () => {
    if (id) return { id, ...must(await supabase.from('reels').update(data).eq('id', id).select('id').single()) };
    const row = must(await supabase.from('reels').insert({ ...data, ...pick(fields, ['ownerConfirmed']), artist_id: uid }).select('id').single());
    return { id: row.id };
  });
};
export const deleteReel = (id) => safe(async () => {
  must(await supabase.from('reels').delete().eq('id', id));
  return {};
});
/** When an Instagram data-deletion request finished (epoch ms), or null when unknown or still running. */
export const getDeletionStatus = async (code) => {
  const { data, error } = await supabase.rpc('instagram_deletion_status', { p_code: code });
  return error || !data ? null : Date.parse(data);
};
const DRAFT_FIELDS = {
  artworks: ['title', 'description', 'category', 'photos', 'video', 'status', 'reelId'],
  listings: ['price', 'size', 'medium', 'title', 'status'],
};
const CREATE_EXTRA = { listings: ['artworkId', 'kind', 'stock'] };
/** Creates (id null) or edits an Artist's draft Artwork or Listing. artist_id is set here, status starts as draft. */
export const saveDraft = (kind, id, fields, uid) => safe(async () => {
  const data = pick(fields, DRAFT_FIELDS[kind]);
  if (id) {
    must(await supabase.from(kind).update(data).eq('id', id));
    return { id };
  }
  const row = must(await supabase.from(kind).insert({ ...data, ...pick(fields, CREATE_EXTRA[kind] || []), artist_id: uid, status: 'draft' }).select('id').single());
  return { id: row.id };
});

/**
 * Puts one of the Artist's Artworks on sale: adds a Listing (kind, size, medium, price in paise, stock), then publishes both.
 * On a failure the result carries artworkId, so the page can say the Artwork was kept as a draft.
 */
export const sellArtwork = async (uid, artworkId, title, sale) => {
  const l = await saveDraft('listings', null, { ...sale, title, artworkId }, uid);
  if (!l.ok) return { ...l, artworkId };
  const live = await safe(async () => {
    must(await supabase.from('artworks').update({ status: 'published' }).eq('id', artworkId).select('id').single());
    must(await supabase.from('listings').update({ status: 'live' }).eq('id', l.id).select('id').single());
    return {};
  });
  return live.ok ? { ok: true, id: artworkId } : { ...live, artworkId };
};
/** A new work on sale in one step: a draft Artwork, then sellArtwork. */
export const publishWork = async (uid, art, sale) => {
  const a = await saveDraft('artworks', null, art, uid);
  return a.ok ? sellArtwork(uid, a.id, art.title, sale) : a;
};
/**
 * Takes a work down (hidden from Browse, its Listings can't be bought) or puts it back on sale.
 * Sold Listings are left alone. The `.select` makes a refused update an error instead of a silent no-op.
 */
export const setWorkOnSale = (artworkId, onSale) => safe(async () => {
  if (onSale) {
    must(await supabase.from('artworks').update({ status: 'published' }).eq('id', artworkId).select('id').single());
    must(await supabase.from('listings').update({ status: 'live' }).eq('artwork_id', artworkId).eq('status', 'draft').select('id'));
  } else {
    must(await supabase.from('listings').update({ status: 'draft' }).eq('artwork_id', artworkId).eq('status', 'live').select('id'));
    must(await supabase.from('artworks').update({ status: 'draft' }).eq('id', artworkId).select('id').single());
  }
  return {};
});
export const setListingPrice = (listingId, paise) => safe(async () => {
  must(await supabase.from('listings').update({ price: paise }).eq('id', listingId).select('id').single());
  return {};
});

// ---------- files ----------
/** kind: 'artworks' | 'videos' | 'damage' (a storage bucket each). Stored under the caller's own folder; type and size are enforced by the bucket. */
export const upload = (kind, file, uid) => safe(async () => {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const name = `${uid}/${crypto.randomUUID()}.${ext}`;
  const bucket = supabase.storage.from(kind);
  must(await bucket.upload(name, file, { contentType: file.type }));
  // public buckets give a permanent URL; the private damage bucket gives a 1-hour signed one (the stored value is the path)
  const url = kind === 'damage' ? must(await bucket.createSignedUrl(name, 3600)).signedUrl : bucket.getPublicUrl(name).data.publicUrl;
  return { path: `${kind}/${name}`, url };
});
