// Never expose driver messages, detail, stack, query or connection parameters:
// these may contain passwords, URLs or user supplied values.
const explanations: Record<string, string> = {
  ENOENT:
    "No se pudo leer un archivo requerido (certificado CA o archivo de migración). Comprueba que exista y que su ruta sea accesible.",
  ERR_INVALID_URL:
    "DATABASE_URL no tiene un formato de URL válido. Revisa el formato localmente sin copiar su contenido en logs.",
  ENOTFOUND:
    "No se pudo resolver el servidor PostgreSQL. Comprueba la cadena de Connect y si el proyecto está activo.",
  EAI_AGAIN: "La resolución DNS falló temporalmente.",
  ENETUNREACH:
    "La red no puede alcanzar el servidor. Si usas conexión directa IPv6 sin soporte IPv6, usa Session pooler (IPv4).",
  EHOSTUNREACH: "No se puede alcanzar el servidor PostgreSQL desde esta red.",
  ECONNREFUSED:
    "El servidor rechazó la conexión. Comprueba el modo y puerto copiados desde Connect.",
  ETIMEDOUT:
    "La conexión PostgreSQL agotó el tiempo de espera. Comprueba conectividad y restricciones de red.",
  SELF_SIGNED_CERT_IN_CHAIN:
    "La cadena TLS incluye una CA no reconocida. Configura el certificado CA oficial de Supabase con sslrootcert; conserva sslmode=verify-full.",
  DEPTH_ZERO_SELF_SIGNED_CERT:
    "El certificado TLS no tiene una CA de confianza. Configura la CA oficial; no desactives la verificación.",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE:
    "No se pudo verificar la cadena TLS. Configura el certificado CA oficial con sslrootcert.",
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY:
    "Falta el certificado CA emisor. Configura el certificado oficial con sslrootcert.",
  ERR_TLS_CERT_ALTNAME_INVALID:
    "El hostname no coincide con el certificado TLS. Copia el hostname exacto de Connect.",
  CERT_HAS_EXPIRED:
    "El certificado TLS ha expirado. Revisa el certificado configurado y la fecha del sistema.",
  "28P01":
    "PostgreSQL rechazó la contraseña. Usa la contraseña de Database (no una API key) y codifica sus caracteres reservados en la URL.",
  "28000":
    "PostgreSQL rechazó la identidad o el acceso. Revisa usuario, proyecto y modo de conexión en Connect.",
  "3D000":
    "La base de datos indicada no existe. Usa el nombre de base de datos mostrado en Connect.",
  "42501":
    "El rol PostgreSQL no tiene permisos suficientes. Usa la conexión privilegiada de servidor indicada en la guía.",
  "42P07":
    "Ya existe una tabla o índice del esquema. Revisa si aplicaste el SQL fuera del runner; no borres objetos para reintentar.",
  "42710":
    "Ya existe un trigger, rol o restricción. El esquema pudo haberse creado fuera del historial de migraciones.",
  "42P01":
    "Falta una tabla requerida. Comprueba que sea un proyecto Supabase con auth.users y que el esquema esté preparado.",
  "42601": "PostgreSQL detectó un error de sintaxis en la migración.",
  "57014": "PostgreSQL canceló una consulta por tiempo de espera.",
  "55P03": "PostgreSQL agotó la espera de un bloqueo.",
  "57P01": "PostgreSQL está reiniciando la conexión.",
  "57P02": "PostgreSQL no está disponible temporalmente.",
  "57P03": "PostgreSQL no acepta conexiones temporalmente.",
  "53300": "PostgreSQL alcanzó su límite de conexiones.",
  "08001": "No se pudo establecer la conexión PostgreSQL.",
  "08003": "La conexión PostgreSQL no está disponible.",
  "08006": "La conexión PostgreSQL se interrumpió.",
};
export function safeDatabaseError(error: unknown): {
  code: string;
  message: string;
} {
  const value =
    error && typeof error === "object"
      ? (error as {
          code?: unknown;
          message?: unknown;
          errors?: unknown[];
          cause?: unknown;
        })
      : {};
  const code =
    typeof value.code === "string" && /^[A-Z0-9_]{2,60}$/.test(value.code)
      ? value.code
      : undefined;
  if (code && explanations[code]) return { code, message: explanations[code] };
  // Match driver text internally, but emit only fixed safe messages.
  if (typeof value.message === "string") {
    if (/timeout|timed out/i.test(value.message))
      return { code: "CONNECTION_TIMEOUT", message: explanations.ETIMEDOUT };
    if (/tenant or user not found/i.test(value.message))
      return {
        code: "POOLER_IDENTITY",
        message:
          "El pooler no reconoce el proyecto/usuario. Copia el usuario completo y el servidor desde Session pooler en Connect.",
      };
    if (/migración aplicada cambió/i.test(value.message))
      return {
        code: "MIGRATION_CHECKSUM",
        message:
          "El checksum difiere de la migración aplicada. No edites ni vuelvas a aplicar manualmente esa versión.",
      };
  }
  if (value.errors?.length) return safeDatabaseError(value.errors[0]);
  if (value.cause) return safeDatabaseError(value.cause);
  return {
    code: "DATABASE_ERROR",
    message:
      "Fallo PostgreSQL no clasificado. No se muestra el mensaje del driver porque podría contener secretos.",
  };
}
