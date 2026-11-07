const ALREADY_EXISTS = 6;

/** In-app notification with a caller-chosen id, so a retried trigger or sweep never writes it twice. */
async function notify(db, id, userId, type, data, now) {
  try {
    await db.doc(`notifications/${id}`).create({userId, type, data, read: false, createdAt: now});
  } catch (e) {
    if (e.code !== ALREADY_EXISTS) throw e;
  }
}

module.exports = {notify, ALREADY_EXISTS};
