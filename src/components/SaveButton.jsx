import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSaved } from '../contexts/SavedContext';
import { wishlistMessage } from '../lib/wishlist';
import { Icon } from './common/Icon';

/** The heart. Signed-out visitors are sent to log in and come back here. Hidden on an Artist's own work. */
export default function SaveButton({ artworkId, artistId, overlay = false, label = false }) {
  const { currentUser } = useAuth();
  const { has, toggle } = useSaved();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!msg) return undefined;
    const t = setTimeout(() => setMsg(''), 4000);
    return () => clearTimeout(t);
  }, [msg]);

  if (currentUser?.uid && currentUser.uid === artistId) return null;
  const saved = currentUser ? has(artworkId) : false;
  const press = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUser) return navigate('/login', { state: { from: pathname } });
    const res = await toggle(artworkId);
    return res.ok ? setMsg('') : setMsg(wishlistMessage(res));
  };

  return (
    <span className={`save${overlay ? ' overlay' : ''}`}>
      <button type="button" className={`save-btn${label ? ' labelled' : ''}`} aria-pressed={saved} onClick={press}
        aria-label={saved ? 'Remove from wish list' : 'Save to wish list'} title={saved ? 'Remove from wish list' : 'Save to wish list'}>
        <Icon name="heart" size={20} />
        {label && <span>{saved ? 'Saved' : 'Save'}</span>}
      </button>
      {msg && <span className="save-msg small" role="status">{msg}</span>}
    </span>
  );
}
