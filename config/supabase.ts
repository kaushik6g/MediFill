import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Keys are loaded from environment variables (.env file, git-ignored).
// See .env.example for the required variable names.
const SUPABASE_URL      = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,         // persist the session token across reloads
    persistSession: true,          // was false — this caused logout on every reload
    autoRefreshToken: true,        // silently refresh the JWT before it expires
    detectSessionInUrl: false,
  },
});
