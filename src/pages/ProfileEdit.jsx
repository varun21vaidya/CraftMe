import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { saveProfile, useArtist } from '../api/gateway';
import { useAuth } from '../contexts/AuthContext';
import { errorText } from '../lib/format';
import { ReelsManager } from '../components/dashboard/ReelsManager';

const schema = Yup.object({
  displayName: Yup.string().trim().required('Add your name').max(100, 'Keep it under 100 characters'),
  bio: Yup.string().trim().max(500, 'Keep it under 500 characters'),
  instagramHandle: Yup.string().trim().matches(/^@?[A-Za-z0-9._]{0,30}$/, 'Letters, numbers, dots and underscores only, up to 30'),
});

// The server sends the artist back here as ?instagram=connected or ?instagram=error&reason=...
const IG_MESSAGES = {
  connected: 'Instagram connected.',
  expired: 'That took too long. Press Connect Instagram to try again.',
  denied: 'Instagram access was not approved.',
  no_account: 'No Instagram account was shared. Choose a creator or business account in the login window (a personal account can be switched in Instagram settings).',
  already_linked: 'That Instagram account is already connected to another CraftMe artist.',
  failed: 'Something went wrong connecting Instagram. Please try again.',
};

export default function ProfileEdit() {
  const { currentUser } = useAuth();
  const [artist, loading] = useArtist(currentUser.uid);
  const [saved, setSaved] = useState(false);
  const [params, setParams] = useSearchParams();
  const [igMsg] = useState(() => {
    const result = params.get('instagram');
    if (!result) return null;
    return result === 'connected' ? IG_MESSAGES.connected : IG_MESSAGES[params.get('reason')] || IG_MESSAGES.failed;
  });
  useEffect(() => {
    if (params.get('instagram')) setParams({}, { replace: true }); // keep the message, drop the query from the address
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);

  if (loading) return <main className="wrap page"><div className="skeleton" style={{ height: 200 }} aria-busy="true" /></main>;

  const submit = async (v, { setSubmitting, setStatus }) => {
    setStatus(null);
    setSaved(false);
    const res = await saveProfile(currentUser.uid, {
      displayName: v.displayName.trim(), bio: v.bio.trim(), instagramHandle: v.instagramHandle.trim().replace(/^@/, ''),
    });
    setSubmitting(false);
    if (res.ok) setSaved(true); else setStatus(errorText(res.error));
  };

  return (
    <main className="wrap page" style={{ maxWidth: 560 }}>
      <div className="page-head"><div><h1>Your public profile</h1></div></div>
      {igMsg && <p className="alert info" role="status">{igMsg}</p>}
      <Formik
        initialValues={{ displayName: artist?.displayName || '', bio: artist?.bio || '', instagramHandle: artist?.instagramHandle || '' }}
        validationSchema={schema} onSubmit={submit}>
        {({ values, errors, touched, handleChange, handleBlur, isSubmitting, status }) => (
          <Form className="panel stack" noValidate>
            <div className="field"><label htmlFor="displayName">Name</label>
              <input id="displayName" name="displayName" className="input" value={values.displayName} onChange={handleChange} onBlur={handleBlur} />
              {touched.displayName && errors.displayName && <span className="error-msg">{errors.displayName}</span>}</div>
            <div className="field"><label htmlFor="bio">About you</label>
              <textarea id="bio" name="bio" className="input" rows={4} value={values.bio} onChange={handleChange} onBlur={handleBlur} />
              {touched.bio && errors.bio && <span className="error-msg">{errors.bio}</span>}</div>
            <div className="field"><label htmlFor="instagramHandle">Instagram handle <span className="opt">optional</span></label>
              <input id="instagramHandle" name="instagramHandle" className="input" placeholder="yourname" value={values.instagramHandle}
                onChange={handleChange} onBlur={handleBlur} disabled={artist?.instagramVerified} />
              <span className="hint">
                {artist?.instagramVerified
                  ? 'Verified on Instagram. It updates when you reconnect.'
                  : 'Shown on your page as a link. We don’t check that it’s yours until you connect Instagram below.'}
              </span>
              {touched.instagramHandle && errors.instagramHandle && <span className="error-msg">{errors.instagramHandle}</span>}</div>
            {saved && <p className="alert info" role="status">Saved. <Link to={`/artist/${currentUser.uid}`}>View your page</Link></p>}
            {status && <p className="error-msg" role="alert">{status}</p>}
            <button className="btn btn-primary" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save'}</button>
          </Form>
        )}
      </Formik>
      <div style={{ marginTop: 24 }}><ReelsManager /></div>
    </main>
  );
}
