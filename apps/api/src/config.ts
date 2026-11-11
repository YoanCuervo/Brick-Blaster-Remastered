/** Everything the API reads from its environment, checked once at start. */
export interface Config {
  host: string;
  port: number;
  /** Only behind Caddy: the client address then comes from X-Forwarded-For. */
  trustProxy: boolean;
  db: DbConfig;
}

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export class ConfigError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`invalid configuration:\n- ${problems.join("\n- ")}`);
  }
}

type Env = Readonly<Record<string, string | undefined>>;

const DB_NAME = /^[A-Za-z0-9_]{1,64}$/;

/** Throws a ConfigError naming every missing or invalid variable, never their values. */
export function loadConfig(env: Env): Config {
  const problems: string[] = [];
  const text = (name: string, fallback?: string): string => {
    const value = env[name] ?? fallback;
    if (value === undefined || value === "") problems.push(`${name} is required`);
    return value ?? "";
  };
  const port = (name: string, fallback: number): number => {
    const raw = env[name];
    if (raw === undefined || raw === "") return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1 || value > 65535) {
      problems.push(`${name} must be a port number`);
    }
    return value;
  };
  const flag = (name: string): boolean => {
    const raw = env[name];
    if (raw === undefined || raw === "" || raw === "false") return false;
    if (raw === "true") return true;
    problems.push(`${name} must be true or false`);
    return false;
  };

  const config: Config = {
    host: text("API_HOST", "127.0.0.1"),
    port: port("API_PORT", 3000),
    trustProxy: flag("API_TRUST_PROXY"),
    db: {
      host: text("DB_HOST", "127.0.0.1"),
      port: port("DB_PORT", 3306),
      user: text("DB_USER"),
      password: text("DB_PASSWORD"),
      database: text("DB_NAME"),
    },
  };
  if (config.db.database && !DB_NAME.test(config.db.database)) {
    problems.push("DB_NAME may only hold letters, digits and _");
  }
  if (problems.length > 0) throw new ConfigError(problems);
  return config;
}
