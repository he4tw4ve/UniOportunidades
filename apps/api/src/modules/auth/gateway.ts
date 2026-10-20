import { createClient } from "@supabase/supabase-js";
import type { VerifiedUser } from "../../shared/types.js";
export interface Tokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}
export interface AuthGateway {
  verify(token: string): Promise<VerifiedUser | null>;
  signIn(
    email: string,
    password: string,
  ): Promise<{ user: VerifiedUser; session: Tokens } | null>;
}
export function createAuthGateway(url: string, key: string): AuthGateway {
  const options = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  };
  const verifier = createClient(url, key, options);
  return {
    async verify(token) {
      const { data, error } = await verifier.auth.getUser(token);
      if (error || !data.user) return null;
      return {
        id: data.user.id,
        email: data.user.email,
        emailConfirmed: !!data.user.email_confirmed_at,
      };
    },
    async signIn(email, password) {
      // Per-request client: never share mutable password-auth sessions across users.
      const client = createClient(url, key, options);
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (error || !data.session || !data.user) return null;
      return {
        user: {
          id: data.user.id,
          email: data.user.email,
          emailConfirmed: !!data.user.email_confirmed_at,
        },
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_in: data.session.expires_in,
          token_type: data.session.token_type,
        },
      };
    },
  };
}
