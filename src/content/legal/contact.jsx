// The support email comes from VITE_SUPPORT_EMAIL (PD13); the business name and address are supplied by CraftMe (XD03).
export const title = 'Contact';
export const tab = 'Contact';
export const updated = '2026-11-14';
export const draft = true;

export function Body() {
  const email = import.meta.env.VITE_SUPPORT_EMAIL;
  return (
    <>
      <h2>Write to us</h2>
      {email ? <p><a href={`mailto:${email}`}>{email}</a></p> : <p className="muted">Support email to be supplied.</p>}
      <h2>Who we are</h2>
      <p className="muted">Business name to be supplied.</p>
      <h2>Where we are</h2>
      <p className="muted">Business address to be supplied.</p>
    </>
  );
}
