/**
 * Compact unique-ish IDs. Crockford-base32 timestamp + random suffix —
 * sortable by creation time, URL-safe, no dependencies.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function randomId(prefix?: string): string {
  const ts = Date.now().toString(32).padStart(9, "0").toUpperCase();
  let rand = "";
  for (let i = 0; i < 8; i++) {
    rand += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return prefix ? `${prefix}_${ts}${rand}` : `${ts}${rand}`;
}
