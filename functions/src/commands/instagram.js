const crypto = require("crypto");
const yup = require("yup");
const {CommandError} = require("../lib/envelope");
const ig = require("../lib/instagram");
const {INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET} = require("../ports");

const SHOWCASE_MAX = 9;
const STATE_TTL_MS = 10 * 60 * 1000;
const redirectUri = () => process.env.INSTAGRAM_REDIRECT_URI || "";
const empty = yup.object({});

const tokenOf = async (db, uid) => {
  const t = (await db.doc(`instagramTokens/${uid}`).get()).data();
  if (!t) throw new CommandError("conflict", "not_connected");
  return t.accessToken;
};

const connectInstagram = {
  spec: {role: "artist", schema: empty},
  async handler({uid, now, db}) {
    const enabled = ((await db.doc("settings/public").get()).data() || {}).instagramConnectEnabled === true;
    if (!enabled) throw new CommandError("conflict", "disabled");
    const nonce = crypto.randomBytes(16).toString("hex"); // checked on return: stops a forged callback
    await db.doc(`artistPrivate/${uid}`).set({instagramState: {nonce, expires: now + STATE_TTL_MS}}, {merge: true});
    return {url: ig.authorizeUrl({appId: INSTAGRAM_APP_ID.value(), redirectUri: redirectUri(), state: nonce})};
  },
};

const completeInstagramConnect = {
  spec: {role: "artist", schema: yup.object({code: yup.string().required(), state: yup.string().required()})},
  async handler({uid, input, now, db}) {
    const priv = (await db.doc(`artistPrivate/${uid}`).get()).data() || {};
    const st = priv.instagramState;
    if (!st || st.nonce !== input.state || st.expires < now) throw new CommandError("forbidden", "bad_state");
    const appId = INSTAGRAM_APP_ID.value();
    const appSecret = INSTAGRAM_APP_SECRET.value();
    let short;
    let long;
    let profile;
    try {
      short = await ig.exchangeCode({appId, appSecret, redirectUri: redirectUri(), code: input.code});
      long = await ig.longLived({appSecret, token: short.token});
      profile = await ig.me(long.token);
    } catch (e) {
      throw new CommandError("unavailable", "instagram_down");
    }
    if (!["BUSINESS", "CREATOR", "MEDIA_CREATOR"].includes(profile.accountType)) {
      throw new CommandError("conflict", "personal_account");
    }
    const expiresAt = now + long.expiresInMs;
    await db.doc(`instagramTokens/${uid}`).set({accessToken: long.token, igUserId: profile.id, expiresAt, refreshedAt: now});
    await db.doc(`artistPrivate/${uid}`).set({
      instagram: {connected: true, igUserId: profile.id, tokenExpiresAt: expiresAt}, instagramState: null,
    }, {merge: true});
    await db.doc(`users/${uid}`).set({instagramUsername: profile.username}, {merge: true});
    return {username: profile.username};
  },
};

const listInstagramMedia = {
  spec: {role: "artist", schema: empty},
  async handler({uid, db}) {
    try {
      return {items: await ig.media(await tokenOf(db, uid))};
    } catch (e) {
      if (e.name === "CommandError") throw e;
      throw new CommandError("unavailable", "instagram_down");
    }
  },
};

const saveShowcase = {
  spec: {
    role: "artist",
    schema: yup.object({
      permalinks: yup.array().of(yup.string().matches(ig.PERMALINK).required()).max(SHOWCASE_MAX).required(),
    }),
  },
  async handler({uid, input, db}) {
    await db.doc(`users/${uid}`).set({showcase: input.permalinks}, {merge: true});
    return {count: input.permalinks.length};
  },
};

const disconnectInstagram = {
  spec: {role: "artist", schema: empty},
  async handler({uid, db}) {
    await ig.removeInstagram(db, uid);
    return {};
  },
};

module.exports = {commands: {connectInstagram, completeInstagramConnect, listInstagramMedia, saveShowcase, disconnectInstagram}};
