import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { parse } from "dotenv";
const problems = [];
const gitFiles = (args) =>
  execFileSync("git", ["ls-files", "-z", ...args], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
const tracked = gitFiles([]);
const source = [
  ...new Set(gitFiles(["--cached", "--others", "--exclude-standard"])),
];
if (
  tracked.some(
    (path) => /(^|\/)\.env($|\.)/.test(path) && !path.endsWith(".env.example"),
  )
)
  problems.push("Hay un archivo de entorno privado versionado.");
const files = [];
function walk(dir) {
  if (!existsSync(dir)) {
    problems.push(`Falta ${dir}; genera el build antes de auditar.`);
    return;
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(path);
    else files.push(path);
  }
}
walk("apps/web/src");
walk("apps/web/dist");
function envFiles(dir) {
  return readdirSync(dir)
    .filter(
      (name) =>
        /^\.env($|\.)/.test(name) && statSync(`${dir}/${name}`).isFile(),
    )
    .map((name) => ({
      path: `${dir}/${name}`,
      data: parse(readFileSync(`${dir}/${name}`)),
    }));
}
const serverEnvs = [
  ...envFiles("."),
  ...envFiles("apps/api"),
  { data: process.env },
];
const secretNames = [
  "DATABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DEMO_ADMIN_PASSWORD",
  "DEMO_STUDENT_PASSWORD",
  "DEMO_PUBLISHER_PASSWORD",
];
const secrets = serverEnvs.flatMap(({ data }) => {
  const values = secretNames.map((key) => data[key]);
  try {
    values.push(decodeURIComponent(new URL(data.DATABASE_URL).password));
  } catch {
    /* Unconfigured environment. */
  }
  return values.filter((value) => value && value.length >= 8);
});
const elevatedToken = (value) => {
  if (/sb_secret_[a-z\d_-]{20,}/i.test(value)) return true;
  return [...value.matchAll(/eyJ[a-z\d_-]+\.[a-z\d_-]+\.[a-z\d_-]+/gi)].some(
    ([token]) => {
      try {
        const role = JSON.parse(
          Buffer.from(token.split(".")[1], "base64url"),
        ).role;
        return typeof role === "string" && role !== "anon";
      } catch {
        return false;
      }
    },
  );
};
const publicNames = new Set([
  "VITE_API_BASE_URL",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
]);
for (const { path, data } of [
  ...envFiles("apps/web"),
  {
    path: "entorno de proceso VITE",
    data: Object.fromEntries(
      Object.entries(process.env).filter(([key]) => key.startsWith("VITE_")),
    ),
  },
]) {
  if (
    Object.entries(data).some(
      ([key, value]) =>
        value &&
        ((key.startsWith("VITE_") && !publicNames.has(key)) ||
          /DATABASE|SERVICE_ROLE|SECRET|PASSWORD/.test(key) ||
          elevatedToken(value)),
    )
  )
    problems.push(
      `Configuración privada o variable pública desconocida en ${path}.`,
    );
}
const readable = (path) =>
  existsSync(path) &&
  !/\.(png|jpe?g|gif|ico|pdf|woff2?|zip)$/i.test(path) &&
  !path.endsWith("package-lock.json");
for (const file of new Set([...source, ...files].filter(readable))) {
  const content = readFileSync(file, "utf8");
  if (secrets.some((value) => content.includes(value)))
    problems.push(`Se detectó un secreto local de servidor en ${file}.`);
  if (elevatedToken(content))
    problems.push(`Posible clave privilegiada en ${file}.`);
  if (/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content))
    problems.push(`Posible clave privada en ${file}.`);
  if (files.includes(file) && /supabase\s*\.\s*(from|rpc)\s*\(/.test(content))
    problems.push(`Consulta directa de negocio en ${file}.`);
}
console.log(
  JSON.stringify({
    trackedEnvironmentSafe: !problems.length,
    sourceFilesChecked: source.length,
    frontendFilesChecked: files.length,
    findings: problems,
  }),
);
if (problems.length) process.exitCode = 1;
