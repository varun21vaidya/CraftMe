import { useEffect, useMemo } from 'react';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { publishWork, upload, useReels } from '../../api/gateway';
import { useAuth } from '../../contexts/AuthContext';
import { CATEGORIES } from '../../lib/categories';
import { reelLabel } from '../../lib/reels';
import { errorText } from '../../lib/format';

const MAX_PHOTOS = 5;
const photoOk = (f) => ['image/jpeg', 'image/png'].includes(f.type) && f.size <= 5 * 1024 * 1024; // Storage rules enforce it too

// A number field: an empty box counts as "not filled in", not as a type error.
const whole = () => Yup.number().typeError('Enter a number').transform((v, orig) => (orig === '' ? undefined : v));

// What is being sold. An original is one of a kind (stock 1); the other two are stocked.
const KINDS = [
  { value: 'original', label: 'One-of-a-kind original' },
  { value: 'print', label: 'Print (many copies)' },
  { value: 'product', label: 'Ready-made item in stock' },
];

export const schema = Yup.object({
  title: Yup.string().trim().required('Add a title').max(100, 'Keep the title under 100 characters'),
  description: Yup.string().trim().required('Add a description').max(1000, 'Keep it under 1000 characters'),
  category: Yup.string().required('Pick a category'),
  kind: Yup.string().oneOf(KINDS.map((k) => k.value), 'Choose what you are selling'),
  price: whole().required('Enter the price in rupees').integer('Whole rupees only').min(1, 'The price must be at least 1 rupee'),
  stock: whole().when('kind', {
    is: (k) => k !== 'original', // an original is always 1, and the box is hidden
    then: (s) => s.required('Enter how many you have').integer('Whole numbers only').min(1, 'At least 1').max(1000, 'Up to 1000'),
    otherwise: (s) => s.notRequired(),
  }),
  size: Yup.string().trim().max(60, 'Keep it under 60 characters'),
  medium: Yup.string().trim().max(60, 'Keep it under 60 characters'),
  photos: Yup.array().min(1, 'Add at least one photo').max(MAX_PHOTOS, `Up to ${MAX_PHOTOS} photos`)
    .test('ok', 'Photos must be JPEG or PNG, up to 5 MB each', (fs) => (fs || []).every(photoOk)),
});

/** Preview thumbnails: each object URL is made once per file and released when the file leaves or the form closes. */
function Previews({ files }) {
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach(URL.revokeObjectURL), [urls]);
  return (
    <div className="gallery-thumbs">
      {urls.map((u, i) => <img key={u} src={u} alt={`Photo ${i + 1} preview`} width="72" height="72" style={{ objectFit: 'cover' }} />)}
    </div>
  );
}

