// Where to send a person after Google brings them back. Only same-site paths are ever followed.
const KEY = 'cm-return';

/** One "/" then something that is not "/" or "\" (those make "//host" and "/\host"), no control characters, and never the login page itself. */
// eslint-disable-next-line no-control-regex -- control characters are exactly what is being refused
const sameSite = (p) => typeof p === 'string' && /^\/(?![/\\])[^\u0000-\u001f]*$/.test(p) && !/^\/login(?:[/?#]|$)/.test(p);

export const rememberReturn = (path) => {
  try {
    if (sameSite(path)) sessionStorage.setItem(KEY, path);
  } catch { /* storage blocked: the person lands on Home */ }
};

/** The remembered path, once; '/' when there is none or it is not a same-site path. */
export const takeReturn = () => {
  try {
    const path = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return sameSite(path) ? path : '/';
  } catch {
    return '/';
  }
};
