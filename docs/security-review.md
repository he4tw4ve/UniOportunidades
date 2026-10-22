# Revisión de seguridad y fiabilidad · Fase 8

Fecha: 21 de octubre de 2026. Revisión acotada de UniOportunidades para una demostración pública controlada de portafolio. No es un pentest profesional ni una certificación. No se ejecutaron las fases 9–10, despliegues, migraciones, seeds, cambios de configuración o escrituras de datos remotos.

## Metodología y alcance

Se leyó la Fase 8 de `04_PLAN_FINAL_FASES_7_A_10.md`, se inventarió el árbol actual y se revisaron código/pruebas de Fase 7, sin asumir ubicaciones anteriores. Se conservaron los cambios de Fase 7 que ya estaban en el árbol de trabajo. No se creó un commit de cierre sin revisión manual.

1. Inspección de todos los routers y guards, repositorios/SQL, validación Zod, catálogo, sesión React, entorno, pool, errores/logs, scripts y bundles.
2. Matriz HTTP negativa sobre PostgreSQL embebido usando esquema/seed reales y Auth simulado. Incluye los 28 métodos/rutas protegidos y prueba adicional de registro/login.
3. Pruebas de regresión existentes para permisos por tipo, organización, propiedad, transacciones, moderación, versiones, concurrencia/conflictos y directorios; pruebas nuevas de límites HTTP, proxy, Auth, TLS, rollback, sesión y secretos.
4. Chromium con UI y API reales del harness local: datos efímeros, Auth local, dos pestañas y fallos de red/autorización simulados. Nunca carga las credenciales remotas de API.
5. `npm audit` contra el registro, compilación y escaneo de secretos/fuentes/bundle. Tres pruebas adicionales ejercitan los detectores con canarios sintéticos y rechazo real del build antes de transformación.
6. Inspección local de configuración sin imprimir valores; una consulta remota de metadatos PostgreSQL dentro de `BEGIN READ ONLY`, finalizada con `ROLLBACK`.

## Cobertura de autorización

`apps/api/src/security.test.ts` contiene una matriz de 28 métodos/rutas. Para cada entrada prueba token ausente/inválido/caducado simulado (401), correo sin confirmar, perfil faltante y roles no permitidos (403). Otra prueba deshabilita temporalmente cada rol en la base efímera y exige `ACCOUNT_DISABLED` en toda la matriz. Verifica que respuestas protegidas no se almacenen en caché.

