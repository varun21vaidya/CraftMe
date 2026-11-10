// The only place the Supabase client is created. Nothing outside src/api imports @supabase/* (ESLint enforces it).
import { createClient } from '@supabase/supabase-js';

const env = import.meta.env;

// Both values are public by design (the publishable key is limited by Row Level Security).
export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
