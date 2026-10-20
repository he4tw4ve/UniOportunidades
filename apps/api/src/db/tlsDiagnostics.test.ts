import { describe, it, expect } from "vitest";
import { inspectClientTls, inspectPostgresTls } from "./tlsDiagnostics.js";
function client(host = "pooler.example.test") {
  return {
    host,
    ssl: { rejectUnauthorized: true },
    connection: {
      stream: {
        encrypted: true,
        authorized: true,
        getProtocol: () => "TLSv1.3",
        getCipher: () => ({ standardName: "TLS_AES_256_GCM_SHA384" }),
        getPeerCertificate: () =>
          ({ subjectaltname: "DNS:pooler.example.test" }) as never,
      },
    },
  };
}
describe("Límites de TLS del driver y PostgreSQL", () => {
  it("detecta TLS validado al pooler aunque el backend no use TLS", () => {
    expect(inspectClientTls(client()).verified).toBe(true);
    expect(
      inspectPostgresTls({
        ssl: false,
        version: null,
        cipher: null,
        bits: null,
      }).ssl,
    ).toBe(false);
  });
  it("no confunde una fila ausente con ssl=false", () => {
    expect(inspectPostgresTls().ssl).toBeNull();
    expect(inspectPostgresTls().rowPresent).toBe(false);
  });
  it("rechaza hostname incorrecto aunque el socket indique CA autorizada", () => {
    expect(inspectClientTls(client("wrong.example.test")).verified).toBe(false);
  });
  it("no asegura TLS si cambia la estructura interna del driver", () => {
    expect(inspectClientTls({}).encrypted).toBeNull();
    expect(inspectClientTls({}).verified).toBe(false);
  });
  it("no aprueba un socket sin verificar certificado o con validación desactivada", () => {
    const c = client();
    c.connection.stream.authorized = false;
    expect(inspectClientTls(c).verified).toBe(false);
    c.connection.stream.authorized = true;
    c.ssl.rejectUnauthorized = false;
    expect(inspectClientTls(c).verified).toBe(false);
  });
});
