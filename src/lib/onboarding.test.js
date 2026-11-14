import { describe, expect, it } from 'vitest';
import { cleanIfsc, cleanPan, detailsFrom, emptyDetails, nextStep, toPayload, validateDetails, validPhone } from './onboarding';

const done = { legalName: 'A', submittedAt: 1, phoneVerified: true, feePaidAt: 2 };
const good = { ...emptyDetails, legalName: 'Ananya Verma', pan: 'abcde1234f', city: 'Mumbai', state: 'Maharashtra', upi: 'ananya@okhdfc', bio: 'Small paintings.', specialties: ['Art'], ownWork: true, agreement: true };

describe('nextStep (QA-S18-08)', () => {
  it('follows the server state at every point', () => {
    expect(nextStep({ isArtist: false, onboarding: null })).toBe('step1');
    expect(nextStep({ isArtist: false, onboarding: { legalName: 'A' } })).toBe('step1'); // an older row without the shop fields
    expect(nextStep({ isArtist: false, onboarding: { ...done, phoneVerified: false, feePaidAt: null } })).toBe('step2');
    expect(nextStep({ isArtist: false, onboarding: { ...done, feePaidAt: null } })).toBe('step3');
    expect(nextStep({ isArtist: false, onboarding: done })).toBe('finish');
    expect(nextStep({ isArtist: true, onboarding: null })).toBe('done');
    expect(nextStep({ isArtist: true, onboarding: done })).toBe('done');
  });
  it('does not skip the phone step for a paid fee with no verified phone', () => {
    expect(nextStep({ isArtist: false, onboarding: { ...done, phoneVerified: false } })).toBe('step2');
  });
});

describe('validateDetails', () => {
  it('passes a good UPI form and a good bank form', () => {
    expect(validateDetails(good)).toEqual({});
    expect(validateDetails({ ...good, method: 'bank', holder: 'Ananya Verma', ifsc: 'hdfc0001234', account: '123456789012', confirmAccount: '123456789012' })).toEqual({});
  });
  it('names every required field on an empty form, and only the chosen payout method', () => {
    const e = validateDetails(emptyDetails);
    expect(Object.keys(e)).toEqual(['legalName', 'pan', 'city', 'state', 'upi', 'bio', 'specialties', 'ownWork', 'agreement']);
    expect(Object.keys(validateDetails({ ...emptyDetails, method: 'bank' }))).toEqual(
      ['legalName', 'pan', 'city', 'state', 'holder', 'ifsc', 'account', 'confirmAccount', 'bio', 'specialties', 'ownWork', 'agreement']);
  });
  it('checks the bank account rules in order (QA-S18-02)', () => {
    const bank = { ...good, method: 'bank', holder: 'Ananya Verma', ifsc: 'hdfc0001234' };
    expect(validateDetails({ ...bank, account: '1234567', confirmAccount: '12345678' }).account).toBe('Account numbers have 9 to 18 digits.');
    expect(validateDetails({ ...bank, account: '123456789', confirmAccount: '12345678' }).confirmAccount).toBe('The two account numbers don’t match.');
    expect(validateDetails({ ...bank, ifsc: 'HDFC1001234' }).ifsc).toMatch(/IFSC/);
  });
  it('limits the bio, the name and the specialties to the five groups', () => {
    expect(validateDetails({ ...good, bio: 'x'.repeat(301) }).bio).toMatch(/300/);
    expect(validateDetails({ ...good, specialties: ['Cars'] }).specialties).toBeTruthy();
    expect(validateDetails({ ...good, state: 'Atlantis' }).state).toBeTruthy();
    expect(validateDetails({ ...good, legalName: 'x'.repeat(101) }).legalName).toBeTruthy();
  });
});

describe('payload and prefill', () => {
  it('upper-cases the PAN and IFSC and sends only the chosen method', () => {
    expect(cleanPan(' abcde1234f ')).toBe('ABCDE1234F');
    expect(cleanIfsc('hdfc0001234')).toBe('HDFC0001234');
    const p = toPayload(good);
    expect(p.pan).toBe('ABCDE1234F');
    expect(p.payoutMethod).toEqual({ type: 'upi', upi: 'ananya@okhdfc' });
    expect(toPayload({ ...good, method: 'bank', holder: 'A V', ifsc: 'hdfc0001234', account: '1234 5678 9012', confirmAccount: '123456789012' }).payoutMethod)
      .toEqual({ type: 'bank', account: '123456789012', ifsc: 'HDFC0001234', holder: 'A V' });
  });
  it('prefills from what is saved', () => {
    const v = detailsFrom({ city: 'Pune', state: 'Maharashtra', bio: 'Hi' }, { legalName: 'A B', pan: 'ABCDE1234F', payoutType: 'bank', payoutMethod: { type: 'bank', account: '123456789', ifsc: 'HDFC0001234', holder: 'A B' }, specialties: ['Art'], agreedOwnWorkAt: 5 });
    expect(v).toMatchObject({ legalName: 'A B', method: 'bank', holder: 'A B', confirmAccount: '123456789', city: 'Pune', specialties: ['Art'], ownWork: true });
    expect(detailsFrom(null, null)).toEqual(emptyDetails);
  });
  it('accepts a ten-digit mobile number only', () => {
    expect(validPhone('9000000001')).toBe(true);
    for (const bad of ['', '123', '5000000001', '90000000011']) expect(validPhone(bad)).toBe(false);
  });
});
