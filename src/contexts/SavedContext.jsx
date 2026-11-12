import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  addToCollection, createCollection, deleteCollection, removeFromCollection, renameCollection, saveWork, unsaveWork,
  useCollections, useSavedIds,
} from '../api/gateway';
import { useAuth } from './AuthContext';

const none = async () => ({ ok: false });
const SavedContext = createContext({
  has: () => false, count: 0, collections: [], toggle: none, addTo: none, removeFrom: none, create: none, rename: none, remove: none,
});

/**
 * The signed-in user's saved work ids and collections, loaded once for the whole app so every heart knows its state.
 * Changes show at once (optimistic) and are undone when the server refuses.
 * Every function resolves to the gateway's result ({ok:true} or {ok:false,error}) so the caller can show a message.
 */
export function SavedProvider({ children }) {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;
  const [ids, , , reloadIds] = useSavedIds(uid);
  const [cols, , , reloadCols] = useCollections(uid);
  const [override, setOverride] = useState({}); // artworkId -> true/false while a request is running
  const busy = useRef(new Set());

  const has = useCallback((id) => (id in override ? override[id] : (ids || []).includes(id)), [ids, override]);

  const value = useMemo(() => {
    const set = (id, v) => setOverride((o) => ({ ...o, [id]: v }));
    const clear = (id) => setOverride((o) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== id)));
    const save = async (id) => {
      if (busy.current.has(id)) return { ok: true }; // a second press while the first is running is ignored
      busy.current.add(id);
      const want = !has(id);
      set(id, want);
      const res = await (want ? saveWork(uid, id) : unsaveWork(uid, id));
      await Promise.all([reloadIds(), reloadCols()]);
      busy.current.delete(id);
      clear(id);
      return res;
    };
    const after = async (res) => { if (res.ok) await reloadCols(); return res; };
    return {
      has,
      count: new Set([...(ids || []), ...Object.keys(override).filter((k) => override[k])]).size,
      collections: cols || [],
      toggle: save,
      // adding to a collection saves the work first when it is not saved yet
      addTo: async (collectionId, artworkId) => {
        if (!has(artworkId)) { const s = await saveWork(uid, artworkId); if (!s.ok) return s; reloadIds(); }
        return after(await addToCollection(uid, collectionId, artworkId));
      },
      removeFrom: async (collectionId, artworkId) => after(await removeFromCollection(collectionId, artworkId)),
      create: async (name) => after(await createCollection(uid, name)),
      rename: async (id, name) => after(await renameCollection(id, name)),
      remove: async (id) => after(await deleteCollection(id)),
    };
  }, [uid, ids, cols, override, has, reloadIds, reloadCols]);

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export const useSaved = () => useContext(SavedContext);
