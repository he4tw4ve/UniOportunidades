import { checkServerIdentity, type PeerCertificate } from "node:tls";

// pg exposes the live socket through connection.stream. Isolate this internal
// access so a future driver change yields unknown, never a false TLS assurance.
export function inspectClientTls(client: unknown) {
  const value = client as {
    host?: string;
    ssl?: boolean | { rejectUnauthorized?: boolean };
    connection?: {
      stream?: {
        encrypted?: boolean;
        authorized?: boolean;
        getProtocol?: () => string | null;
        getCipher?: () => { standardName?: string; name?: string };
        getPeerCertificate?: () => PeerCertificate;
      };
    };
  };
  const stream = value.connection?.stream;
  const encrypted =
    typeof stream?.encrypted === "boolean" ? stream.encrypted : null;
  const certificateAuthorized =
    typeof stream?.authorized === "boolean" ? stream.authorized : null;
  const certificateVerificationEnabled =
    value.ssl === true ||
    (typeof value.ssl === "object" &&
      value.ssl !== null &&
      value.ssl.rejectUnauthorized !== false);
  let certificateHostnameValid: boolean | null = null;
  if (encrypted && value.host && stream?.getPeerCertificate) {
    try {
      certificateHostnameValid =
        checkServerIdentity(value.host, stream.getPeerCertificate()) ===
        undefined;
    } catch {
      certificateHostnameValid = false;
    }
  }
  return {
    encrypted,
    certificateAuthorized,
    certificateVerificationEnabled,
    certificateHostnameValid,
    protocol: stream?.getProtocol?.() ?? null,
    cipher:
      stream?.getCipher?.().standardName ?? stream?.getCipher?.().name ?? null,
    verified:
      encrypted === true &&
      certificateAuthorized === true &&
      certificateVerificationEnabled &&
      certificateHostnameValid === true,
  };
}
export function inspectPostgresTls(row?: {
  ssl: boolean | null;
  version: string | null;
  cipher: string | null;
  bits: number | null;
}) {
  return {
    rowPresent: !!row,
    ssl: row?.ssl ?? null,
    version: row?.version ?? null,
    cipher: row?.cipher ?? null,
    bits: row?.bits ?? null,
  };
}
