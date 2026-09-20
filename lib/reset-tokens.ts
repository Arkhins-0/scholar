import { createHash, randomBytes } from "crypto";

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
export const RESET_RATE_WINDOW_MS = 15 * 60 * 1000;
export const RESET_MAX_PER_WINDOW = 3;

/** Raw token goes in the email link; only the hash is stored. */
export function generateResetToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashResetToken(raw) };
}

export function hashResetToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
