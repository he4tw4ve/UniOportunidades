import type { AuthGateway } from "./gateway.js";
import type { ProfilesRepository } from "../../db/profilesRepository.js";
import { AppError } from "../../shared/errors.js";
export interface StudentIdentityProvider {
  resolve(expediente: string): Promise<{ id: string; email: string } | null>;
}
export class DemoStudentIdentityProvider implements StudentIdentityProvider {
  constructor(private profiles: Pick<ProfilesRepository, "findDemoIdentity">) {}
  resolve(expediente: string) {
    return this.profiles.findDemoIdentity(expediente);
  }
}
export const invalidCredentials = () =>
  new AppError(
    401,
    "INVALID_CREDENTIALS",
    "No se pudo iniciar sesión con esas credenciales.",
  );
export class AuthService {
  constructor(
    private gateway: AuthGateway,
    private profiles: Pick<ProfilesRepository, "findById">,
    private students: StudentIdentityProvider,
  ) {}
  async studentLogin(expediente: string, password: string) {
    const identity = await this.students.resolve(expediente);
    // Also call Auth for unknown expedientes; generic output and same provider path.
    const result = await this.gateway.signIn(
      identity?.email ?? "inexistente@demo.unioportunidades.test",
      password,
    );
    if (
      !identity ||
      !result ||
      result.user.id !== identity.id ||
      !result.user.emailConfirmed
    )
      throw invalidCredentials();
    const profile = await this.profiles.findById(result.user.id);
    if (!profile?.activo || profile.rol !== "student")
      throw invalidCredentials();
    return result.session;
  }
  async emailLogin(email: string, password: string) {
    const result = await this.gateway.signIn(email, password);
    if (!result || !result.user.emailConfirmed) throw invalidCredentials();
    const profile = await this.profiles.findById(result.user.id);
    // A confirmed new publisher may log in before completing organization registration.
    if (profile && (!profile.activo || profile.rol === "student"))
      throw invalidCredentials();
    return result.session;
  }
}
