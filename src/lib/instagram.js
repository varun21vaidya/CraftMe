// What the server's Instagram callback can report (?instagram=connected or ?instagram=error&reason=...).
const MESSAGES = {
  connected: 'Instagram connected.',
  expired: 'That took too long. Press Connect Instagram to try again.',
  denied: 'Instagram access was not approved.',
  no_account: 'No Instagram account was shared. Choose a creator or business account in the login window (a personal account can be switched in Instagram settings).',
  already_linked: 'That Instagram account is already connected to another CraftMe artist.',
  failed: 'Something went wrong connecting Instagram. Please try again.',
};

/** The message for a callback result, or null when there is no result. */
export const instagramMessage = (result, reason) => {
  if (!result) return null;
  return result === 'connected' ? MESSAGES.connected : MESSAGES[reason] || MESSAGES.failed;
};

/** The login popup and the profile tab talk over this channel (same origin, works even when Meta's pages cut window.opener). */
export const INSTAGRAM_CHANNEL = 'craftme-instagram';
export const POPUP_NAME = 'craftme-instagram';
