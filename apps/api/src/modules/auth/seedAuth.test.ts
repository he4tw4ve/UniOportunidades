import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { provisionDemoUsers } from "./seedAuth.js";
import { demoAccounts } from "../../db/seed.js";
describe("Provisión idempotente de Auth", () => {
  it("solo crea cuentas ficticias propias y no cambia contraseñas al repetir", async () => {
    const users: {
      id: string;
      email: string;
      app_metadata: Record<string, string>;
    }[] = [];
    const createUser = vi.fn(
      async (input: {
        email: string;
        app_metadata: Record<string, string>;
      }) => {
        const user = {
          id: String(users.length + 1),
          email: input.email,
          app_metadata: input.app_metadata,
        };
        users.push(user);
        return { data: { user }, error: null };
      },
    );
    const admin = {
      listUsers: vi.fn(async () => ({ data: { users }, error: null })),
      createUser,
    } as unknown as SupabaseClient["auth"]["admin"];
    const passwords = {
      admin: "password-admin-demo",
      student: "password-student-demo",
      publisher: "password-publisher-demo",
    };
    const first = await provisionDemoUsers(admin, passwords),
      second = await provisionDemoUsers(admin, passwords);
    expect(first).toEqual(second);
    expect(first.size).toBe(7);
    expect(createUser).toHaveBeenCalledTimes(7);
    for (const [input] of createUser.mock.calls) {
      expect(input.email.endsWith("@demo.unioportunidades.test")).toBe(true);
      expect(input.app_metadata).toEqual({ seed_owner: "unioportunidades-v1" });
    }
  });
  it("no adopta una cuenta preexistente ajena al seed", async () => {
    const createUser = vi.fn();
    const admin = {
      listUsers: async () => ({
        data: {
          users: [
            { id: "external", email: demoAccounts[0].email, app_metadata: {} },
          ],
        },
        error: null,
      }),
      createUser,
    } as unknown as SupabaseClient["auth"]["admin"];
    await expect(
      provisionDemoUsers(admin, { admin: "a", student: "b", publisher: "c" }),
    ).rejects.toThrow("no pertenece");
    expect(createUser).not.toHaveBeenCalled();
  });
});
