import { defineConfig, loadEnv } from "vite";
import { assertPublicEnvironment } from "./src/lib/publicEnv";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
export default defineConfig(({ mode }) => {
  const root = fileURLToPath(new URL(".", import.meta.url));
  assertPublicEnvironment({
    ...loadEnv(mode, root, "VITE_"),
    ...Object.fromEntries(
      Object.entries(process.env).filter(([key]) => key.startsWith("VITE_")),
    ),
  });
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": { target: "http://127.0.0.1:3001", changeOrigin: true },
      },
    },
  };
});
