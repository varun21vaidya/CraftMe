// The single seam between the UI and the backend. Components call these functions and hooks only.
// Every function resolves to an envelope-shaped result and never throws: {ok:true,...} or {ok:false,error:{code,reason?}}.
import { httpsCallable } from 'firebase/functions';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import {
  addDoc, collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, startAfter, updateDoc, where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  useCollectionData, useCollectionDataOnce, useDocumentData,
} from 'react-firebase-hooks/firestore';
import { auth, db, functions, googleProvider, storage } from './firebase';

const ID = { idField: 'id' };
const fail = (code, requestId) => ({ ok: false, error: { code }, requestId });

/** Direct (rule-limited) writes: map a rules rejection to the same codes the commands use. */
const safe = async (fn) => {
  try {
    return { ok: true, ...(await fn()) };
  } catch (e) {
    return fail(e?.code === 'permission-denied' ? 'forbidden' : 'unavailable');
  }
};

const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

// ---------- commands ----------
/** Calls a backend command. Pass your own requestId to make a retry replay the first result. */
export const call = async (name, input = {}) => {
  const requestId = input.requestId || crypto.randomUUID();
  try {
    const res = await httpsCallable(functions, name)({ ...input, requestId });
    return res.data;
  } catch {
    return fail('unavailable', requestId);
  }
};

// ---------- session ----------
const toUser = async (u) => ({
  uid: u.uid, email: u.email, displayName: u.displayName, photoURL: u.photoURL,
  claims: (await u.getIdTokenResult()).claims, // cached token: no network round trip
});
export const watchAuth = (cb) => onAuthStateChanged(auth, async (u) => cb(u ? await toUser(u) : null));
/** Force-refresh after a command that changes roles (becomeArtist, setRole). */
export const refreshClaims = async () => (await auth.currentUser.getIdTokenResult(true)).claims;
export const signInWithGoogle = () => safe(async () => { await signInWithPopup(auth, googleProvider); return {}; });
export const signOutUser = () => signOut(auth);

// ---------- reads (live listeners and one-shot pages) ----------
export const useOrder = (orderId) => useDocumentData(orderId ? doc(db, 'orders', orderId) : null, ID);
export const useMyOrders = (uid) => useCollectionData(
  uid ? query(collection(db, 'orders'), where('buyerId', '==', uid), orderBy('createdAt', 'desc'), limit(50)) : null, ID,
);
export const useArtistInbox = (uid) => useCollectionData(
  uid ? query(collection(db, 'orders'), where('artistId', '==', uid), orderBy('createdAt', 'desc'), limit(50)) : null, ID,
);
/** Browse: one query on artworks (the card data lives on the Artwork). cursor = last item's createdAt. */
export const useArtworks = ({ category } = {}, cursor = null) => {
  const parts = [where('status', '==', 'published'), where('artistOpen', '==', true)];
  if (category) parts.push(where('category', '==', category));
  parts.push(orderBy('createdAt', 'desc'));
  if (cursor) parts.push(startAfter(cursor));
  return useCollectionDataOnce(query(collection(db, 'artworks'), ...parts, limit(24)), ID);
};
export const useArtwork = (id) => useDocumentData(id ? doc(db, 'artworks', id) : null, ID);
/** One live listener on an Artwork's Listings while its page is open. */
export const useListings = (artworkId) => useCollectionData(
  artworkId
    ? query(collection(db, 'listings'), where('artworkId', '==', artworkId),
      where('status', 'in', ['live', 'sold']), where('artistOpen', '==', true))
    : null,
  ID,
);
/**
 * The Listings in the Cart, read live so the Cart shows today's price. Returns {listingId: listing | null};
 * null means gone or no longer for sale. One listener per Listing, all released on change or unmount.
 */
export function useListingsByIds(ids) {
  const key = ids.join(',');
  const [map, setMap] = useState({});
  useEffect(() => {
    const list = key ? key.split(',') : [];
    const put = (id, v) => setMap((m) => ({ ...m, [id]: v }));
    const stops = list.map((id) => onSnapshot(
      doc(db, 'listings', id),
      (snap) => put(id, snap.exists() ? { id, ...snap.data() } : null),
      () => put(id, null),
    ));
    return () => stops.forEach((stop) => stop());
  }, [key]);
  return map;
}
export const useNotifications = (uid) => useCollectionData(
  uid ? query(collection(db, 'notifications'), where('userId', '==', uid), orderBy('createdAt', 'desc'), limit(20)) : null, ID,
);

// ---------- direct writes (field-limited by the Firestore rules) ----------
export const markRead = (notificationId) => safe(async () => {
  await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  return {};
});
const DRAFT_FIELDS = {
  artworks: ['title', 'description', 'category', 'photos', 'video', 'status'],
  listings: ['price', 'size', 'medium', 'title', 'status'],
};
const CREATE_EXTRA = { listings: ['artworkId', 'kind', 'stock'] };
/** Creates (id null) or edits an Artist's draft Artwork or Listing. artistId and createdAt are set here, status starts as draft. */
export const saveDraft = (kind, id, fields, uid) => safe(async () => {
  const data = pick(fields, DRAFT_FIELDS[kind]);
  if (kind === 'artworks' && data.title) data.titleLower = data.title.toLowerCase();
  if (id) {
    await updateDoc(doc(db, kind, id), data);
    return { id };
  }
  const created = await addDoc(collection(db, kind), {
    ...data, ...pick(fields, CREATE_EXTRA[kind] || []), artistId: uid, status: 'draft', createdAt: serverTimestamp(),
  });
  return { id: created.id };
});

// ---------- files ----------
/** kind: 'artworks' | 'videos' | 'damage'. Stored under the caller's own folder; type and size are enforced by Storage rules. */
export const upload = (kind, file, uid) => safe(async () => {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${kind}/${uid}/${crypto.randomUUID()}.${ext}`;
  const r = ref(storage, path);
  await uploadBytes(r, file, { contentType: file.type });
  return { path, url: await getDownloadURL(r) };
});
