// The checkout address: the States list and the client's copy of the server's rules (supabase/functions/api/index.ts ADDR).

export const STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

/** The form's fields in page order, with the label the error summary links to. */
export const ADDRESS_FIELDS = [
  ['name', 'Full name'], ['phone', 'Phone'], ['address', 'Address line 1'], ['address2', 'Address line 2'],
  ['landmark', 'Landmark'], ['pin', 'PIN code'], ['city', 'City'], ['state', 'State'],
];
export const LABEL = Object.fromEntries([...ADDRESS_FIELDS, ['consent', 'Terms and Refund policy']]);

export const emptyAddress = { name: '', phone: '', address: '', address2: '', landmark: '', pin: '', city: '', state: '' };

/** Spaces and dashes are how people type a number; the server stores ten digits. */
export const cleanPhone = (v) => String(v || '').replace(/[\s-]/g, '').replace(/^(\+91|0)(?=\d{10}$)/, '');

/** The trimmed values the server receives. */
export const cleanAddress = (v) => ({
  name: v.name.trim(), phone: cleanPhone(v.phone), address: v.address.trim(), address2: v.address2.trim(),
  landmark: v.landmark.trim(), pin: v.pin.trim(), city: v.city.trim(), state: v.state,
});

/** {field: message} for every problem, in page order; empty when the address can be sent. */
export function validateAddress(values, { consent = true } = {}) {
  const v = cleanAddress(values);
  const errors = {};
  if (!v.name) errors.name = 'Enter your full name.';
  else if (v.name.length > 100) errors.name = 'Use 100 characters or fewer.';
  if (!/^[6-9]\d{9}$/.test(v.phone)) errors.phone = 'Enter a 10-digit mobile number.';
  if (!v.address) errors.address = 'Enter the first line of your address.';
  else if (v.address.length > 300) errors.address = 'Use 300 characters or fewer.';
  if (v.address2.length > 300) errors.address2 = 'Use 300 characters or fewer.';
  if (v.landmark.length > 120) errors.landmark = 'Use 120 characters or fewer.';
  if (!/^\d{6}$/.test(v.pin)) errors.pin = 'PIN codes have 6 digits.';
  if (!v.city) errors.city = 'Enter your city.';
  else if (v.city.length > 80) errors.city = 'Use 80 characters or fewer.';
  if (!STATES.includes(v.state)) errors.state = 'Choose your State.';
  if (!consent) errors.consent = 'You need to agree to continue.';
  return errors;
}

/** The message for a field the server refused (invalid with fields). */
export const serverFieldError = (field) => validateAddress({ ...emptyAddress })[field] || 'Check this field.';
