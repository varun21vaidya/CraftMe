import { useEffect, useMemo, useState } from 'react';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { saveDraft, upload, useReels } from '../../api/gateway';
import { useAuth } from '../../contexts/AuthContext';
import { CATEGORIES } from '../../lib/categories';
import { errorText } from '../../lib/format';

const MAX_PHOTOS = 5;
const photoOk = (f) => ['image/jpeg', 'image/png'].includes(f.type) && f.size <= 5 * 1024 * 1024; // Storage rules enforce it too

const schema = Yup.object({
  title: Yup.string().trim().required('Add a title').max(100, 'Keep the title under 100 characters'),
  description: Yup.string().trim().required('Add a description').max(1000, 'Keep it under 1000 characters'),
  category: Yup.string().required('Pick a category'),
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
  const [done, setDone] = useState(false);
  const [reels] = useReels(currentUser.uid, { mine: true });

  const submit = async (values, { setSubmitting, setStatus, resetForm }) => {
    setStatus(null);
    const uploads = await Promise.all(values.photos.map((f) => upload('artworks', f, currentUser.uid)));
    const failed = uploads.find((u) => !u.ok);
    if (failed) { setStatus(errorText(failed.error)); setSubmitting(false); return; }
    const saved = await saveDraft('artworks', null, {
      title: values.title.trim(), description: values.description.trim(), category: values.category,
      photos: uploads.map((u) => u.url), reelId: values.reelId || null,
    }, currentUser.uid);
    setSubmitting(false);
    if (!saved.ok) { setStatus(errorText(saved.error)); return; }
    resetForm();
    setDone(true);
    onSaved?.(saved.id);
  };

  return (
    <Formik initialValues={{ title: '', description: '', category: '', photos: [], reelId: '' }} validationSchema={schema} onSubmit={submit}>
      {({ values, errors, touched, handleChange, handleBlur, setFieldValue, isSubmitting, status }) => (
        <Form className="stack" noValidate>
          {done && <p className="alert info" role="status">Saved as a draft. Add a Listing to put it on sale.</p>}
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
            <label htmlFor="reelId">Reel <span className="opt">optional, shown on this product</span></label>
            <select id="reelId" name="reelId" className="select" value={values.reelId} onChange={handleChange} onBlur={handleBlur}>
              <option value="">No reel</option>
              {(reels || []).map((r) => <option key={r.id} value={r.id}>{r.url.replace(/^https?:\/\/(www\.)?instagram\.com\//, '')}</option>)}
            </select>
            {reels?.length === 0 && <span className="hint">Add reels on your profile page first.</span>}
          </div>
          <div className="field">
            <label htmlFor="photos">Photos <span className="opt">up to {MAX_PHOTOS}, first is the cover</span></label>
            <input id="photos" type="file" multiple accept="image/jpeg,image/png"
              onChange={(e) => setFieldValue('photos', [...e.currentTarget.files].slice(0, MAX_PHOTOS))} />
            <Previews files={values.photos} />
            {errors.photos && <span className="error-msg">{errors.photos}</span>}
          </div>
          {status && <p className="error-msg" role="alert">{status}</p>}
          <button className="btn btn-primary" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save draft'}</button>
        </Form>
      )}
    </Formik>
  );
}
