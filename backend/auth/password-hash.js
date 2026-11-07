import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
export const parameters = { N: 16384, r: 8, p: 1, keylen: 64 };
export async function hashSecret(
  secret,
  salt = randomBytes(16).toString('hex'),
  params = parameters,
) {
  const hash = await derive(secret, salt, params.keylen, {
    N: params.N,
    r: params.r,
    p: params.p,
    maxmem: 64 * 1024 * 1024,
  });
  return { hash: hash.toString('hex'), salt };
}
export async function verifySecret(secret, hash, salt, params) {
  if (typeof secret !== 'string' || Buffer.byteLength(secret) > 1024) return false;
  const actual = await hashSecret(secret, salt, params),
    expected = Buffer.from(hash, 'hex'),
    candidate = Buffer.from(actual.hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
export function recoveryCode() {
  return randomBytes(16).toString('hex').toUpperCase().match(/.{4}/g).join('-');
}
