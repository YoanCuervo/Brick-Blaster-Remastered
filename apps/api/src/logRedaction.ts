import type { FastifyServerOptions } from "fastify";

/**
 * A MySQL error message can quote a stored value (`Duplicate entry 'x@y.fr' for key ...`,
 * `Incorrect string value: ...`). None reaches the log: the error serializer drops it, and the
 * log method hook keeps pino from copying it into `msg`, where it would land by default.
 */

type LoggerOptions = Exclude<NonNullable<FastifyServerOptions["logger"]>, boolean>;
type LogMethodHook = NonNullable<NonNullable<LoggerOptions["hooks"]>["logMethod"]>;
type ErrorLike = Record<string, unknown> & { message: string };

/** Deep enough for any real chain of causes, bounded against a hostile one. */
const MAX_DEPTH = 8;
const REDACTED = "[redacted]";
const DATABASE_ERROR = "database error";

function isErrorLike(value: unknown): value is ErrorLike {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { message?: unknown }).message === "string"
  );
}

/** mysql2 sets `sqlState` and `sqlMessage` on server errors; their codes start with ER_. */
export function isMysqlError(error: ErrorLike): boolean {
  return (
    typeof error.sqlState === "string" ||
    typeof error.sqlMessage === "string" ||
    typeof error.sql === "string" ||
    (typeof error.code === "string" && error.code.startsWith("ER_"))
  );
}

function children(error: ErrorLike): ErrorLike[] {
  const found = isErrorLike(error.cause) ? [error.cause] : [];
  if (Array.isArray(error.errors)) found.push(...error.errors.filter(isErrorLike));
  return found;
}

/** The texts of every MySQL error in the tree, to strip wherever another message repeats them. */
function mysqlTexts(root: ErrorLike): string[] {
  const texts: string[] = [];
  const seen = new Set<ErrorLike>();
  const walk = (error: ErrorLike, depth: number) => {
    if (seen.has(error) || depth > MAX_DEPTH) return;
    seen.add(error);
    if (isMysqlError(error)) {
      for (const text of [error.message, error.sqlMessage]) {
        if (typeof text === "string" && text.length > 0) texts.push(text);
      }
    }
    for (const child of children(error)) walk(child, depth + 1);
  };
  walk(root, 0);
  // Longest first, so that a message is not half replaced through a shorter one it contains.
  return texts.sort((a, b) => b.length - a.length);
}

function scrub(text: string, secrets: readonly string[]): string {
  return secrets.reduce((out, secret) => out.split(secret).join(REDACTED), text);
}

function typeOf(error: ErrorLike): string {
  const name = (error.constructor as { name?: unknown } | undefined)?.name;
  return typeof name === "string" && name !== "Object" ? name : String(error.name ?? "Error");
}

/** Only the stack frames: its first lines repeat the message. */
function framesOnly(stack: string, header: string): string {
  return [header, ...stack.split("\n").filter((line) => /^\s+at /.test(line))].join("\n");
}

interface SerializedError {
  type: string;
  message?: string;
  stack?: string;
  code?: string | number;
  errno?: number;
  sqlState?: string;
  statusCode?: number;
  cause?: SerializedError;
  aggregateErrors?: SerializedError[];
}

/**
 * Stands in for pino's `err` serializer. Fields are allow-listed, for every error: mysql2 also
 * carries `sqlMessage` and `sql`, and any other error may carry whatever its thrower put on it.
 */
export function serializeError(value: unknown): unknown {
  if (!isErrorLike(value)) return value;
  const secrets = mysqlTexts(value);
  const seen = new Set<ErrorLike>();

  const serialize = (error: ErrorLike, depth: number): SerializedError => {
    seen.add(error);
    const out: SerializedError = { type: typeOf(error) };
    if (isMysqlError(error)) {
      const header = `${out.type}: [MySQL ${String(error.code ?? "error")}]`;
      if (typeof error.stack === "string") out.stack = framesOnly(error.stack, header);
    } else {
      out.message = scrub(error.message, secrets);
      if (typeof error.stack === "string") out.stack = scrub(error.stack, secrets);
    }
    if (typeof error.code === "string" || typeof error.code === "number") out.code = error.code;
    if (typeof error.errno === "number") out.errno = error.errno;
    if (typeof error.sqlState === "string") out.sqlState = error.sqlState;
    if (typeof error.statusCode === "number") out.statusCode = error.statusCode;
    if (depth < MAX_DEPTH) {
      if (isErrorLike(error.cause) && !seen.has(error.cause)) {
        out.cause = serialize(error.cause, depth + 1);
      }
      if (Array.isArray(error.errors)) {
        out.aggregateErrors = error.errors
          .filter((inner): inner is ErrorLike => isErrorLike(inner) && !seen.has(inner))
          .map((inner) => serialize(inner, depth + 1));
      }
    }
    return out;
  };
  return serialize(value, 0);
}

/**
 * pino writes an error's message as `msg` when the call gives none, and Fastify's fallback error
 * log passes it on purpose. Any text of the call that repeats a MySQL message is redacted.
 */
export const logMethod: LogMethodHook = function (args, method) {
  const [first, ...rest] = args as unknown[];
  const logged: ErrorLike[] = [];
  if (isErrorLike(first)) logged.push(first);
  else if (typeof first === "object" && first !== null) {
    const { err, error } = first as { err?: unknown; error?: unknown };
    if (isErrorLike(err)) logged.push(err);
    if (isErrorLike(error)) logged.push(error);
  }
  const secrets = logged.flatMap(mysqlTexts);
  if (secrets.length === 0) return method.apply(this, args);

  let head = first;
  // An object's own `msg` field is written as the message too.
  if (!isErrorLike(first) && typeof (first as { msg?: unknown }).msg === "string") {
    head = { ...(first as object), msg: scrub((first as { msg: string }).msg, secrets) };
  }
  const tail = rest.map((arg) => (typeof arg === "string" ? scrub(arg, secrets) : arg));
  if (tail.length === 0 && head === first) {
    const top = logged[0]!;
    tail.push(isMysqlError(top) ? DATABASE_ERROR : scrub(top.message, secrets));
  }
  return method.apply(this, [head, ...tail] as Parameters<typeof method>);
};
