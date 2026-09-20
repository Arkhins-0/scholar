import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const BCRYPT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Constant-cost compare target for unknown emails (mitigates user-enumeration timing). */
export const DUMMY_HASH = "$2a$12$XKZLmDLLTGdUxNgYVeUJROBWx0nWpZ3Jc6RSl6Ai/S8f3JpX0m3ba";

/** 16-char temporary password for staff accounts, shown once to the admin. */
export function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(14);
  let out = "";
  for (let i = 0; i < 14; i++) out += alphabet[bytes[i] % alphabet.length];
  // guarantee at least one digit so it always passes the complexity rule
  return out + "7!";
}
