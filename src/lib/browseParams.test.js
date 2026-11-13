import { describe, expect, it } from 'vitest';
import { activeChips, emptyFilters, readFilters, toRpc, withChange, writeFilters } from './browseParams';

const read = (qs) => readFilters(new URLSearchParams(qs));
const ID = 'a1000000-0000-4000-8000-000000000001';

describe('browseParams', () => {
  it('the empty address is the default filters, and defaults are not written', () => {
    expect(read('')).toEqual(emptyFilters);
    expect(writeFilters(emptyFilters).toString()).toBe('');
  });

  it('round trips every key', () => {
    const f = { q: 'riso', group: '', categories: ['Paintings', 'Keychains'], kinds: ['print', 'original'], min: 2000, max: 10000, artist: ID, hideSold: true, sort: 'price_asc', page: 2 };
    expect(read(writeFilters(f).toString())).toEqual(f);
  });

  it('a whole group is written as group= and read back as its categories', () => {
    const f = read('group=Art');
    expect(f.categories).toEqual(['Paintings', 'Drawings', 'Digital Art', 'Photography', 'Art Prints']);
    expect(writeFilters(f).toString()).toBe('group=Art');
  });

  it('reads the old category key, drops unknown values and swaps reversed prices', () => {
    const f = read('category=Paintings&cat=Nope&kind=print,weird&min=10000&max=2000&sort=bogus&artist=nope&page=-4');
    expect(f).toMatchObject({ categories: ['Paintings'], kinds: ['print'], min: 2000, max: 10000, sort: 'new', artist: '', page: 0 });
  });

  it('page counts from 1 in the address and from 0 in the filters', () => {
    expect(read('page=3').page).toBe(2);
    expect(writeFilters({ ...emptyFilters, page: 2 }).get('page')).toBe('3');
  });

  it('a change goes back to page 1', () => {
    expect(withChange({ ...emptyFilters, page: 4 }, { hideSold: true }).page).toBe(0);
  });

  it('turns rupees into paise for the database and empty lists into null', () => {
    expect(toRpc({ ...emptyFilters, min: 2000, max: 10000 })).toMatchObject({ minPaise: 200000, maxPaise: 1000000, categories: null, kinds: null, artist: null });
  });

  it('one chip per active filter; a whole group is one chip; removing a chip removes only it', () => {
    const f = { ...emptyFilters, categories: ['Paintings', 'Drawings', 'Digital Art', 'Photography', 'Art Prints', 'Keychains'], kinds: ['print'], q: 'riso', artist: ID, min: 2000, max: 10000, hideSold: true, page: 3 };
    const chips = activeChips(f, 'Tanvi Rao');
    expect(chips.map((c) => c.label)).toEqual(['Art', 'Keychains', 'Prints', '₹2,000 to ₹10,000', '“riso”', 'Tanvi Rao', 'Hide Sold Originals']);
    const art = chips[0].without;
    expect(art.categories).toEqual(['Keychains']);
    expect(art.page).toBe(0);
    expect(chips.find((c) => c.key === 'price').without).toMatchObject({ min: '', max: '', kinds: ['print'] });
  });
});
