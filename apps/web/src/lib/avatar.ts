/**
 * WeAvatar / Gravatar avatar URL utility.
 *
 * Uses WeAvatar (weavatar.com) as a CDN proxy for Gravatar.
 * Hash is SHA-256 of the lowercase-trimmed email.
 * Falls back to `identicon` when the email has no gravatar.
 */

const WEAVATAR_BASE = "https://weavatar.com/avatar";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Build a WeAvatar URL for the given identifier (usually an email).
 * @param identifier - Email address (or user ID as fallback)
 * @param size - Pixel size of the square avatar (default 80)
 * @param fallback - Default avatar style when no gravatar exists
 */
/**
 * Build a WeAvatar URL from a pre-computed SHA-256 hash (synchronous).
 * Use this when the backend already provides `avatarHash`.
 */
export function buildAvatarUrlFromHash(hash: string, size = 80): string {
  return `${WEAVATAR_BASE}/${hash}?s=${size}&d=404`;
}

/**
 * Build a WeAvatar URL for the given identifier (usually an email).
 * Computes the hash client-side. Use only for the current user's own profile.
 */
export async function getAvatarUrl(
  identifier: string,
  size = 80,
): Promise<string> {
  const hash = await sha256Hex(identifier.trim().toLowerCase());
  return buildAvatarUrlFromHash(hash, size);
}
