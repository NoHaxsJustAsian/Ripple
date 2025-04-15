# Coherence

A document editor with Supabase authentication using Prolific IDs, file saving, and comprehensive event logging.

## Features

- **Prolific ID Authentication**: Users log in using their Prolific ID
- **File Saving**: Documents are saved to Supabase
- **Event Logging**: Comprehensive logging of user interactions
- **Bypass Login**: Development mode allows bypassing login
- **Schema-less Design**: Simplified database schema without Row Level Security (RLS)

## Setup

### Prerequisites

- Node.js 18+
- Supabase account

### Supabase Setup

1. Create a new Supabase project
2. Run the SQL schema in the `supabase_schema.sql` file in the SQL editor
3. Get your Supabase URL and anon key from the API settings

### Frontend Setup

1. Navigate to the client directory:
   ```bash
   cd client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Update the `.env` file with your Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_API_URL=http://127.0.0.1:5000
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## Accessing the Application

- Users can log in with their Prolific ID
- For development, use the "Bypass Login" button
- All user interactions are logged to the Supabase database

## Database Schema

### Users
- `id`: UUID (primary key)
- `prolific_id`: Text (unique)
- `created_at`: Timestamp

### Files
- `id`: UUID (primary key)
- `user_id`: UUID (foreign key to users)
- `title`: Text
- `content`: Text
- `created_at`: Timestamp
- `updated_at`: Timestamp

### User Events
- `id`: UUID (primary key)
- `user_id`: UUID (foreign key to users)
- `event_type`: Text
- `event_data`: JSONB
- `created_at`: Timestamp

## Event Types

The system logs the following event types:
- `login`: User login
- `logout`: User logout
- `file_save`: File save operations
- `file_open`: File open operations
- `editor_change`: Content changes in the editor
- `text_selection`: Text selection events
- `toolbar_action`: Toolbar button clicks
- `comment_add`: Comment additions
- `comment_edit`: Comment edits
- `comment_delete`: Comment deletions
- `insight_view`: AI insight views
- `ai_interaction`: AI interactions
- `error`: Errors 