// Become an Artist: which step the server state allows, and the details form's rules (the database checks the same again).
import { GROUPS } from './categories';
import { STATES } from './address';

/** 'step1' details, 'step2' phone, 'step3' fee, 'finish' (paid, role not yet granted), 'done'. The step shown always follows the server. */
export const nextStep = ({ isArtist, onboarding }) => {
  if (isArtist) return 'done';
  if (!onboarding?.submittedAt) return 'step1'; // only the onboarding form sets submittedAt: older rows lack the shop fields
  if (!onboarding.phoneVerified) return 'step2';
  if (!onboarding.feePaidAt) return 'step3';
  return 'finish';
};

export const emptyDetails = {
  legalName: '', pan: '', city: '', state: '', method: 'upi', upi: '', holder: '', ifsc: '', account: '', confirmAccount: '',
  bio: '', specialties: [], ownWork: false, agreement: false,
};

/** The summary and the inline errors name fields in page order. */
export const FIELDS = [
  ['legalName', 'Legal name'], ['pan', 'PAN'], ['city', 'City'], ['state', 'State'], ['upi', 'UPI ID'], ['holder', 'Account holder name'],
  ['ifsc', 'IFSC'], ['account', 'Account number'], ['confirmAccount', 'Confirm account number'], ['bio', 'Short bio'],
  ['specialties', 'What do you make?'], ['ownWork', 'Own work'], ['agreement', 'Artist agreement'],
];

export const BIO_MAX = 300;
export const cleanPan = (v) => String(v || '').toUpperCase().replace(/\s/g, '').slice(0, 10);
export const cleanIfsc = (v) => String(v || '').toUpperCase().replace(/\s/g, '').slice(0, 11);
export const digits = (v) => String(v || '').replace(/\D/g, '');
/** Ten digits starting 6 to 9, as the checkout asks for. */
export const validPhone = (v) => /^[6-9]\d{9}$/.test(String(v || ''));

/** {field: message} for every problem, empty when the form can be sent. Only the chosen payout method is checked. */
export function validateDetails(v) {
  const e = {};
  const name = v.legalName.trim();
  if (!name) e.legalName = 'Enter your legal name.'; else if (name.length > 100) e.legalName = 'Use 100 characters or fewer.';
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(cleanPan(v.pan))) e.pan = 'PAN has 10 characters, like ABCDE1234F.';
  if (!v.city.trim()) e.city = 'Enter your city.'; else if (v.city.trim().length > 80) e.city = 'Use 80 characters or fewer.';
  if (!STATES.includes(v.state)) e.state = 'Choose your State.';
  if (v.method === 'upi') {
    if (!/^[A-Za-z0-9_.-]{2,}@[A-Za-z0-9_]{2,}$/.test(v.upi.trim())) e.upi = 'Enter a UPI ID like name@bank.';
  } else {
    if (!v.holder.trim()) e.holder = 'Enter the account holder name.'; else if (v.holder.trim().length > 100) e.holder = 'Use 100 characters or fewer.';
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc(v.ifsc))) e.ifsc = 'IFSC has 11 characters, like HDFC0001234.';
    if (!/^[0-9]{9,18}$/.test(digits(v.account))) e.account = 'Account numbers have 9 to 18 digits.';
    if (!digits(v.confirmAccount)) e.confirmAccount = 'Confirm the account number.';
    else if (digits(v.confirmAccount) !== digits(v.account)) e.confirmAccount = 'The two account numbers don’t match.';
  }
  if (!v.bio.trim()) e.bio = 'Write a short bio.'; else if (v.bio.trim().length > BIO_MAX) e.bio = `Use ${BIO_MAX} characters or fewer.`;
  if (!v.specialties.some((g) => g in GROUPS)) e.specialties = 'Choose at least one.';
  if (!v.ownWork) e.ownWork = 'Tick the box to continue.';
  if (!v.agreement) e.agreement = 'Tick the box to continue.';
  return e;
}

/** The input of the submitVerification command. */
export const toPayload = (v) => ({
  legalName: v.legalName.trim(),
  pan: cleanPan(v.pan),
  payoutMethod: v.method === 'upi'
    ? { type: 'upi', upi: v.upi.trim() }
    : { type: 'bank', account: digits(v.account), ifsc: cleanIfsc(v.ifsc), holder: v.holder.trim() },
  profile: { city: v.city.trim(), state: v.state, bio: v.bio.trim(), specialties: v.specialties, ownWork: v.ownWork, agreement: v.agreement },
});

/** The form's starting values from what is saved (the profile and the onboarding row), for a person who comes back to edit. */
export const detailsFrom = (profile, onboarding) => ({
  ...emptyDetails,
  legalName: onboarding?.legalName || '',
  pan: onboarding?.pan || '',
  city: profile?.city || '',
  state: STATES.includes(profile?.state) ? profile.state : '',
  method: onboarding?.payoutType === 'bank' ? 'bank' : 'upi',
  upi: onboarding?.payoutMethod?.upi || '',
  holder: onboarding?.payoutMethod?.holder || '',
  ifsc: onboarding?.payoutMethod?.ifsc || '',
  account: onboarding?.payoutMethod?.account || '',
  confirmAccount: onboarding?.payoutMethod?.account || '',
  bio: profile?.bio || '',
  specialties: onboarding?.specialties || [],
  ownWork: Boolean(onboarding?.agreedOwnWorkAt),
  agreement: Boolean(onboarding?.agreedOwnWorkAt),
});
