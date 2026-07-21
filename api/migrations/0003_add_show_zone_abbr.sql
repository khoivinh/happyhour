-- Time Zone Names preference (EST/CET/JST in place of GMT offsets). Default 1 (ON) for everyone,
-- including rows created before this column existed, matching the client's default-ON behavior.
ALTER TABLE user_preferences ADD COLUMN show_zone_abbr INTEGER DEFAULT 1;
