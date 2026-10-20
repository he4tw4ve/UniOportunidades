# UniOportunidades · Fase 2

Prototipo académico independiente, en español y sin integración oficial con UNISON. Implementa autenticación Supabase, perfiles/roles PostgreSQL, registro de publicadores, revisión de organizaciones y permisos transaccionales con historial y auditoría. Nunca uses contraseñas universitarias reales.

## Preparar y ejecutar

Requiere Node >= 22.12 y npm. En PowerShell usa `npm.cmd` si se bloquea `npm.ps1`.

```powershell
npm.cmd ci
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
```

No sobrescribas archivos `.env` existentes. Completa las variables siguiendo [la guía exacta de Supabase](docs/supabase-setup.md). Después, desde la raíz:

```powershell
npm.cmd run db:migrate
npm.cmd run seed:demo
npm.cmd run dev
```

Abre http://127.0.0.1:5173. API: http://127.0.0.1:3001/api/v1/health. Ctrl+C detiene ambos servicios. El seed necesita `DEMO_SEED_ENABLED=true` y tres contraseñas ficticias de al menos 12 caracteres. No pone contraseñas en tablas de negocio ni en logs. Tras sembrar puedes quitar la clave administrativa y desactivar el seed: la API usa la clave pública de Auth y la conexión PostgreSQL privilegiada.

Sin variables puedes abrir la portada: el acceso informa que falta configuración, los endpoints Auth responden 503 y no hay datos ficticios en memoria. Si solo rellenas parte de las tres variables de API (`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`), el arranque falla indicando nombres de variables faltantes.

## Cuentas FICTICIAS del seed

| Acceso                                   | Identificador                            | Contraseña elegida en servidor |
| ---------------------------------------- | ---------------------------------------- | ------------------------------ |
| Estudiante                               | `DEMO-001`, `DEMO-002`, `DEMO-003`       | `DEMO_STUDENT_PASSWORD`        |
| Administración                           | `admin@demo.unioportunidades.test`       | `DEMO_ADMIN_PASSWORD`          |
| Publicador aprobado para prácticas       | `publicador1@demo.unioportunidades.test` | `DEMO_PUBLISHER_PASSWORD`      |
| Publicador pendiente                     | `publicador2@demo.unioportunidades.test` | `DEMO_PUBLISHER_PASSWORD`      |
| Publicador aprobado para servicio social | `publicador3@demo.unioportunidades.test` | `DEMO_PUBLISHER_PASSWORD`      |

El seed confirma exclusivamente estas cuentas de demostración con la API administrativa de Auth; no requieren correo ni SMTP. Volver a ejecutarlo reutiliza identidades marcadas como propias, no cambia contraseñas ni eleva perfiles existentes, no duplica entidades y conserva cambios posteriores de permisos/estados. Si cambias una contraseña del `.env` después de crear la cuenta, no se actualiza automáticamente en Auth.

## Comandos disponibles

```powershell
npm.cmd run build
npm.cmd test
npm.cmd run lint
npm.cmd run format:check
npm.cmd run format
npm.cmd run start -w @unioportunidades/api
npm.cmd run preview -w @unioportunidades/web
```

Build compila API y web, incluido el código de migración/seed del servidor. Tests ejecuta Vitest, Supertest y PostgreSQL embebido (PGlite), sin credenciales ni red. La vista previa necesita build previo: configura `VITE_API_BASE_URL=http://127.0.0.1:3001/api/v1` antes del build y `WEB_ORIGIN=http://127.0.0.1:4173` al iniciar la API en otra terminal. Para desarrollo Vite reenvía `/api` a 3001; ajusta el proxy si cambias el puerto.

## Comprobación manual con Supabase configurado

1. Inicia sesión como cada estudiante con expediente DEMO; abre Mi perfil, comprueba su carrera ficticia y recarga la página.
2. Inicia sesión por correo como publicador y administrador; comprueba rol, organización y área correspondiente. No hay selector de roles.
3. Con estudiante, intenta `/admin/panel` y `/publicador/panel`: acceso restringido. Las APIs administrativas responden 403 aunque manipules el navegador.
4. Cierra sesión y verifica que ya no puedes acceder a Mi perfil.
5. Para alta nueva usa un correo propio con SMTP configurado: confirma el correo, inicia sesión y completa la organización. Queda pendiente, sin permisos. Reintentar el POST no duplica el perfil.

## Alcance y documentación

- [Supabase, variables, RLS y diagnóstico](docs/supabase-setup.md).
- [Contratos API y códigos de error](docs/api.md).
- [Arquitectura y decisiones del modelo](docs/architecture.md).
- [Fase 2: flujos, pruebas y límites](docs/phase-2-verification.md).
- La migración `db/migrations/001_init.sql` copia íntegramente `docs/02_ESQUEMA_SQL.sql`. El runner lleva historial y checksum en `private_app.schema_migrations`.
- `apps/api/src/db`: pool, transacciones, repositorios, migración y fixtures. `scripts/`: entradas server-only. `apps/web/src/features/auth`: login, alta y sesión.

`/publicador/panel` y `/publicador/organizacion` muestran estado, permisos y motivos de revisión reales. `/admin/panel` y `/admin/organizaciones` muestran el listado con filtros y paginación; el detalle permite aprobar/rechazar/suspender, conceder/revocar permisos y consultar historial. Las decisiones y permisos exigen confirmación en UI y se validan en API; los formularios desactualizados reciben 409.

Fase 2 no cambia el esquema ni requiere una migración adicional. No se ejecutaron migraciones, seeds ni escrituras en Supabase remoto durante esta fase. Si la migración inicial aún no está aplicada, los paneles mostrarán un error hasta completar la configuración de Fase 1.

El catálogo y la creación/moderación de ofertas conservan páginas que indican que están pendientes. `POST /publicador/ofertas` aplica el bloqueo real de estado/permiso; si está autorizado devuelve 501 indicando que la creación pertenece a Fase 3, sin insertar ofertas. Hay fixtures SQL para fases futuras; no se presentan como vacantes reales ni como funcionalidades terminadas. No hay postulaciones, pagos, chat, currículums, SSO real ni consultas de negocio desde el navegador.

Producción requiere HTTPS, fallback SPA a `index.html`, proxy `/api`, CORS explícito y despliegue configurado. El limitador actual es por IP/en memoria; detrás de proxy o con varias réplicas debe configurarse confianza del proxy y almacenamiento compartido antes de desplegar. No se ha desplegado ni conectado un proyecto remoto durante esta implementación.
