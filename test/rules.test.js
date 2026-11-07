// @vitest-environment node
// Runs against the Firestore emulator: firebase emulators:exec --only firestore "npx vitest run test/rules.test.js"
// Without the emulator host set, the whole file is skipped so `npm test` stays green.
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, addDoc, collection } from 'firebase/firestore';

const host = process.env.FIRESTORE_EMULATOR_HOST;
let env;

const as = (uid, claims = {}) => env.authenticatedContext(uid, claims).firestore();

describe.skipIf(!host)('firestore rules', () => {
  beforeAll(async () => {
    const [h, port] = host.split(':');
    env = await initializeTestEnvironment({
      projectId: 'demo-craftme',
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: h, port: Number(port) },
    });
  });
  afterAll(() => env?.cleanup());

  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users/buyer1'), { displayName: 'B', bio: '', roles: [], restricted: false });
      await setDoc(doc(db, 'users/artist1'), { displayName: 'A', bio: '', roles: ['artist'], restricted: false });
      await setDoc(doc(db, 'listings/l1'), {
        artworkId: 'w1', artistId: 'artist1', kind: 'print', price: 220000, stock: 5, held: 0, status: 'live', artistOpen: true,
      });
      await setDoc(doc(db, 'artworks/w1'), { artistId: 'artist1', title: 'Kolam', status: 'published', artistOpen: true });
      await setDoc(doc(db, 'orders/o1'), { buyerId: 'buyer1', artistId: 'artist1', stage: 'hold', total: 220000 });
      await setDoc(doc(db, 'orders/o1/private/shipping'), { name: 'B', pin: '600001' });
      await setDoc(doc(db, 'artistPrivate/artist1'), { pan: 'ABCDE1234F', amountOwed: 0 });
    });
  });

  it('a Buyer cannot create an Order', async () => {
    await assertFails(setDoc(doc(as('buyer1'), 'orders/new'), { buyerId: 'buyer1', artistId: 'artist1', total: 1 }));
    await assertFails(addDoc(collection(as('buyer1'), 'orders'), { buyerId: 'buyer1', total: 1 }));
  });

  it('nobody can write their own roles', async () => {
    await assertFails(updateDoc(doc(as('buyer1'), 'users/buyer1'), { roles: ['admin'] }));
    await assertFails(updateDoc(doc(as('buyer1'), 'users/buyer1'), { restricted: true }));
    await assertSucceeds(updateDoc(doc(as('buyer1'), 'users/buyer1'), { displayName: 'New name' }));
  });

  it('an Artist cannot change stock, held or artistOpen on a Listing', async () => {
    const artist = as('artist1', { artist: true });
    await assertFails(updateDoc(doc(artist, 'listings/l1'), { stock: 999 }));
    await assertFails(updateDoc(doc(artist, 'listings/l1'), { held: 5 }));
    await assertFails(updateDoc(doc(artist, 'listings/l1'), { artistOpen: false }));
    await assertSucceeds(updateDoc(doc(artist, 'listings/l1'), { price: 230000 }));
  });

  it('a Buyer cannot change another Artist\'s Listing', async () => {
    await assertFails(updateDoc(doc(as('buyer1'), 'listings/l1'), { price: 100 }));
  });

  it('public can read an open published Artwork but not a hidden one', async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(anon, 'artworks/w1')));
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'artworks/w1'), { artistOpen: false }));
    await assertFails(getDoc(doc(anon, 'artworks/w1')));
  });

  it('Orders and private Artist data are only readable by the people involved', async () => {
    await assertSucceeds(getDoc(doc(as('buyer1'), 'orders/o1')));
    await assertFails(getDoc(doc(as('buyer2'), 'orders/o1')));
    await assertFails(getDoc(doc(as('buyer1'), 'artistPrivate/artist1')));
    await assertSucceeds(getDoc(doc(as('artist1'), 'artistPrivate/artist1')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'orders/o1')));
  });

  it('the Artist sees the shipping address only once the Order is paid', async () => {
    const artist = as('artist1', { artist: true });
    await assertFails(getDoc(doc(artist, 'orders/o1/private/shipping')));
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'orders/o1'), { stage: 'paid' }));
    await assertSucceeds(getDoc(doc(artist, 'orders/o1/private/shipping')));
    await assertSucceeds(getDoc(doc(as('buyer1'), 'orders/o1/private/shipping')));
  });

  it('nobody writes tokens, Reviews, Refunds or Payouts from a client', async () => {
    for (const path of ['instagramTokens/artist1', 'reviews/o1', 'refunds/r1', 'payouts/p1', 'requests/x', 'settings/business']) {
      await assertFails(setDoc(doc(as('artist1', { artist: true }), path), { a: 1 }));
    }
  });

  it('a Restricted Artist cannot create an Artwork', async () => {
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'users/artist1'), { restricted: true }));
    const artist = as('artist1', { artist: true });
    await assertFails(setDoc(doc(artist, 'artworks/new'), {
      artistId: 'artist1', title: 'T', description: '', photos: [], status: 'draft', createdAt: new Date(),
    }));
  });

  it('notifications: the owner may only mark read', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'notifications/n1'), { userId: 'buyer1', read: false }));
    await assertFails(updateDoc(doc(as('buyer1'), 'notifications/n1'), { userId: 'buyer2' }));
    await assertSucceeds(updateDoc(doc(as('buyer1'), 'notifications/n1'), { read: true }));
    await assertFails(updateDoc(doc(as('buyer2'), 'notifications/n1'), { read: true }));
  });
});
