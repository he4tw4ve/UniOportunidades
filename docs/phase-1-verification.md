# Verificación de Fase 1

Entorno: Windows, Node 25.0.0, npm 11.6.2. Sin archivos `.env` con credenciales de Supabase/PostgreSQL en el workspace. No se modificaron los archivos de especificación o SQL de referencia.

## Archivos y funcionalidad

- `db/migrations/001_init.sql`: copia exacta del SQL de referencia, 13 tablas con RLS y privilegios de clientes revocados.
- `apps/api/src/db`: pool, transacciones, ProfilesRepository, OrganizationsRepository, runner de migración e inicialización SQL idempotente de fixtures.
- `apps/api/src/modules/auth`, `middleware`: gateway Supabase real, adaptación demo por expediente, login por email, verificación getUser, perfil/rol desde DB, rate limit, validación Zod y autorización.
- `scripts/migrate.ts`, `scripts/seed-demo.ts`, `apps/api/src/cli`: comandos de servidor, provisión idempotente de Auth y SQL.
- `apps/web/src/features/auth`, `features/perfil`, `lib`: formularios de login/registro, sesión persistida/renovada mediante Supabase, perfil validado por API, guards y cierre de sesión local. Portada y navegación actualizadas a Fase 1.
- `.env.example`, README, arquitectura, API y guía detallada de Supabase actualizados.

No se cambió el modelo de negocio. Se documentó la tabla técnica `private_app.schema_migrations` que permite controlar versión/checksum sin reejecutar los triggers/constraints de referencia. No se añadieron políticas de acceso desde navegador.

## Comandos realmente ejecutados

| Comando                                                                                | Resultado final                                                                        |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `npm.cmd install @supabase/supabase-js pg express-rate-limit -w @unioportunidades/api` | Dependencias instaladas                                                                |
| `npm.cmd install @supabase/supabase-js -w @unioportunidades/web`                       | SDK Auth instalado                                                                     |
| `npm.cmd install -D @types/pg @electric-sql/pglite -w @unioportunidades/api`           | Tipos y PostgreSQL embebido instalados                                                 |
| `npm.cmd install -D @testing-library/react jsdom -w @unioportunidades/web`             | Herramientas de pruebas React instaladas; auditoría de instalación: 0 vulnerabilidades |
| `npm.cmd run format`                                                                   | Formato aplicado                                                                       |
| `npm.cmd test`                                                                         | 53 pruebas correctas: 42 API/SQL, 11 web                                               |
| `npm.cmd run build`                                                                    | TypeScript API y web + Vite correctos                                                  |
| `npm.cmd run lint`                                                                     | Sin errores ni advertencias                                                            |
| `npm.cmd run format:check`                                                             | Sin diferencias                                                                        |
| `npm.cmd run db:migrate`                                                               | Salida 1 esperada: falta DATABASE_URL; no se intentó migración remota                  |
| `npm.cmd run seed:demo`                                                                | Salida 1 esperada: faltan variables de seed; no se crearon cuentas remotas             |
| `npm.cmd run dev`                                                                      | Web y API arrancan sin credenciales; servicios temporales detenidos tras verificar     |
| `Invoke-RestMethod http://127.0.0.1:5173/api/v1/health`                                | Proxy correcto: phase=1, authentication=not_configured, database=not_configured        |
| `Invoke-WebRequest http://127.0.0.1:5173/iniciar-sesion -UseBasicParsing`              | HTTP 200                                                                               |
| `Invoke-RestMethod http://127.0.0.1:3001/api/v1/auth/yo`                               | HTTP 503 NOT_CONFIGURED, sin simular sesión                                            |
| `Get-FileHash docs/02_ESQUEMA_SQL.sql` y `Get-FileHash db/migrations/001_init.sql`     | SHA-256 idéntico: E6982A7CAD36E98AADF0296C2A9CF8198A41EFA0C0F333A6ACC1D670D7F267AA     |
| `rg -n '\.(from\|rpc)\(' apps/web/src`                                                 | Sin consultas directas de negocio mediante Supabase en la web                          |

Build/tests se ejecutaron con permisos fuera del sandbox por las restricciones de lectura de Vite/esbuild ya identificadas en Fase 0. El build conserva advertencias de comentarios PURE de Zod y de bundle principal de aproximadamente 719 kB (212 kB gzip); no impiden compilar.

## Casos cubiertos

Supertest valida acceso de los tres roles a `/auth/yo`, 401 sin token/token incorrecto, 403 entre roles y para cuentas inactivas/correo sin confirmar, rechazo de campos de rol/uid, errores genéricos de credenciales, login demo y por email, límites de intentos y alta ligada al uid verificado. Un test del SDK real intercepta su transporte y comprueba la llamada `/auth/v1/user` con Bearer token, sin confiar en metadata.

PostgreSQL embebido ejecuta la migración íntegra, comprobación de checksum/reejecución, las 13 tablas con RLS, cero políticas de cliente y denegación a authenticated. Ejecuta repetidamente el seed SQL y comprueba conteos, preservación de permisos revocados/estados posteriores, joins de perfil/carrera/organización y transacciones de alta con rollback. La provisión Auth se prueba con un adaptador simulado: repeticiones no recrean usuarios ni cambian contraseñas, y se rechazan cuentas ajenas al seed.

React se prueba con jsdom: validación de sesión persistida, bloqueo mientras carga, rol estudiantil rechazado en admin, limpieza al cerrar sesión, descarte de respuestas antiguas, onboarding y errores de API. No equivale a una prueba visual en navegador ni a un flujo real de correo/Supabase.

## Pendiente externo y límite de fase

Configurar el proyecto siguiendo `docs/supabase-setup.md`: URL y clave pública en ambos entornos; DATABASE_URL solo servidor; service_role y contraseñas ficticias solo para seed. Habilitar Email/confirmación, redirects, SMTP si se probará registro de correo real. Después ejecutar migración y seed contra el proyecto y hacer la comprobación manual de los tres roles.

No se migró ni sembró un proyecto Supabase remoto ni se comprobó login/correo real porque no hay credenciales configuradas. Esto se informa como pendiente externo, no como prueba satisfactoria. No se implementaron operaciones de revisión de organizaciones, cambios de permisos, publicación o catálogo de las fases siguientes. La ejecución se detiene en Fase 1.
