import { createClient } from '@supabase/supabase-js';

// Create a single supabase client for interacting with the database
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for our database schema
export interface User {
  id: string;
  prolific_id: string;
  created_at: string;
}

export interface CommentType {
  id: string;
  text: string;
  from: number;
  to: number;
  createdAt: string;
  resolved?: boolean;
}

export interface FileData {
  id: string;
  user_id: string;
  content: string;
  title: string;
  comments?: CommentType[];
  created_at: string;
  updated_at: string;
}

export interface UserEvent {
  id: string;
  user_id: string;
  event_type: string;
  event_data: any;
  created_at: string;
} 