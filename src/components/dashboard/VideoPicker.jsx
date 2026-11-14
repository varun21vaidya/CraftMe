import { reelLabel } from '../../lib/reels';

const MAX_BYTES = 50 * 1024 * 1024;
const MAX_SECONDS = 180;
export const VIDEO_TYPES = ['video/mp4', 'video/webm'];

/** The length of a video file in seconds, read in the browser before anything is uploaded; rejects when the file cannot be read. */
export const readDuration = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const el = document.createElement('video');
  el.preload = 'metadata';
  el.addEventListener('loadedmetadata', () => { URL.revokeObjectURL(url); resolve(el.duration); });
  el.addEventListener('error', () => { URL.revokeObjectURL(url); reject(new Error('unreadable')); });
  el.src = url;
});

/** What is wrong with a chosen video file, or '' (size first, then type, then length). */
export async function videoProblem(file) {
  if (file.size > MAX_BYTES) return 'Videos can be up to 50 MB.';
  if (!VIDEO_TYPES.includes(file.type)) return 'Use an MP4 or WebM video.';
  try {
    return (await readDuration(file)) > MAX_SECONDS ? 'Videos can be up to 3 minutes.' : '';
  } catch {
    return 'We couldn’t read that video. Try another file.';
  }
}

/**
 * None, an Instagram reel (a pasted link, or one of the Artist's saved reels), or an uploaded video. Only one is kept.
 * The page keeps the values; this only draws them. link.state is '' | 'ok' | 'bad'.
 */
export function VideoPicker({ mode, onMode, link, onLink, onCheck, reels, reelId, onReelId, videoUrl, videoFile, onVideoFile, videoError, disabled }) {
  const choose = (m, text, hint) => (
    <label className="option-card"><input type="radio" name="video-mode" checked={mode === m} disabled={disabled} onChange={() => onMode(m)} /><span><strong>{text}</strong>{hint && <><br /><span className="small muted">{hint}</span></>}</span></label>
  );
  return (
    <fieldset className="field stack" style={{ border: 0, padding: 0, margin: 0 }} disabled={disabled}>
      <legend>Video <span className="opt">optional</span></legend>
      <div className="grid g3" role="radiogroup" aria-label="Video">
        {choose('none', 'None')}
        {choose('reel', 'Instagram reel', 'Recommended')}
        {choose('upload', 'Upload a video', 'MP4 or WebM')}
      </div>

      {mode === 'reel' && (
        <div className="stack sm">
          <div className="field">
            <label htmlFor="ed-reel-link">Reel link</label>
            <div className="row" style={{ gap: 8 }}>
              <input id="ed-reel-link" className="input" value={link.value} placeholder="https://www.instagram.com/reel/…" onChange={(e) => onLink(e.target.value)} />
              <button type="button" className="btn btn-secondary" onClick={onCheck}>Check link</button>
            </div>
            <span role="status" className={link.state === 'bad' ? 'error-msg' : 'small muted'}>
              {link.state === 'ok' ? 'Link looks right' : link.state === 'bad' ? 'That isn’t an Instagram post or reel link.' : ''}
            </span>
          </div>
          {reels?.length > 0 && (
            <div className="stack sm" role="radiogroup" aria-label="Your saved reels">
              <span className="small muted">Or choose one of your saved reels</span>
              {reels.map((r) => (
                <label key={r.id} className="option-card">
                  <input type="radio" name="saved-reel" checked={reelId === r.id && !link.value} onChange={() => onReelId(r.id)} />
                  <span>{reelLabel(r)}{r.verified && <span className="small faint"> · from Instagram</span>}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === 'upload' && (
        <div className="field">
          <label htmlFor="ed-video-file">Video file</label>
          <input id="ed-video-file" type="file" accept="video/mp4,video/webm"
            onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onVideoFile(f, await videoProblem(f)); }} />
          <span className="hint">MP4 or WebM, up to 50 MB and 3 minutes.</span>
          {videoFile && !videoError && <span className="small" role="status">{videoFile.name} will upload when you save.</span>}
          {!videoFile && videoUrl && <span className="small muted">A video is attached. Choose a file to replace it.</span>}
          {videoError && <span className="error-msg" role="alert">{videoError}</span>}
        </div>
      )}
    </fieldset>
  );
}

