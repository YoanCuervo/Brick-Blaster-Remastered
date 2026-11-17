import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

/**
 * Password hashing with Node's own scrypt (CNIL 2022-100 accepts it, as OWASP does). The stored
 * string names its parameters, so that they can be raised later without breaking old hashes.
 */

export interface ScryptParams {
  /** log2 of N, the CPU and memory cost. */
  logN: number;
  r: number;
  p: number;
}

/** OWASP's minimum for scrypt: 128 × N × r = 128 MiB of memory per hash. */
export const DEFAULT_PARAMS: ScryptParams = { logN: 17, r: 8, p: 1 };

const SALT_BYTES = 16;
const KEY_BYTES = 64;
/** A stored hash whose parameters cost more than this is refused rather than computed. */
const MAX_LOG_N = 20;
/** Hashes in flight at once: each takes 128 MiB, and the VPS has 4 GiB for everything. */
const MAX_CONCURRENT = 2;

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, stored: string): Promise<boolean>;
  /** Spends the time of a verify, for an email with no account behind it. */
  verifyNothing(password: string): Promise<void>;
}

const derive = (password: string, salt: Buffer, params: ScryptParams): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const N = 2 ** params.logN;
    scryptCallback(
      password.normalize("NFC"),
      salt,
      KEY_BYTES,
      { N, r: params.r, p: params.p, maxmem: 2 * 128 * N * params.r },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });

/** Runs at most `limit` tasks at once, the others wait their turn. */
function limiter(limit: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active >= limit) await new Promise<void>((resolve) => waiting.push(resolve));
    active++;
    try {
      return await task();
    } finally {
      active--;
      waiting.shift()?.();
    }
  };
}

function parse(stored: string): { params: ScryptParams; salt: Buffer; key: Buffer } | null {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;
  const [logN, r, p] = parts.slice(1, 4).map(Number) as [number, number, number];
  if (![logN, r, p].every(Number.isInteger) || logN < 1 || logN > MAX_LOG_N || r < 1 || p < 1) {
    return null;
  }
  const salt = Buffer.from(parts[4]!, "base64url");
  const key = Buffer.from(parts[5]!, "base64url");
  if (salt.length === 0 || key.length !== KEY_BYTES) return null;
  return { params: { logN, r, p }, salt, key };
}

export function createPasswordHasher(params: ScryptParams = DEFAULT_PARAMS): PasswordHasher {
  const run = limiter(MAX_CONCURRENT);
  const hash = async (password: string): Promise<string> => {
    const salt = randomBytes(SALT_BYTES);
    const key = await run(() => derive(password, salt, params));
    const { logN, r, p } = params;
    return `scrypt$${logN}$${r}$${p}$${salt.toString("base64url")}$${key.toString("base64url")}`;
  };
  let dummy: Promise<string> | null = null;
  const verify = async (password: string, stored: string): Promise<boolean> => {
    const parsed = parse(stored);
    if (!parsed) return false;
    const key = await run(() => derive(password, parsed.salt, parsed.params));
    return timingSafeEqual(key, parsed.key);
  };
  return {
    hash,
    verify,
    async verifyNothing(password) {
      dummy ??= hash(randomBytes(16).toString("hex"));
      await verify(password, await dummy);
    },
  };
}
