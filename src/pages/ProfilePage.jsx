import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { removeUploads, saveProfile, upload, useSwitches } from '../api/gateway';
import { DeleteAccountDialog } from '../components/account/DeleteAccountDialog';
import { SavedAddressPanel } from '../components/account/SavedAddressPanel';
import { Icon } from '../components/common/Icon';
import { Field } from '../components/ui/Field';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { initials } from '../lib/artist';
import { errorText } from '../lib/format';

const PHOTO_TYPES = ['image/jpeg', 'image/png'];
const PHOTO_MAX = 5 * 1024 * 1024;
const BIO_MAX = 200;

/** Storage path (as upload() wrote it) of one of our own avatar URLs, or null for anything else (a Google photo). */
const avatarPath = (url) => {
  const i = (url || '').indexOf('/object/public/avatars/');
  return i < 0 ? null : `avatars/${url.slice(i + '/object/public/avatars/'.length)}`;
};

function AboutYou({ profile }) {
  const { currentUser, reloadProfile } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(profile.displayName || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  const saved = profile.photoUrl || '';

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const choose = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!PHOTO_TYPES.includes(f.type) || f.size > PHOTO_MAX) { setPhotoError('Use a JPEG or PNG up to 5 MB.'); return; }
    setPhotoError('');
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const dropOld = (url) => { const p = avatarPath(url); if (p) removeUploads('avatars', [p]); }; // best effort

  const remove = async () => {
    setPhotoError('');
    if (file) { setFile(null); setPreview(''); return; }
    setBusy(true);
    const res = await saveProfile(currentUser.uid, { photoUrl: '' });
    setBusy(false);
    if (!res.ok) { setFailure(errorText(res.error)); return; }
    dropOld(saved);
    reloadProfile();
  };

  const submit = async (e) => {
    e.preventDefault();
    const found = {};
    if (!name.trim()) found.name = 'Add your name.';
    else if (name.trim().length > 100) found.name = 'Use 100 characters or fewer.';
    if (bio.length > BIO_MAX) found.bio = `Use ${BIO_MAX} characters or fewer.`;
    setErrors(found);
    setFailure('');
    if (found.name || found.bio) { document.getElementById(found.name ? 'profile-name' : 'profile-bio')?.focus(); return; }
    setBusy(true);
    let up = null;
    if (file) {
      up = await upload('avatars', file, currentUser.uid); // first, so one save carries the new photo
      if (!up.ok) { setBusy(false); setFailure(errorText(up.error)); return; }
    }
    const res = await saveProfile(currentUser.uid, { displayName: name.trim(), bio: bio.trim(), ...(up ? { photoUrl: up.url } : {}) });
    setBusy(false);
    if (!res.ok) {
      if (up) removeUploads('avatars', [up.path]); // the profile did not take the file: leave nothing behind
      setFailure(errorText(res.error));
      return;
    }
    if (up) { dropOld(saved); setFile(null); setPreview(''); }
    toast('Profile saved');
    reloadProfile();
  };

  const shown = preview || saved;
  return (
    <form className="panel stack" onSubmit={submit} noValidate aria-labelledby="about-h">
      <h2 id="about-h">About you</h2>
      <div className="photo-row">
        {shown ? <img className="avatar xl" src={shown} alt="Your photo" style={{ objectFit: 'cover' }} /> : <span className="avatar xl" aria-hidden="true">{initials(name || currentUser.email)}</span>}
        <div className="stack sm">
          <div className="row">
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => input.current?.click()}>Change photo</button>
            {shown && <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={remove}>Remove</button>}
          </div>
          <input ref={input} type="file" accept="image/jpeg,image/png" className="sr" tabIndex={-1} aria-label="Choose a photo" onChange={choose} />
          {photoError ? <span className="error-msg" role="alert">{photoError}</span> : <span className="hint">JPEG or PNG, up to 5 MB.</span>}
        </div>
      </div>
      <Field id="profile-name" label="Name" required error={errors.name}>
        <input className="input" value={name} maxLength={120} autoComplete="name" onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field id="profile-email" label="Email" hint="Signed in with Google. Email can’t be changed here.">
        <input className="input" value={currentUser.email || ''} readOnly />
      </Field>
      <Field id="profile-bio" label="Short bio" optional error={errors.bio} hint="Shown next to your Reviews." counter={{ value: bio, max: BIO_MAX }}>
        <textarea className="textarea" rows={3} maxLength={BIO_MAX} value={bio} onChange={(e) => setBio(e.target.value)} />
      </Field>
      {failure && <p className="error-msg" role="alert">{failure}</p>}
      <div><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div>
    </form>
  );
}

export default function ProfilePage() {
  const { currentUser, isArtist, profile, profileLoading, reloadProfile } = useAuth();
  const [switches] = useSwitches();
  const [deleting, setDeleting] = useState(false);

  return (
    <main className="wrap mid page">
      <div className="page-head"><div><h1>Your profile</h1><p>How you appear on CraftMe, and the details we keep for you.</p></div></div>
      <div className="profile-grid">
        <div className="stack lg">
          {profileLoading && !profile && <div className="skeleton" style={{ height: 320 }} aria-busy="true" />}
          {!profile && !profileLoading && (
            <div className="alert err" role="alert"><Icon name="alert" /><div>We couldn&apos;t load your profile.{' '}
              <button type="button" className="btn btn-secondary btn-sm" onClick={reloadProfile}>Try again</button></div></div>
          )}
          {profile && <AboutYou profile={profile} />}
          <SavedAddressPanel uid={currentUser.uid} />
          <section className="panel stack" aria-labelledby="signin-h">
            <h2 id="signin-h">Sign-in</h2>
            <p>You sign in with Google, so there is no CraftMe password.</p>
          </section>
          <section className="panel stack" aria-labelledby="delete-h">
            <h2 id="delete-h">Delete your data</h2>
            <p>You can delete your Account and the personal details we hold about you. Orders, refunds and Reviews stay without your name so CraftMe&apos;s records still add up. If you have Orders in progress, we finish deleting once they are settled.</p>
            <div><button type="button" className="btn btn-danger" onClick={() => setDeleting(true)}>Delete my Account</button></div>
          </section>
        </div>
        <aside className="stack" aria-label="Your roles and shortcuts">
          <section className="panel stack sm">
            <h2>Your roles</h2>
            <p><strong>Buyer</strong></p>
            {isArtist
              ? <p><strong>Artist</strong><br /><Link to="/dashboard/orders">Go to my dashboard</Link></p>
              : <p><strong>Artist</strong> <span className="muted">not yet</span>{switches?.acceptArtists && <><br /><Link to="/become-artist">Become an Artist</Link></>}</p>}
          </section>
          <section className="panel stack sm">
            <h2>Shortcuts</h2>
            <Link to="/orders">My orders</Link>
            <Link to="/notifications">Notifications</Link>
            <Link to="/legal/privacy">Privacy policy</Link>
          </section>
        </aside>
      </div>
      <DeleteAccountDialog open={deleting} onClose={() => setDeleting(false)} />
    </main>
  );
}
