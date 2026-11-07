import { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { call } from '../../api/gateway';
import { errorText } from '../../lib/format';

const schema = Yup.object({
  rating: Yup.number().min(1, 'Pick a rating').max(5).required('Pick a rating'),
  comment: Yup.string().trim().required('Write a few words').max(500, 'Keep it under 500 characters'),
});

/** A Review rates the Artist for one received Order. The backend checks the Order, the window and duplicates. */
export function ReviewForm({ orderId, onDone }) {
  const [thanks, setThanks] = useState(false);
  const f = useFormik({
    initialValues: { rating: 0, comment: '' },
    validationSchema: schema,
    onSubmit: async (v, { setStatus }) => {
      const res = await call('submitReview', { orderId, rating: v.rating, comment: v.comment.trim() });
      if (!res.ok) return setStatus(errorText(res.error));
      setThanks(true);
      onDone?.();
    },
  });

  if (thanks) return <p className="alert info" role="status">Thanks for your review. It will appear once it’s checked.</p>;
  return (
    <form className="stack" onSubmit={f.handleSubmit} noValidate>
      <div className="field">
        <span className="label">Your rating</span>
        <div className="row" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button type="button" key={n} role="radio" aria-checked={f.values.rating === n}
              className={`btn btn-sm ${f.values.rating >= n ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => f.setFieldValue('rating', n)}>{n}★</button>
          ))}
        </div>
        {f.touched.rating && f.errors.rating && <span className="error-msg">{f.errors.rating}</span>}
      </div>
      <div className="field">
        <label htmlFor="comment">Your review</label>
        <textarea id="comment" name="comment" className="input" rows={4} value={f.values.comment}
          onChange={f.handleChange} onBlur={f.handleBlur} />
        {f.touched.comment && f.errors.comment && <span className="error-msg">{f.errors.comment}</span>}
      </div>
      {f.status && <p className="error-msg" role="alert">{f.status}</p>}
      <button className="btn btn-primary" type="submit" disabled={f.isSubmitting}>Submit review</button>
    </form>
  );
}
