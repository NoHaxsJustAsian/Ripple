# Supabase Setup Guide

## Set Up Database Tables

To set up the required database tables in Supabase, follow these steps:

1. Log in to your [Supabase dashboard](https://app.supabase.co/)

2. Select your project

3. Go to the SQL Editor section

4. Create a new query and paste the following SQL from `supabase_schema.sql`:

```sql
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create comments table
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  position_start INTEGER NOT NULL, -- Starting position in the file
  position_end INTEGER NOT NULL, -- Ending position in the file
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_events table for logging
CREATE TABLE user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indices for better performance
CREATE INDEX idx_user_events_user_id ON user_events(user_id);
CREATE INDEX idx_user_events_file_id ON user_events(file_id);
CREATE INDEX idx_user_events_event_type ON user_events(event_type);
CREATE INDEX idx_user_events_created_at ON user_events(created_at);
CREATE INDEX idx_files_user_id ON files(user_id);
CREATE INDEX idx_files_updated_at ON files(updated_at);
CREATE INDEX idx_comments_file_id ON comments(file_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);

-- Create a view for easier analysis of user events 
CREATE VIEW user_activity_summary AS
SELECT
  u.prolific_id,
  COUNT(DISTINCT f.id) AS file_count,
  COUNT(DISTINCT c.id) AS comment_count,
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
LEFT JOIN
  comments c ON f.id = c.file_id
GROUP BY
  u.prolific_id;
```

5. Run the query to create all required tables

## Set up RLS Policies

If your application requires Row Level Security, set up the following policies through the Supabase dashboard or using SQL.

## Verify the Environment Variables

Make sure your `.env` file in the client directory contains the correct Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://127.0.0.1:5000
```

You can find these values in your Supabase project dashboard under Settings > API.

## Test the Integration

1. Run the application
2. Use the "Bypass Login" button to create a test user
3. Create a document and click "Save"
4. Verify in Supabase that:
   - A user was created in the "users" table
   - A file was created in the "files" table
   - Comments were created in the "comments" table (if you added any)
   - Events were logged in the "user_events" table

## Troubleshooting

If files are not saving to Supabase, check:

1. Console errors in your browser developer tools
2. Supabase logs in the Supabase dashboard
3. That your database tables were created properly
4. That your environment variables are set correctly

If you're still having issues, try clearing localStorage and testing with a new test user.