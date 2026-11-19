-- Accounts, sessions and the one-use links sent by email (docs/cadrage.md, Comptes and Sécurité).
-- No IP address is stored: the per-IP rate limit lives in memory only.

CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  -- Lowercased by the API before it gets here.
  email VARCHAR(254) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  -- scrypt$<log2 N>$<r>$<p>$<salt>$<hash>, see src/auth/password.ts.
  password_hash VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  -- Case-insensitive collation: "Nova" and "NOVA" cannot both exist.
  pseudo VARCHAR(15) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  pseudo_chosen BOOLEAN NOT NULL DEFAULT FALSE,
  avatar TINYINT UNSIGNED NULL,
  email_verified_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  UNIQUE KEY users_email (email),
  UNIQUE KEY users_pseudo (pseudo),
  KEY users_unverified (email_verified_at, created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- The cookie carries a random id; only its SHA-256 is kept here.
CREATE TABLE sessions (
  id_hash BINARY(32) NOT NULL PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL,
  last_seen_at DATETIME(3) NOT NULL,
  -- Absolute end, 30 days after creation; idleness is checked on last_seen_at.
  expires_at DATETIME(3) NOT NULL,
  KEY sessions_user (user_id),
  KEY sessions_expiry (expires_at),
  CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB;

-- Email verification and password reset links, used once; only the SHA-256 of a token is kept.
CREATE TABLE account_tokens (
  token_hash BINARY(32) NOT NULL PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('verify_email', 'reset_password') NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  KEY account_tokens_user (user_id, purpose),
  KEY account_tokens_expiry (expires_at),
  CONSTRAINT account_tokens_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB;

-- Progressive sign-in lock, keyed by the SHA-256 of the email typed, registered or not, so that
-- a lock never tells which emails have an account.
CREATE TABLE login_throttle (
  email_hash BINARY(32) NOT NULL PRIMARY KEY,
  failures TINYINT UNSIGNED NOT NULL,
  lock_level TINYINT UNSIGNED NOT NULL,
  locked_until DATETIME(3) NULL,
  updated_at DATETIME(3) NOT NULL,
  KEY login_throttle_updated (updated_at)
) ENGINE = InnoDB;
