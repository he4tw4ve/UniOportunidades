import type { SupabaseClient } from "@supabase/supabase-js";
import { demoAccounts } from "../../db/seed.js";
type Admin = Pick<SupabaseClient["auth"]["admin"], "listUsers" | "createUser">;
export async function provisionDemoUsers(
  admin: Admin,
  passwords: { admin: string; student: string; publisher: string },
) {
  const users = new Map<string, { id: string; owned: boolean }>();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error("No se pudieron consultar usuarios demo.");
    for (const user of data.users)
      if (user.email)
        users.set(user.email.toLowerCase(), {
          id: user.id,
          owned: user.app_metadata?.seed_owner === "unioportunidades-v1",
        });
    if (data.users.length < 1000) break;
  }
  const ids = new Map<string, string>();
  for (const account of demoAccounts) {
    const existing = users.get(account.email);
    if (existing && !existing.owned)
      throw new Error("Existe un correo demo que no pertenece a este seed.");
    if (existing) {
      ids.set(account.email, existing.id);
      continue;
    }
    const { data, error } = await admin.createUser({
      email: account.email,
      password: passwords[account.role],
      email_confirm: true,
      app_metadata: { seed_owner: "unioportunidades-v1" },
    });
    if (error || !data.user)
      throw new Error("No se pudo crear una cuenta demo.");
    ids.set(account.email, data.user.id);
  }
  return ids;
}
