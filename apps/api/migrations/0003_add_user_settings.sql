-- The game's settings kept on the account (docs/merise.md, section 7). NULL is the game's default.
ALTER TABLE users
  ADD COLUMN music_volume TINYINT UNSIGNED NULL,
  ADD COLUMN mouse_sensitivity DECIMAL(3, 2) NULL;
