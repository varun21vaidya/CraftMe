import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RULES } from '../../lib/rules';
import * as refunds from './refunds.jsx';
import * as shipping from './shipping.jsx';

const text = (el) => renderToStaticMarkup(el).replace(/<[^>]+>/g, '');

describe('legal numbers come from RULES (QA-S19-02)', () => {
  it('the refund page shows every policy number', () => {
    const t = text(<refunds.Body />);
    expect(refunds.title).toBe('Cancellation and Refunds');
    for (const n of [`${RULES.holdMinutes} minutes`, `${RULES.shipDays} days`, `${RULES.autoReceiveDays} days`, `${RULES.damageDays} days`, `${RULES.reviewDays} days`, `${RULES.owedRestrictDays} days`, '1st and 15th']) {
      expect(t, n).toContain(n);
    }
  });
  it('the numbers change when RULES change', () => {
    const t = text(<refunds.Body rules={{ ...RULES, holdMinutes: 21, shipDays: 9, autoReceiveDays: 17, damageDays: 4, reviewDays: 31, owedRestrictDays: 61, payoutDays: [2, 16] }} />);
    for (const n of ['21 minutes', '9 days', '17 days', '4 days', '31 days', '61 days', '2nd and 16th']) expect(t, n).toContain(n);
    expect(text(<shipping.Body rules={{ ...RULES, shipDays: 9, autoReceiveDays: 17 }} />)).toMatch(/9 days.*17 days/);
  });
  it('an overdue Order is reviewed and usually refunded, never promised an automatic refund (D05)', () => {
    const t = text(<refunds.Body />);
    expect(t).toContain('reviewed by CraftMe and usually refunded in full');
    expect(t).not.toMatch(/automatic(ally)? refund/i);
  });
});

describe('scripts/check-legal.mjs (QA-S19-05)', () => {
  const run = (files) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legal-'));
    for (const [name, draft] of Object.entries(files)) fs.writeFileSync(path.join(dir, `${name}.jsx`), `export const draft = ${draft};\n`);
    return spawnSync(process.execPath, ['scripts/check-legal.mjs', dir], { encoding: 'utf8' });
  };
  it('fails and names the page while one is a draft', () => {
    const r = run({ terms: false, privacy: true });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('privacy');
    expect(r.stderr).not.toContain('terms');
  });
  it('passes when none is', () => expect(run({ terms: false, privacy: false }).status).toBe(0));
  it('treats a missing draft line as a draft', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legal-'));
    fs.writeFileSync(path.join(dir, 'terms.jsx'), 'export const title = "x";\n');
    expect(spawnSync(process.execPath, ['scripts/check-legal.mjs', dir], { encoding: 'utf8' }).status).toBe(1);
  });
});
