import { createHash, randomBytes } from "crypto";

// Unambiguous alphabet (no 0/O, 1/I/L) for keys relayed by hand.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Generate a portal key like PHD-X7K2-M9QC-4TZV. */
export function generatePortalKey(): string {
  const bytes = randomBytes(12);
  let chars = "";
  for (let i = 0; i < 12; i++) chars += ALPHABET[bytes[i] % ALPHABET.length];
  return `PHD-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

/** Keys are stored only as SHA-256 hashes; normalize so pasted keys match. */
export function hashPortalKey(key: string): string {
  return createHash("sha256").update(key.trim().toUpperCase()).digest("hex");
}

export function portalKeyPrefix(key: string): string {
  return key.trim().toUpperCase().slice(0, 8); // e.g. "PHD-X7K2"
}
