import { readFileSync, readdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { parse } from "dotenv";
const problems = [];
const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean);
if (
  tracked.some(
    (p) => /(^|\/)\.env($|\.)/.test(p) && !p.endsWith(".env.example"),
  )
)
  problems.push("Hay un archivo de entorno privado versionado.");
const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(path);
    else files.push(path);
  }
}
walk("apps/web/src");
walk("apps/web/dist");
const env = existsSync("apps/api/.env")
  ? parse(readFileSync("apps/api/.env"))
  : {};
const secrets = [
  "DATABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DEMO_ADMIN_PASSWORD",
  "DEMO_STUDENT_PASSWORD",
  "DEMO_PUBLISHER_PASSWORD",
]
  .map((key) => env[key])
  .filter((value) => value && value.length >= 8);
for (const file of files) {
  const text = readFileSync(file, "utf8");
  if (secrets.some((value) => text.includes(value)))
    problems.push(`Se detectó un secreto de servidor en ${file}.`);
  if (/supabase\s*\.\s*(from|rpc)\s*\(/.test(text))
    problems.push(`Consulta directa de negocio en ${file}.`);
}
for (const file of tracked.filter((p) => !p.endsWith("package-lock.json"))) {
  const text = readFileSync(file, "utf8");
  if (/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))
    problems.push(`Posible clave privada en ${file}.`);
}
console.log(
  JSON.stringify({
    trackedEnvironmentSafe: !problems.length,
    frontendFilesChecked: files.length,
    findings: problems,
  }),
);
if (problems.length) process.exitCode = 1;
