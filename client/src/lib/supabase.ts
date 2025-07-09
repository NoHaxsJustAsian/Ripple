// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// For Vite projects, use import.meta.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Log environment variables for debugging (remove in production)
console.log('Supabase URL exists:', !!supabaseUrl);
console.log('Supabase Anon Key exists:', !!supabaseAnonKey);

// Create and export the client - this line must be executed
// Use fallbacks for development to prevent errors
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

// Add warning AFTER export to ensure the client is always created
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing Supabase environment variables. File saving and user authentication disabled. Using placeholder values for development.'
  );
}

// Types for your database schema
export interface User {
  id: string;
  prolific_id: string;
  created_at: string;
}

export interface CommentType {
  id: string;
  file_id: string;
  user_id: string;
  content: string;
  position_start: number;
  position_end: number;
  created_at: string;
  updated_at: string;
  resolved?: boolean;
  // Additional fields for suggestions
  is_ai_feedback?: boolean;
  issue_type?: string;
  original_text?: string;
  suggested_text?: string;
  explanation?: string;
  completion_info?: Array<{
    action: 'active' | 'dismissed' | 'replaced' | 'accepted' | 'ignored';
    timestamp: string;
    reason?: string;
  }>;
  completion_status?: string; // Computed column from database
}

export interface FileData {
  id: string;
  user_id: string;
  content: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface UserEvent {
  id: string;
  user_id: string;
  file_id?: string;
  event_type: string;
  event_data: any;
  created_at: string;
} 