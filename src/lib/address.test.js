import { describe, expect, it } from 'vitest';
import { cleanPhone, emptyAddress, validateAddress } from './address';

const good = { name: 'Rahul Nair', phone: '9876543210', address: '12 MG Road', address2: '', landmark: '', pin: '411001', city: 'Pune', state: 'Maharashtra' };

describe('address', () => {
  it('accepts a complete address', () => expect(validateAddress(good)).toEqual({}));

  it('lists six problems for the empty form (consent ticked)', () => {
    expect(Object.keys(validateAddress(emptyAddress))).toEqual(['name', 'phone', 'address', 'pin', 'city', 'state']);
  });

  it('gives the QA-S09-02 step 2 messages', () => {
    const errors = validateAddress({ ...good, phone: '98765 4321', pin: '40005', state: '' }, { consent: false });
    expect(errors).toEqual({
      phone: 'Enter a 10-digit mobile number.', pin: 'PIN codes have 6 digits.', state: 'Choose your State.', consent: 'You need to agree to continue.',
    });
  });

  it('reads a phone typed with spaces, dashes, +91 or a leading 0', () => {
    expect(cleanPhone('98765 43210')).toBe('9876543210');
    expect(cleanPhone('+91 98765-43210')).toBe('9876543210');
    expect(cleanPhone('09876543210')).toBe('9876543210');
    expect(validateAddress({ ...good, phone: '5876543210' }).phone).toBeTruthy(); // Indian mobiles start 6 to 9
  });

  it('never refuses a PIN for not being served (PD04)', () => {
    expect(validateAddress({ ...good, pin: '999999' })).toEqual({});
  });

  it('enforces the server lengths', () => {
    expect(validateAddress({ ...good, address2: 'x'.repeat(301), landmark: 'x'.repeat(121) })).toEqual({
      address2: 'Use 300 characters or fewer.', landmark: 'Use 120 characters or fewer.',
    });
  });
});
