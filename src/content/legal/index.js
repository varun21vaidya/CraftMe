import * as artist from './artist.jsx';
import * as contact from './contact.jsx';
import * as deletion from './deletion.jsx';
import * as privacy from './privacy.jsx';
import * as refunds from './refunds.jsx';
import * as shipping from './shipping.jsx';
import * as terms from './terms.jsx';

export { TERMS_VERSION } from './version.js';

const page = (slug, m) => ({ slug, title: m.title, tab: m.tab, updated: m.updated, draft: m.draft, Body: m.Body });

/** The seven legal pages, in tab order. Each file exports title, tab, updated, draft and Body. */
export const LEGAL_PAGES = [
  page('terms', terms), page('privacy', privacy), page('refunds', refunds), page('shipping', shipping),
  page('contact', contact), page('artist', artist), page('deletion', deletion),
];
