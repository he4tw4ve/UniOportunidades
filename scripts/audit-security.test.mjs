import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
const source = "scripts/.phase8-audit-canary.txt";
const envFile = "apps/api/.env.phase8-audit-canary";
function run() {
  const result = spawnSync(process.execPath, ["scripts/audit-security.mjs"], {
    encoding: "utf8",
  });
  return { ...result, report: JSON.parse(result.stdout) };
}
test("la auditoría detecta un secreto local en un archivo aún no versionado, sin imprimirlo", () => {
  const canary = "canary-" + randomUUID();
  try {
    writeFileSync(envFile, `DEMO_ADMIN_PASSWORD=${canary}`);
    writeFileSync(source, canary);
    const result = run();
    assert.equal(result.status, 1);
    assert.ok(result.report.findings.some((value) => value.includes(source)));
    assert.ok(!(result.stdout + result.stderr).includes(canary));
  } finally {
    unlinkSync(source);
    unlinkSync(envFile);
  }
});
test("la auditoría detecta una clave privilegiada sintética en texto nuevo", () => {
  try {
    const payload = Buffer.from(
      JSON.stringify({ role: "service_role" }),
    ).toString("base64url");
    writeFileSync(source, `eyJhbGciOiJub25lIn0.${payload}.fixture`);
    const result = run();
    assert.equal(result.status, 1);
    assert.ok(result.report.findings.some((value) => value.includes(source)));
    assert.ok(!result.stdout.includes(payload));
  } finally {
    unlinkSync(source);
  }
});
test("Vite rechaza una clave privada antes de transformar fuentes y no la imprime", () => {
  const canary = "sb_secret_" + randomUUID().replaceAll("-", "");
  const before = readFileSync("apps/web/dist/index.html", "utf8");
  const result = spawnSync(
    process.execPath,
    ["../../node_modules/vite/bin/vite.js", "build"],
    {
      cwd: "apps/web",
      encoding: "utf8",
      env: { ...process.env, VITE_SUPABASE_ANON_KEY: canary },
    },
  );
  assert.equal(result.status, 1);
  assert.ok(
    (result.stdout + result.stderr).includes("Configuración pública inválida"),
  );
  assert.ok(!(result.stdout + result.stderr).includes(canary));
  assert.ok(!result.stdout.includes("transforming"));
  assert.equal(readFileSync("apps/web/dist/index.html", "utf8"), before);
});
