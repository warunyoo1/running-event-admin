import { TEMP_PASSWORD_LENGTH } from "./constants";

/** No look-alike characters (0 O o 1 l I) so a password can be read out or retyped. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
// Largest multiple of the alphabet size that fits in a byte; larger bytes are rejected to avoid modulo bias.
const LIMIT = 256 - (256 % ALPHABET.length);

export function generateTemporaryPassword(length = TEMP_PASSWORD_LENGTH): string {
  let result = "";
  while (result.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const byte of bytes) {
      if (byte >= LIMIT) continue;
      result += ALPHABET[byte % ALPHABET.length];
      if (result.length === length) break;
    }
  }
  return result;
}
