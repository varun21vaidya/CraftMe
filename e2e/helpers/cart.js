import { PEOPLE } from './ids.js';

/** Puts a Cart in the page's localStorage before the app starts. items: [{ listingId, qty, seen? }]. */
export async function setCart(page, key, cart) {
  await page.addInitScript(([k, v]) => {
    if (!sessionStorage.getItem(`qa-cart-set:${k}`)) { // only on the first load, so a reload keeps what the page did
      localStorage.setItem(k, v);
      sessionStorage.setItem(`qa-cart-set:${k}`, '1');
    }
  }, [`cm-cart:${PEOPLE[key].id}`, JSON.stringify(cart)]);
}

/** The Cart the page has stored. */
export const readCart = (page, key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), `cm-cart:${PEOPLE[key].id}`);
