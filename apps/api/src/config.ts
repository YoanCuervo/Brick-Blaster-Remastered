/** Everything the API reads from its environment, checked once at start. */
export interface Config {
  host: string;
  port: number;
  /** Only behind Caddy: the client address then comes from X-Forwarded-For. */
  trustProxy: boolean;
  /** Origin of the website: email links point there, and no other origin may write. */
  siteUrl: string;
  mail: MailConfig;
  db: DbConfig;
  /** Folder of the asset pack's config.json and levels.json, which the replays need. */
  gameDataDir: string;
}

/** Without a Brevo key, emails go to the console: allowed for a local site only. */
export type MailConfig =
  { transport: "brevo"; apiKey: string; from: string } | { transport: "log" };

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
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function httpUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

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

  const site = httpUrl(env["SITE_URL"] || "http://localhost:5174");
  const local = site !== null && LOCAL_HOSTS.has(site.hostname);
  if (site === null) problems.push("SITE_URL must be an http(s) URL");
  // The session cookie is Secure: a browser only keeps it over HTTPS, or on localhost.
  else if (!local && site.protocol !== "https:") problems.push("SITE_URL must use https");

  const apiKey = env["BREVO_API_KEY"] ?? "";
  let mail: MailConfig = { transport: "log" };
  if (apiKey !== "") {
    const from = text("MAIL_FROM");
    if (from && !EMAIL.test(from)) problems.push("MAIL_FROM must be an email address");
    mail = { transport: "brevo", apiKey, from };
  } else if (site !== null && !local) {
    // The console would then hold every verification and reset link.
    problems.push("BREVO_API_KEY is required when SITE_URL is not local");
  }

  const config: Config = {
    host: text("API_HOST", "127.0.0.1"),
    port: port("API_PORT", 3000),
    trustProxy: flag("API_TRUST_PROXY"),
    siteUrl: site?.origin ?? "",
    mail,
    // apps/api is the working directory of the npm scripts; assets/ sits at the root.
    gameDataDir: text("GAME_DATA_DIR", "../../assets"),
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
