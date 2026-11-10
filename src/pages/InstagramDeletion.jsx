import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getDeletionStatus } from '../api/gateway';
import { formatDate } from '../lib/format';

// Meta's data-deletion callback points people here with ?code=... so they can see that their request finished.
export default function InstagramDeletion() {
  const [params] = useSearchParams();
  const code = params.get('code') || '';
  const [doneAt, setDoneAt] = useState(undefined); // undefined = loading, null = unknown or still running

  useEffect(() => {
    let live = true;
    (code ? getDeletionStatus(code) : Promise.resolve(null)).then((t) => { if (live) setDoneAt(t); });
    return () => { live = false; };
  }, [code]);

  return (
    <main className="wrap page" style={{ maxWidth: 720 }}>
      <h1>Instagram data deletion</h1>
      {doneAt === undefined && <div className="skeleton" style={{ height: 48 }} aria-busy="true" />}
      {doneAt && <p>Your Instagram data was deleted from CraftMe on {formatDate(doneAt)}. Confirmation code: <strong>{code}</strong>.</p>}
      {doneAt === null && <p>We couldn’t find a finished request for that code. If you just made the request, check again in a minute.</p>}
    </main>
  );
}