export function ArtworkUploadForm({ onSaved }) {
  const { currentUser } = useAuth();
  const [reels] = useReels(currentUser.uid, { mine: true });

  const submit = async (values, { setSubmitting, setStatus }) => {
    setStatus(null);
    const uploads = await Promise.all(values.photos.map((f) => upload('artworks', f, currentUser.uid)));
    const failed = uploads.find((u) => !u.ok);
    if (failed) { setStatus(errorText(failed.error)); setSubmitting(false); return; }
    const saved = await publishWork(currentUser.uid, {
      title: values.title.trim(), description: values.description.trim(), category: values.category,
      photos: uploads.map((u) => u.url), reelId: values.reelId || null,
    }, {
      kind: values.kind, size: values.size.trim(), medium: values.medium.trim(),
      price: Number(values.price) * 100, // rupees to paise
      stock: values.kind === 'original' ? 1 : Number(values.stock),
    });
    setSubmitting(false);
    if (!saved.ok) {
      setStatus(saved.artworkId
        ? 'The artwork was saved as a draft but could not be put on sale (' + errorText(saved.error) + '). Please tell us, so we can finish it.'
        : errorText(saved.error));
      return;
    }
    onSaved?.(saved.id);
  };

  return (
    <Formik initialValues={{ title: '', description: '', category: '', photos: [], reelId: '', kind: '', size: '', medium: '', price: '', stock: '1' }} validationSchema={schema} onSubmit={submit}>
      {({ values, errors, touched, handleChange, handleBlur, setFieldValue, isSubmitting, status }) => (
        <Form className="stack" noValidate>
          {[['title', 'Title', 'input'], ['description', 'Description', 'textarea']].map(([name, label, tag]) => (
            <div className="field" key={name}>
              <label htmlFor={name}>{label}</label>
              {tag === 'input'
                ? <input id={name} name={name} className="input" value={values[name]} onChange={handleChange} onBlur={handleBlur} />
                : <textarea id={name} name={name} className="input" rows={4} value={values[name]} onChange={handleChange} onBlur={handleBlur} />}
              {touched[name] && errors[name] && <span className="error-msg">{errors[name]}</span>}
            </div>
          ))}
          <div className="field">
            <label htmlFor="category">Category</label>
            <select id="category" name="category" className="select" value={values.category} onChange={handleChange} onBlur={handleBlur}>
              <option value="">Choose…</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            {touched.category && errors.category && <span className="error-msg">{errors.category}</span>}
          </div>
          <div className="field">
            <label htmlFor="kind">What are you selling?</label>
            <select id="kind" name="kind" className="select" value={values.kind} onChange={handleChange} onBlur={handleBlur}>
              <option value="">Choose…</option>
              {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
            {touched.kind && errors.kind && <span className="error-msg">{errors.kind}</span>}
          </div>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: '1 1 140px' }}>
              <label htmlFor="price">Price (₹)</label>
              <input id="price" name="price" className="input" type="number" inputMode="numeric" min="1" step="1" placeholder="e.g. 1200"
                value={values.price} onChange={handleChange} onBlur={handleBlur} />
              {touched.price && errors.price && <span className="error-msg">{errors.price}</span>}
              <span className="hint">Shipping within India is included.</span>
            </div>
            {values.kind && values.kind !== 'original' && (
              <div className="field" style={{ flex: '1 1 140px' }}>
                <label htmlFor="stock">How many do you have?</label>
                <input id="stock" name="stock" className="input" type="number" inputMode="numeric" min="1" max="1000" step="1"
                  value={values.stock} onChange={handleChange} onBlur={handleBlur} />
                {touched.stock && errors.stock && <span className="error-msg">{errors.stock}</span>}
              </div>
            )}
          </div>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: '1 1 140px' }}>
              <label htmlFor="size">Size <span className="opt">optional</span></label>
              <input id="size" name="size" className="input" placeholder="e.g. 12 x 18 in" value={values.size} onChange={handleChange} onBlur={handleBlur} />
              {touched.size && errors.size && <span className="error-msg">{errors.size}</span>}
            </div>
            <div className="field" style={{ flex: '1 1 140px' }}>
              <label htmlFor="medium">Made of <span className="opt">optional</span></label>
              <input id="medium" name="medium" className="input" placeholder="e.g. Acrylic on canvas" value={values.medium} onChange={handleChange} onBlur={handleBlur} />
              {touched.medium && errors.medium && <span className="error-msg">{errors.medium}</span>}
            </div>
          </div>
          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend>Reel <span className="opt">optional, shown on this product</span></legend>
            <div className="stack sm" role="radiogroup" aria-label="Reel for this product">
              {[{ id: '' }, ...(reels || [])].map((r) => (
                <label key={r.id || 'none'} className="row" style={{
                  gap: 12, alignItems: 'center', padding: 8, borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${values.reelId === r.id ? 'var(--accent)' : 'var(--line-2, #ddd)'}`,
                }}>
                  <input type="radio" name="reelId" value={r.id} checked={values.reelId === r.id} onChange={() => setFieldValue('reelId', r.id)} />
                  {r.id && (r.cover
                    ? <img src={r.cover} alt="" width="48" height="64" loading="lazy" style={{ objectFit: 'cover', borderRadius: 6 }} />
                    : <span className="skeleton" style={{ width: 48, height: 64, borderRadius: 6, display: 'inline-block' }} aria-hidden="true" />)}
                  <span style={{ minWidth: 0 }}>
                    {r.id ? reelLabel(r) : 'No reel'}
                    {r.verified && <span className="small faint"> · from Instagram</span>}
                  </span>
                </label>
              ))}
            </div>
            {reels?.length === 0 && <span className="hint">Add reels on your profile page first.</span>}
          </fieldset>
          <div className="field">
            <label htmlFor="photos">Photos <span className="opt">up to {MAX_PHOTOS}, first is the cover</span></label>
            <input id="photos" type="file" multiple accept="image/jpeg,image/png"
              onChange={(e) => setFieldValue('photos', [...e.currentTarget.files].slice(0, MAX_PHOTOS))} />
            <Previews files={values.photos} />
            {errors.photos && <span className="error-msg">{errors.photos}</span>}
          </div>
          {status && <p className="error-msg" role="alert">{status}</p>}
          <button className="btn btn-primary" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Publishing…' : 'Publish'}</button>
        </Form>
      )}
    </Formik>
  );
}
