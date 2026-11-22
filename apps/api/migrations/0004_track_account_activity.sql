-- Inactive accounts are warned, then deleted (docs/merise.md, section 9; RGPD art. 5.1.e).
ALTER TABLE users
  ADD COLUMN last_active_at DATETIME(3) NULL,
  ADD COLUMN inactivity_warned_at DATETIME(3) NULL;

-- The latest trace of an existing account: sign-up, verification, or a session still kept.
UPDATE users u
  LEFT JOIN (SELECT user_id, MAX(last_seen_at) AS seen FROM sessions GROUP BY user_id) s
    ON s.user_id = u.id
  SET u.last_active_at = GREATEST(
    u.created_at,
    COALESCE(u.email_verified_at, u.created_at),
    COALESCE(s.seen, u.created_at)
  );

ALTER TABLE users
  MODIFY COLUMN last_active_at DATETIME(3) NOT NULL,
  ADD KEY users_inactive (last_active_at);
