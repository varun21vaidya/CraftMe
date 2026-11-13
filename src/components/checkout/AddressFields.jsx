import { Field } from '../ui/Field';
import { STATES } from '../../lib/address';

const AUTO = { name: 'name', phone: 'tel-national', address: 'address-line1', address2: 'address-line2', pin: 'postal-code', city: 'address-level2', state: 'address-level1' };

/** The shipping address form. values/errors keyed by field; readOnly once a hold exists. Field ids are `ship-<name>`. */
export function AddressFields({ values, errors, onChange, readOnly }) {
  const input = (name, extra = {}) => (
    <input className="input" name={name} autoComplete={AUTO[name]} value={values[name]} readOnly={readOnly}
      onChange={(e) => onChange(name, e.target.value)} {...extra} />
  );
  return (
    <div className="form-grid">
      <Field id="ship-name" label="Full name" required error={errors.name}>{input('name', { maxLength: 100 })}</Field>
      <Field id="ship-phone" label="Phone" required error={errors.phone} hint="The courier may call this number.">
        <div className="input-group"><span className="affix">+91</span>{input('phone', { inputMode: 'numeric', maxLength: 14 })}</div>
      </Field>
      <Field id="ship-address" label="Address line 1" required error={errors.address} className="full">{input('address', { maxLength: 300 })}</Field>
      <Field id="ship-address2" label="Address line 2" optional error={errors.address2} className="full">{input('address2', { maxLength: 300 })}</Field>
      <Field id="ship-landmark" label="Landmark" optional error={errors.landmark}>{input('landmark', { maxLength: 120, placeholder: 'Near the Cafe Coffee Day' })}</Field>
      <Field id="ship-pin" label="PIN code" required error={errors.pin}>{input('pin', { inputMode: 'numeric', maxLength: 6 })}</Field>
      <Field id="ship-city" label="City" required error={errors.city}>{input('city', { maxLength: 80 })}</Field>
      <Field id="ship-state" label="State" required error={errors.state}>
        <select className="select" name="state" autoComplete={AUTO.state} value={values.state} disabled={readOnly} onChange={(e) => onChange('state', e.target.value)}>
          <option value="">Choose your State</option>
          {STATES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </Field>
    </div>
  );
}