| Endpoints existentes                                                                                      | Acceso y evidencia                                                                                                                                |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/auth/yo`                                                                                            | Token verificado, correo confirmado y perfil activo; metadata/cookies/cabeceras de rol no autorizan                                               |
| POST `/auth/estudiantes/iniciar-sesion`, `/auth/correo/iniciar-sesion`                                    | Credenciales genéricas, campos estrictos, comprobación de perfil y limitador compartido de login; no registro público de estudiantes/admin        |
| POST `/organizaciones/registro`                                                                           | UID/correo verificados; cuerpo no puede escoger rol/estado/organización; transacción y bloqueo contra duplicación; limitador de registro separado |
| GET `/organizaciones/mia`                                                                                 | Organización derivada de la membresía propia                                                                                                      |
| GET `/publicador/miembros`, `/publicador/resumen`                                                         | Solo publicador activo; la organización no se recibe del cliente; parámetros ajenos rechazados                                                    |
| GET/POST `/publicador/ofertas` y GET `/publicador/ofertas/:id`                                            | Rol, membresía, organización y propiedad; POST exige autorización del tipo en la transacción                                                      |
| POST `/publicador/ofertas/:id/nueva-revision`                                                             | Propiedad, versión, permisos/estado y ausencia de otra revisión abierta                                                                           |
| PATCH `/publicador/revisiones/:id`, POST `/publicador/revisiones/:id/enviar`                              | Revisión ligada a oferta propia, permisos/estado y versión; solo draft se modifica/envía                                                          |
| PATCH `/publicador/ofertas/:id/estado`                                                                    | Propiedad/versión; reapertura exige publicación vigente y permisos; publicador no archiva                                                         |
| GET `/admin/metricas`, `/admin/usuarios`                                                                  | Exclusivamente admin activo; usuarios con campos mínimos y filtros/paginación acotados                                                            |
| GET `/admin/organizaciones`, `/admin/organizaciones/:id`                                                  | Exclusivamente admin activo                                                                                                                       |
| POST `/admin/organizaciones/:id/decision`, PUT `/admin/organizaciones/:id/permisos`                       | Admin revalidado dentro de transacción; versión/bloqueo y auditoría; no autoaprobación                                                            |
| GET `/admin/ofertas`, `/admin/ofertas/:id`, `/admin/revisiones`, `/admin/revisiones/:id`                  | Exclusivamente admin activo; las revisiones privadas no son rutas de catálogo                                                                     |
| POST `/admin/revisiones/:id/decision`, `/admin/ofertas/:id/correccion`, PATCH `/admin/ofertas/:id/estado` | Admin activo y reglas de organización, permisos, versiones y auditoría bajo transacción                                                           |
| GET `/ofertas`, `/ofertas/:id`, `/catalogos/filtros`, `/catalogos/carreras`                               | Perfil activo de cualquiera de los tres roles; contenido público solo desde el puntero publicado aprobado                                         |

Las pruebas intentan consultar/editar/enviar/clonar/cerrar IDs de oferta/revisión ajenos, escoger organización o rol mediante payload, cambiar headers de identidad, usar un publicador sin membresía y atacar búsquedas con SQL literal. Los errores no incluyen datos de la otra organización. Los directorios conservan los campos mínimos y aislamiento de Fase 7.

El catálogo une `revision_publicada_id` con una revisión approved perteneciente a la oferta, estado open, organización approved y fecha vigente en America/Hermosillo. Nunca usa la última revisión para contenido público. Las pruebas existentes contrastan título, contacto, ciudad, carreras y búsqueda de una edición pending frente a la publicada, y excluyen borradores, cerradas, archivadas, vencidas y punteros incorrectos. Chromium añade un borrador privado, comprueba que estudiante no lo lea, lo envía y verifica que siga sin aparecer en catálogo. El segundo envío devuelve 409 sin duplicar auditoría.

Los conflictos de aprobación/clonado/guardado/envío y rollback se prueban en la base embebida. Esto no acredita contención real entre conexiones remotas concurrentes: PGlite usa una sola conexión y el harness HTTP serializa las solicitudes para conservar límites transaccionales. La implementación conserva bloqueos, índices únicos y versiones del modelo existente.

## Hallazgos y correcciones

No se identificaron vulnerabilidades críticas/altas reproducibles en el alcance comprobado. Los hallazgos siguientes son de fiabilidad, controles preventivos y defensa adicional; no constituyen evidencia de una intrusión ni de exposición previa de secretos.

| ID / severidad            | Hallazgo                                                                                                                                                      | Corrección y evidencia                                                                                                                                                                                                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F8-01 · Media             | Renuevos de token podían extender continuamente la vigencia de un perfil sin comprobación exitosa cuando fallaba la API                                       | Revalidación cada 60 s y límite independiente de 5 min desde el último perfil validado; vence antes si expira el token. Nuevos tokens no extienden ese límite. React prueba renovación durante caída prolongada, bloqueo, limpieza de caché, reintento y revocación sin evento de token                                                  |
| F8-02 · Media             | Supabase Auth convertía errores de red/5xx en credenciales/token inválidos, retirando sesiones válidas por una caída temporal; sin deadline explícito         | Transporte Auth con deadline de 8 s; red/5xx → 503 `AUTH_UNAVAILABLE`, rechazo real → 401, límite del proveedor → 429; mensajes fijos sin detalles. API web con deadline de 15 s y señal de cancelación combinada. Tests de adaptador y Chromium 503 → UI conservada, 403 → acceso bloqueado                                             |
| F8-03 · Media, preventiva | TLS dependía de configurar correctamente una recomendación; una URL remota sin TLS era aceptada                                                               | Fuera de localhost se exige `sslmode=verify-full`; se rechazan TLS global desactivado, parámetros duplicados/ambiguos y override de host. No se modifica el `.env` real. Pool tests y comprobación TLS remota; configuración local ya usaba verify-full y CA                                                                             |
| F8-04 · Media             | Un fallo de rollback podía ocultar el error original y devolver al pool un cliente roto                                                                       | Se conserva el error original y se destruye el cliente si rollback falla; prueba específica. Pool acotado a 10 conexiones, adquisición 10 s, statement 15 s, consulta cliente 20 s, lock 5 s e idle-in-transaction 15 s                                                                                                                  |
| F8-05 · Media, preventiva | El chequeo en navegador de una clave privada no impedía que Vite la incrustase antes de fallar en runtime; el escaneo ignoraba archivos nuevos no versionados | Esquema público compartido con Vite: rechaza secretos/tokens de usuario y variables VITE desconocidas antes de transformar. Auditoría incluye archivos nuevos, configuración local/CI, contraseña DB, claves privilegiadas y bundle. Canarios prueban detección sin imprimir secretos y build negativo real sin tocar el bundle anterior |
| F8-06 · Baja              | Cuerpos >100 kB terminaban como 500; compresión admitida innecesariamente                                                                                     | JSON sin compresión, 413 `BODY_TOO_LARGE`, 415 `UNSUPPORTED_ENCODING`, JSON inválido 400; pruebas sin exponer contenido                                                                                                                                                                                                                  |
| F8-07 · Baja              | Faltaba configuración explícita de confianza de proxy y el mismo cupo de registro afectaba login                                                              | `TRUST_PROXY` opt-in por IP/CIDR conocido, default false; rechaza true, saltos y redes /0. Login 10/15 min por IP; registro de organización 5/15 min separado. Tests con proxies permitidos/no permitidos y cadenas XFF/Forwarded manipuladas                                                                                            |
| F8-08 · Baja              | CORS reflejaba el origen permitido incluso ante origen ajeno; no había cabeceras defensivas uniformes                                                         | Origen exacto, rechazo 403 de ajenos/null, preflight acotado a métodos/Authorization/Content-Type, sin cookies; no-store, nosniff, no-referrer, DENY y CSP de API. CORS ya impedía la lectura desde otro origen; el rechazo explícito mejora claridad y evita trabajo innecesario                                                        |
| F8-09 · Baja              | Health codificaba una fase de desarrollo y faltaban ejemplos de entorno citados en README                                                                     | Se retira `phase`; health conserva status/service/authentication/database, sin secretos y con 503 al fallar datos. Contrato Zod/tests/docs actualizados; se añaden dos `.env.example` vacíos, sin credenciales                                                                                                                           |

Los logs siguen usando mensajes y códigos fijos. Las excepciones del driver/proveedor no se publican como stack, SQL, URL ni cuerpo. Se añaden códigos transitorios de conexión/lock a respuestas 503. `server.ts` acota recepción de requests a 30 s, headers a 10 s y keep-alive a 5 s; cierre SIGINT/SIGTERM una sola vez, conexiones ociosas cerradas, plazo de 10 s para conexiones HTTP restantes y cierre de pool con error saneado. Se revisó ese flujo en código; no se simuló una caída de proceso sobre Supabase.

La configuración de confianza se basa en la [documentación oficial de Express](https://expressjs.com/en/guide/behind-proxies/): el proxy permitido debe eliminar/sobrescribir cabeceras entrantes. No se habilita confianza global ni se asume un hosting. La combinación SSL/connectionString se revisó con [node-postgres](https://node-postgres.com/features/ssl), conservando CA y verificación de hostname. El verificador sigue usando [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser); no autoriza decodificando metadata del JWT.

## Dependencias y secretos

Se ejecutaron `npm.cmd ls --depth=0` y `npm.cmd audit --json --fetch-retries=0 --fetch-timeout=15000`. Resultado del registro: **0 avisos** info/low/moderate/high/critical, 503 dependencias inventariadas por npm (sus categorías se solapan). Incluye las dependencias de desarrollo. No se ejecutó `npm audit fix` ni se modificó el lockfile sin necesidad. Este resultado es una fotografía de avisos conocidos, no un análisis exhaustivo del código de cada dependencia. Metodología del comando: [npm audit](https://docs.npmjs.com/cli/v11/commands/npm-audit).

Contexto: React/Vite cliente estático y API Express; no se añadieron SSR/RSC, ejecución de código de usuarios, subida de archivos ni fetch de URLs de contacto desde el servidor. El build conserva avisos conocidos de anotaciones de Zod y chunk de JS >500 kB, sin fallo de compilación. No se introdujeron dependencias nuevas, Redis, microservicios, SSO o monitorización compleja.

`audit:security` examina fuentes versionadas y nuevas, secretos conocidos de entornos locales/CI, claves privadas/privilegiadas, variables públicas y artefactos web. Los valores nunca se imprimen: solo rutas de hallazgos. No revisa exhaustivamente historial Git, proveedores externos ni secretos desconocidos/ofuscados. La aplicación permite únicamente claves publishable o legacy anon en web; la clave administrativa sigue reservada al seed explícito del servidor, de acuerdo con [Supabase API keys](https://supabase.com/docs/guides/api/api-keys).

## Comprobaciones realmente realizadas en Supabase

Se inspeccionaron primero archivos locales, sin mostrar sus valores: TLS verify-full, CA declarada, confianza de proxy sin configurar, claves publishable en API/web y ausencia de variables privadas en el entorno web.

Después se ejecutó un programa Node ESM por stdin (`node --input-type=module -`) con la conexión local existente y el pool compilado. Consultó exclusivamente `pg_class`, `pg_namespace`, `pg_policies`, `has_table_privilege`, modo read-only e información local del socket TLS. El alcance se limitó a las 13 tablas nombradas en la migración, sin leer perfiles, correos, ofertas u otros datos de negocio.

Resultado real saneado:

```json
{
  "remoteReadOnly": true,
  "tlsVerified": true,
  "expectedTables": 13,
  "foundTables": 13,
  "tablesWithRls": 13,
  "anonTablePrivileges": 0,
  "authenticatedTablePrivileges": 0,
  "policies": 0
}
```

La transacción comenzó con `BEGIN READ ONLY` y terminó con `ROLLBACK`. Se verificó cifrado, autorización de certificado y hostname del tramo Node → destino configurado. Esto no afirma TLS del tramo interno pooler → PostgreSQL, configuración del proveedor Auth ni seguridad del futuro hosting. No hubo migraciones, seeds, cambios de roles/políticas, escrituras remotas ni operaciones administrativas de Auth.

No se probaron login/refresh/revocación reales con usuarios de Supabase, SMTP/confirmación, CAPTCHA, límites del proveedor, acceso directo a Data API con un JWT remoto, navegación móvil real o proxies de hosting. Los tests de getUser usan el SDK real con transporte simulado; un token expirado/rechazado del fixture no sustituye una comprobación criptográfica contra la instancia.

## Comandos ejecutados y resultados finales

```powershell
$env:VITEST_MAX_WORKERS='2'
npm.cmd test
npm.cmd run test:e2e
npm.cmd run build
npm.cmd run lint
npm.cmd run format
npm.cmd run format:check
npm.cmd run audit:security
node --test scripts/audit-security.test.mjs
npm.cmd audit --json --fetch-retries=0 --fetch-timeout=15000
npm.cmd ls --depth=0
```

También se ejecutaron suites dirigidas API/frontend con `npm.cmd exec -w ... -- vitest run ... --maxWorkers 2` y el programa de metadatos remotos por stdin descrito arriba.

| Verificación                                                   | Resultado final                                                  |
| -------------------------------------------------------------- | ---------------------------------------------------------------- |
| `npm.cmd test`                                                 | 247/247: 158 API + 89 web; dos workers                           |
| `npm.cmd run test:e2e`                                         | 13/13 satisfactorias en Chromium                                 |
| `npm.cmd run build`                                            | API/web compiladas; JS 859.69 kB, 252.26 kB gzip; CSS 35.90 kB   |
| `npm.cmd run lint`                                             | Sin errores ni advertencias                                      |
| `npm.cmd run format:check`                                     | Formato correcto                                                 |
| `npm.cmd run audit:security`                                   | 159 fuentes y 62 fuentes/artefactos web revisados; findings: []  |
| `node --test scripts/audit-security.test.mjs`                  | 3/3; el build con clave sintética es rechazado intencionadamente |
| `npm.cmd audit --json --fetch-retries=0 --fetch-timeout=15000` | 0 vulnerabilidades reportadas por npm                            |
| Supabase, metadatos read-only                                  | TLS verificado, 13/13 RLS, 0 grants cliente y 0 políticas        |

Incidencias intermedias: el sandbox impidió el arranque de esbuild en el baseline web y el primer acceso al registro; se usaron permisos del entorno para los controles locales/red de lectura. Un `npm audit --json` con reintentos predeterminados agotó el tiempo de red; la consulta acotada posterior sí terminó con 0 avisos. Una prueba nueva detectó un `new URL` sin catch en refinamiento de entorno; se corrigió y repitieron las pruebas. No se presentan esos fallos como verificaciones satisfactorias. Las tres pruebas del detector generan y eliminan canarios locales; no alteran los `.env` del usuario ni datos remotos.

## Riesgos aceptados y comprobaciones pendientes

- **Una instancia pequeña:** limitador IP/en memoria, no distribuido; reiniciar borra contadores. Usuarios tras NAT comparten cupo; ataques distribuidos, DDoS y escalado horizontal no están resueltos. No se justifica Redis para este alcance.
- **Proxy real:** aún no elegido ni desplegado. Configurar solo sus IPs/CIDRs y verificar sobrescritura de XFF/Host/Proto antes de habilitar TRUST_PROXY. Un allowlist incorrecto puede agrupar usuarios o permitir spoofing. No usar el ajuste numérico del harness E2E en producción.
- **Registro y Auth:** el alta de credenciales se hace directamente con Supabase Auth; el limitador Express cubre login por API y registro de la organización, no el signup directo del proveedor. Revisar límites/CAPTCHA/SMTP y URLs exactas en Supabase antes de abrir registro público. No se cambiaron esas opciones.
- **Sesión:** la API vuelve a verificar token, perfil, rol y permisos en cada petición. La UI puede conservar un perfil validado durante una caída temporal un máximo de 5 min, siempre dentro del token. Un 401/403 confirmado bloquea antes. No se promete revocación propia instantánea de JWT en otros dispositivos; Supabase define sus sesiones y expiración.
- **XSS y almacenamiento:** Supabase mantiene tokens en almacenamiento del navegador. React renderiza texto, contacto HTTPS tiene noopener/noreferrer y no hay HTML arbitrario; una extensión maliciosa o un XSS futuro sigue siendo un riesgo. El servidor de frontend deberá configurar su propia CSP/HTTPS en Fase 9; las cabeceras añadidas aquí son de la API.
- **DB privilegiada:** la autorización de negocio depende del backend, con RLS cliente cerrada. No exponer DATABASE_URL/service keys. La comprobación remota acredita su estado observado, no que permanezca así después de cambios externos.
- **Validación restante:** repetir manualmente dos pestañas, refresh, cierre/revocación, estado inactivo y offline/recuperación con cuentas reales de demo; probar flujo Auth/SMTP y Data API; comprobar HTTPS/proxy/fallback y redes cuando se haga Fase 9 con autorización. Las pruebas concurrentes de varias conexiones remotas y una auditoría profesional quedan fuera de esta revisión.

No se avanzó al despliegue ni a la entrega v1.0. La Fase 8 termina con esta evidencia, los controles corregidos y las verificaciones externas pendientes explícitas.
