# UniOportunidades · Fase 5

Prototipo académico independiente, en español y sin integración oficial con UNISON. Implementa autenticación Supabase, organizaciones y permisos, borradores y versiones de oportunidades, envío y moderación, cierre/reapertura/archivo y correcciones administrativas auditadas. Nunca uses contraseñas universitarias reales.

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
npm.cmd run audit:security
npm.cmd exec -- playwright install chromium
npm.cmd run test:e2e
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
- [Fase 3: versiones, moderación y verificación](docs/phase-3-verification.md).
- [Fase 5: criterios de aceptación y verificaciones](docs/phase-5-verification.md).
- [Guion de demostración y cuentas](docs/demo.md).
- La migración `db/migrations/001_init.sql` copia íntegramente `docs/02_ESQUEMA_SQL.sql`. El runner lleva historial y checksum en `private_app.schema_migrations`.
- `apps/api/src/db`: pool, transacciones, repositorios, migración y fixtures. `scripts/`: entradas server-only. `apps/web/src/features/auth`: login, alta y sesión.

`/publicador/panel` y `/publicador/organizacion` muestran estado, permisos y motivos de revisión reales. `/admin/panel` y `/admin/organizaciones` muestran el listado con filtros y paginación; el detalle permite aprobar/rechazar/suspender, conceder/revocar permisos y consultar historial. Las decisiones y permisos exigen confirmación en UI y se validan en API; los formularios desactualizados reciben 409.

Fase 3 no cambia el esquema ni requiere una migración adicional. No se ejecutaron migraciones, seeds ni escrituras en Supabase remoto durante esta fase. Si la migración inicial aún no está aplicada, los paneles mostrarán un error hasta completar la configuración de Fase 1.

`/publicador/ofertas` lista las oportunidades propias y distingue última edición y versión publicada. `/publicador/ofertas/nueva` crea un borrador y `/publicador/ofertas/:id/editar` permite guardar, enviar, crear nuevas revisiones y consultar rechazos. `/admin/revisiones` presenta la cola; `/admin/ofertas/:id` permite comparar contenido, decidir, cerrar/reabrir/archivar o corregir mediante nueva versión auditada. La API vuelve a verificar propietario, rol, organización y permisos en cada escritura.

`/ofertas` ofrece tarjetas, búsqueda, filtros combinables por tipo, carrera, departamento, modalidad y ciudad, orden y paginación. Estudiantes ven inicialmente su carrera y pueden elegir «Ver todas». Publicadores y administradores también navegan el catálogo. Listado y detalle leen PostgreSQL mediante Express: solo revisión publicada aprobada, oferta abierta, organización aprobada y fecha vigente. Una revisión pendiente no reemplaza lo publicado. Contacto externo, sin solicitudes internas. Los datos ficticios del seed no representan vacantes reales.

Consulta [Fase 4: archivos, comandos y resultados](docs/phase-4-verification.md). No cambia el modelo ni requiere migraciones nuevas. Se verificaron consultas remotas de solo lectura; no se modificaron datos ni flujos de confirmación o paneles administrativos.

Fase 5 mantiene rutas y diseño: `/admin/panel` presenta indicadores reales de ofertas pendientes, organizaciones pendientes, publicadas vigentes y vencimientos en 7 días. `/admin/usuarios` es un listado de consulta sin edición de roles. Se añadieron foco de teclado, destino accesible del enlace de salto y validación previa al envío de ofertas. No requiere migración ni nuevas variables de producción. El seed conserva datos existentes; los nuevos escenarios por carrera solo se crean al insertar ofertas nuevas.

`test:e2e` usa puertos 3100/3101 y base efímera con Auth de pruebas, sin credenciales de Supabase. La auditoría necesita build previo; compara secretos locales con fuentes y bundle sin imprimirlos. No es una certificación de seguridad ni sustituye revisar credenciales ya compartidas. La confirmación SMTP y el flujo remoto deben comprobarse siguiendo el guion manual; no se ejecutaron escrituras remotas durante Fase 5.

Producción requiere HTTPS, fallback SPA a `index.html`, proxy `/api`, CORS explícito y despliegue configurado. El limitador actual es por IP/en memoria; detrás de proxy o con varias réplicas debe configurarse confianza del proxy y almacenamiento compartido antes de desplegar. No se ha desplegado ni conectado un proyecto remoto durante esta implementación.
