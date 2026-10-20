# UniOportunidades · Fase 0

Prototipo académico independiente de servicio social y prácticas profesionales. Interfaz en español, sin afiliación ni integración oficial con UNISON.

## Requisitos y arranque

Node.js >= 22.12 y npm. Probado localmente con Node 25.0.0 y npm 11.6.2. En PowerShell usa `npm.cmd` si la política bloquea `npm.ps1`.

Desde la raíz:

```powershell
npm.cmd ci
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
npm.cmd run dev
```

Abre http://127.0.0.1:5173. API: http://127.0.0.1:3001/api/v1/health. Detén ambos procesos con Ctrl+C. Los archivos `.env` son opcionales en Fase 0: los valores locales predeterminados permiten abrir la UI sin credenciales. No sobrescribas un `.env` existente. Vite reenvía `/api` al puerto 3001; si cambias ese puerto, ajusta `apps/web/vite.config.ts`.

## Comandos

```powershell
npm.cmd run build
npm.cmd test
npm.cmd run lint
npm.cmd run format:check
npm.cmd run format
npm.cmd run start -w @unioportunidades/api
npm.cmd run preview -w @unioportunidades/web
```

Los dos últimos requieren build previo; inicia la API en otra terminal para consultar el healthcheck. La vista previa usa puerto 4173 y no tiene proxy: para usarla configura `VITE_API_BASE_URL=http://127.0.0.1:3001/api/v1` antes del build y `WEB_ORIGIN=http://127.0.0.1:4173` al iniciar API. Producción requiere servir la SPA con fallback a `index.html`, proxy `/api` y HTTPS; aún no hay despliegue configurado.

## Estructura y alcance

- `apps/web`: React, Vite, TypeScript, React Router, TanStack Query, Tailwind 4, configuración shadcn/ui y componente Button con Radix/CVA. Incluye React Hook Form y Zod para las siguientes fases.
- `apps/api`: Express, TypeScript, validación de entorno Zod, CORS explícito, healthcheck y manejo uniforme de errores.
- `db/migrations`, `scripts`, módulos de negocio: espacios reservados sin migraciones ni semillas ejecutables todavía.
- `docs/01_ESPECIFICACION_CODEX.md` y `docs/02_ESQUEMA_SQL.sql`: fuentes de verdad intactas.

Solo `/`, `/iniciar-sesion` y `/registro-organizacion` son públicas. Estas últimas muestran información de disponibilidad, sin recoger credenciales. El catálogo, perfil y áreas de publicador/administrador están preparados detrás de un guard que deniega acceso mientras no exista autenticación. Los layouts privados están implementados y no se habilita un selector ficticio de roles. No hay ofertas, métricas, usuarios o sesiones simuladas.

El healthcheck mide exclusivamente la disponibilidad HTTP. `database: not_connected` y `authentication: not_implemented` son límites explícitos, incluso si se rellenan variables. Las rutas de negocio todavía devuelven 404.

## Variables

API: `PORT` y `WEB_ORIGIN` tienen valores locales predeterminados. `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` están reservadas para Fase 1 y permanecen vacías. Las URL y el puerto se validan al arrancar; los errores solo indican nombres de variables, nunca valores secretos.

Web: `VITE_API_BASE_URL` permite una ruta relativa o URL HTTP(S); `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` son valores públicos futuros. La UI avisa ante configuración inválida. Nunca poner `DATABASE_URL` ni claves administrativas en variables `VITE_*`. No usar contraseñas universitarias reales.

## Pendiente: Fase 1

Crear migración versionada a partir del SQL de referencia; configurar PostgreSQL/Supabase de desarrollo y RLS; integrar Auth, perfil y rol obtenidos por API; implementar middleware backend con verificación real de tokens; login por expediente ficticio, registro/verificación de publicador y seed idempotente. Agregar pruebas de los tres roles y respuestas 403. No se han creado cuentas ni conectado servicios remotos.

No incluye postulaciones, pagos, chat, currículums ni integración institucional. Las fases siguientes requieren una nueva instrucción.
