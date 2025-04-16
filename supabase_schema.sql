-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prolific_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create files table
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL DEFAULT 'Untitled Document',
  content TEXT NOT NULL,
  comments JSONB DEFAULT '[]'::jsonb, -- Store comments as JSONB array
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_events table for logging
CREATE TABLE user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indices for better performance
CREATE INDEX idx_user_events_user_id ON user_events(user_id);
CREATE INDEX idx_user_events_event_type ON user_events(event_type);
CREATE INDEX idx_user_events_created_at ON user_events(created_at);
CREATE INDEX idx_files_user_id ON files(user_id);
CREATE INDEX idx_files_updated_at ON files(updated_at);

-- Create a view for easier analysis of user events 
CREATE VIEW user_activity_summary AS
SELECT
  u.prolific_id,
  COUNT(DISTINCT f.id) AS file_count,
  COUNT(e.id) AS event_count,
  MIN(e.created_at) AS first_activity,
  MAX(e.created_at) AS last_activity,
  COUNT(CASE WHEN e.event_type = 'editor_change' THEN 1 END) AS edit_count,
  COUNT(CASE WHEN e.event_type = 'text_selection' THEN 1 END) AS selection_count,
  COUNT(CASE WHEN e.event_type = 'file_save' THEN 1 END) AS save_count,
  COUNT(CASE WHEN e.event_type = 'ai_interaction' THEN 1 END) AS ai_interaction_count
FROM
  users u
LEFT JOIN
  user_events e ON u.id = e.user_id
LEFT JOIN
  files f ON u.id = f.user_id
GROUP BY
  u.prolific_id; 