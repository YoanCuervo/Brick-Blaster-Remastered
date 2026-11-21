-- Games, the Limbes leaderboards and the players' stats (docs/cadrage.md, Scores et classements
-- and Stats). Every score here comes from the server's own replay of the game.

-- The anonymous trial: its cookie carries a random id, only its SHA-256 is kept here.
CREATE TABLE trial_sessions (
  id_hash BINARY(32) NOT NULL PRIMARY KEY,
  expires_at DATETIME(3) NOT NULL,
  KEY trial_sessions_expiry (expires_at)
) ENGINE = InnoDB;

-- One row per game started. A game belongs to an account, or to a trial until sign-up.
-- The results stay NULL while the game is 'started'.
CREATE TABLE games (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  trial_hash BINARY(32) NULL,
  world ENUM('espace', 'arcade', 'limbes') NOT NULL,
  -- 0 easy, 1 medium, 2 hard, as the engine's Difficulty.
  difficulty TINYINT UNSIGNED NOT NULL,
  -- The Limbes PvP mode, entered in the online leaderboard.
  ranked BOOLEAN NOT NULL,
  seed INT UNSIGNED NOT NULL,
  -- 'left': quit with Esc, counted in the stats but not in any score table.
  status ENUM('started', 'game_over', 'finished', 'left') NOT NULL DEFAULT 'started',
  score INT UNSIGNED NULL,
  level TINYINT UNSIGNED NULL,
  -- 60 ticks per second, pauses included.
  duration_ticks INT UNSIGNED NULL,
  bricks_broken INT UNSIGNED NULL,
  lives_lost SMALLINT UNSIGNED NULL,
  started_at DATETIME(3) NOT NULL,
  ended_at DATETIME(3) NULL,
  -- One game per trial.
  UNIQUE KEY games_trial (trial_hash),
  KEY games_user_ended (user_id, ended_at),
  KEY games_user_mode (user_id, world, difficulty, ranked, score),
  KEY games_started (status, started_at),
  CONSTRAINT games_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT games_trial_fk FOREIGN KEY (trial_hash) REFERENCES trial_sessions (id_hash)
    ON DELETE CASCADE
) ENGINE = InnoDB;

-- The best KEPT_RANKS (1000) ranked games of each difficulty; the site shows the first 100.
-- Ties go to the earlier game.
CREATE TABLE limbes_top (
  game_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  difficulty TINYINT UNSIGNED NOT NULL,
  score INT UNSIGNED NOT NULL,
  KEY limbes_top_rank (difficulty, score DESC, game_id),
  KEY limbes_top_user (user_id, difficulty),
  CONSTRAINT limbes_top_game_fk FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE CASCADE,
  CONSTRAINT limbes_top_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB;

-- Input logs are only kept for the scores of limbes_top, to check them again: leaving the top
-- deletes the log.
CREATE TABLE replay_logs (
  game_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  -- The JSON ReplayLog, gzipped.
  log MEDIUMBLOB NOT NULL,
  CONSTRAINT replay_logs_top_fk FOREIGN KEY (game_id) REFERENCES limbes_top (game_id)
    ON DELETE CASCADE
) ENGINE = InnoDB;

-- Counters of a player, updated with each game.
CREATE TABLE player_stats (
  user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  games_played INT UNSIGNED NOT NULL,
  play_ticks BIGINT UNSIGNED NOT NULL,
  max_level TINYINT UNSIGNED NOT NULL,
  bricks_broken BIGINT UNSIGNED NOT NULL,
  lives_lost INT UNSIGNED NOT NULL,
  CONSTRAINT player_stats_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB;

-- Best score per world and difficulty, ranked games included, games left with Esc excluded.
CREATE TABLE player_bests (
  user_id BIGINT UNSIGNED NOT NULL,
  world ENUM('espace', 'arcade', 'limbes') NOT NULL,
  difficulty TINYINT UNSIGNED NOT NULL,
  best_score INT UNSIGNED NOT NULL,
  PRIMARY KEY (user_id, world, difficulty),
  CONSTRAINT player_bests_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB;
