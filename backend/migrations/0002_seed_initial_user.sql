-- Seed initial user
INSERT INTO users (id, email) VALUES ('user_001', 'andrew.hunt@fundamentalmedia.com');

-- Seed email allowlist
INSERT INTO user_settings (user_id, setting_name, setting_value) VALUES ('user_001', 'email_allowlist', '["andrew.hunt@fundamentalmedia.com","andy@mrhunt.co.uk","ahunt83@gmail.com"]');
