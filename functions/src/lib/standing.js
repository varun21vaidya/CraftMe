// Restriction hides an Artist's work by flipping artistOpen. Listing status is never touched,
// so lifting the restriction restores exactly what was live.

const {FieldPath, FieldValue} = require("firebase-admin/firestore");

const CHUNK = 400; // under the 500-write batch limit

async function setArtistOpen(db, artistId, open) {
  for (const col of ["artworks", "listings"]) {
    let last = null;
    for (;;) {
      let q = db.collection(col).where("artistId", "==", artistId).orderBy(FieldPath.documentId()).limit(CHUNK);
      if (last) q = q.startAfter(last);
      const snap = await q.get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach((d) => batch.update(d.ref, {artistOpen: open}));
      await batch.commit();
      if (snap.size < CHUNK) break;
      last = snap.docs[snap.docs.length - 1];
    }
  }
}

async function setStanding(db, artistId, restricted, reason) {
  await db.doc(`users/${artistId}`).set({restricted}, {merge: true});
  await db.doc(`artistPrivate/${artistId}`).set({
    restrictedReasons: restricted ? FieldValue.arrayUnion(reason) : [],
  }, {merge: true});
  await setArtistOpen(db, artistId, !restricted);
}

module.exports = {setArtistOpen, setStanding};
