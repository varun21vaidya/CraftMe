// Per-file upload state for forms that send several photos. Pure apart from the uploadOne the caller passes in.
// items: [{ file, status: 'queued' | 'uploading' | 'done' | 'failed', path?, error? }]

const MB = 1024 * 1024;

/**
 * Splits a batch into accepted files and refusals. `have` = files already chosen. Accepted files keep their order;
 * a file is refused for its type first, then its size, then because the limit is full.
 */
export function validateFiles(files, { accept, maxBytes, maxFiles, have = 0 }) {
  const types = Array.isArray(accept) ? accept : String(accept).split(',').map((t) => t.trim());
  const ok = [];
  const rejected = [];
  for (const f of files) {
    if (!types.includes(f.type)) rejected.push({ name: f.name, reason: 'type' });
    else if (f.size > maxBytes) rejected.push({ name: f.name, reason: 'size' });
    else if (have + ok.length >= maxFiles) rejected.push({ name: f.name, reason: 'count' });
    else ok.push(f);
  }
  return { ok, rejected };
}

/** The line shown for a refused file. */
export const rejectionText = ({ name, reason }, { maxBytes, maxFiles }) => ({
  type: `${name}: not a JPEG or PNG.`,
  size: `${name}: too large (up to ${Math.round(maxBytes / MB)} MB).`,
  count: `${name}: up to ${maxFiles} photos.`,
}[reason]);

/**
 * Uploads every item that is not 'done' (queued or failed), `parallel` at a time, and returns the final items.
 * uploadOne(file) resolves { ok, path } or { ok: false, error }; it may also throw. onChange gets a fresh copy of the items
 * after every change. A retry passes the returned items again and only the failed ones are sent.
 */
export async function uploadAll(items, uploadOne, { parallel = 2, onChange = () => {} } = {}) {
  const state = items.map((it) => ({ ...it }));
  const emit = () => onChange(state.map((s) => ({ ...s })));
  const todo = state.filter((s) => s.status !== 'done');
  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const it = todo[next++];
      it.status = 'uploading';
      delete it.error;
      emit();
      let res;
      try { res = await uploadOne(it.file); } catch { res = { ok: false }; }
      if (res?.ok) { it.status = 'done'; it.path = res.path; } else { it.status = 'failed'; it.error = res?.error?.code || 'failed'; }
      emit();
    }
  };
  await Promise.all(Array.from({ length: Math.min(parallel, todo.length) }, worker));
  return state;
}
