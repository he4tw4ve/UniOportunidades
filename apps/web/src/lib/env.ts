import { webEnvSchema } from "./publicEnv";
export { webEnvSchema } from "./publicEnv";
export const environment = webEnvSchema.safeParse(import.meta.env);
