import { RULES } from '../../lib/rules';

// The numbers come from RULES, so the page can never disagree with what the shop does. The sentences are the shop's rules
// written plainly, not final legal wording: draft = true until CraftMe supplies the final policy (XD03).
export const title = 'Cancellation and Refunds';
export const tab = 'Cancellation and Refunds';
export const updated = '2026-11-14';
export const draft = true;

export function Body({ rules = RULES }) {
  const [first, second] = rules.payoutDays;
  const ordinal = (n) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;
  return (
    <>
      <h2>Paying for an Order</h2>
      <p>When you press Pay, the pieces in your Order are kept for you for {rules.holdMinutes} minutes. If payment does not go through in that time, the Order expires and nothing is charged.</p>

      <h2>When the Artist ships</h2>
      <p>The Artist has {rules.shipDays} days from payment to ship. An Order that is not shipped in time is reviewed by CraftMe and usually refunded in full.</p>

      <h2>Receiving your Order</h2>
      <p>Mark your Order Received when it arrives. If you do not, it is marked Received automatically {rules.autoReceiveDays} days after it ships.</p>

      <h2>If something arrives damaged</h2>
      <p>You have {rules.damageDays} days from Received to send a Damage Report with photos. CraftMe looks at the report and decides; if it is upheld, the refund goes back the way you paid.</p>

      <h2>Reviews</h2>
      <p>You can review an Order for {rules.reviewDays} days after it is Received.</p>

      <h2>When Artists are paid</h2>
      <p>Payouts to Artists are prepared on the {ordinal(first)} and {ordinal(second)} of each month. An Artist who owes CraftMe money for {rules.owedRestrictDays} days has their shop paused until it is settled.</p>
    </>
  );
}
