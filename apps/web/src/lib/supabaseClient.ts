import { createClient } from "@supabase/supabase-js";
import { environment } from "./env";
const env = environment.success ? environment.data : null;
// Auth only. All domain queries go through Express.
export const supabase =
  env?.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY
    ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;
