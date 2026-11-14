import { RULES } from '../../lib/rules';

// Placeholder headings plus the two numbers the shop enforces. Final text is supplied by CraftMe (XD03).
export const title = 'Shipping';
export const tab = 'Shipping';
export const updated = '2026-11-14';
export const draft = true;

const Todo = () => <p className="muted">Text to be supplied.</p>;

export function Body({ rules = RULES }) {
  return (
    <>
      <h2>Where we deliver</h2><Todo />
      <h2>How long it takes</h2>
      <p>Each Artist has {rules.shipDays} days from payment to ship your Order. Prices include shipping within India.</p>
      <h2>Tracking</h2>
      <p>The Artist adds the courier and tracking number when they ship. If you do not mark the Order Received, it is marked automatically {rules.autoReceiveDays} days after shipping.</p>
      <h2>Damaged in transit</h2><Todo />
    </>
  );
}
