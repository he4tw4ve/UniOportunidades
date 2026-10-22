# Arquitectura · Fase 8

El rediseño de Fase 6 conserva backend y contratos. CatalogLayout y WorkspaceLayout comparten shell autenticado con navegación por perfil y permisos, cuenta compacta y drawer nativo. Se reutilizan los formularios de Auth dentro de HomePage con sus URLs directas; `/mi-perfil` abre la cuenta mediante redirección compatible. ReviewInbox consume listados existentes y PublisherOverview muestra publicaciones propias. Dialog/ConfirmDialog centralizan foco, Escape, errores y confirmación; las mutaciones siguen validándose exclusivamente en API. Tokens y contraste se documentan en `docs/phase-6-uiux.md`. No hay nuevas dependencias ni cambios del esquema o seed.

Fase 5 añade AdminRepository con indicadores obtenidos en una única consulta SQL parametrizada. Las rutas conservan los guards de sesión/perfil/rol. No cambia modelo ni migraciones. Los indicadores de publicaciones usan las mismas reglas de visibilidad que el catálogo y vencimientos en Hermosillo.

Playwright usa exclusivamente `e2e/server.ts`, no el servidor de producción: PostgreSQL embebido efímero, esquema y seed reales, adaptador Auth local y puertos separados. No se carga `.env` de API. Las variables web se sobrescriben solo en el proceso de prueba. El adaptador no se importa desde producción y sus tokens no son aceptados por Supabase. Las peticiones del harness se serializan para preservar límites de transacción en su única conexión; no acredita concurrencia real entre conexiones PostgreSQL remotas.

En Fase 4, `CatalogRepository` centraliza la visibilidad de listado, detalle y ciudades. SQL parametrizado, orden permitido explícitamente y snapshot REPEATABLE READ de solo lectura para total/página. No cambia modelo, migraciones ni RLS. Personalización derivada del perfil validado. Las rutas de catálogo preceden al detalle anterior en producción.

React consume contratos Zod por API, sin consultas de negocio directas a Supabase ni ofertas simuladas. La URL conserva filtros y página al volver del detalle. Tarjetas, filtros laterales en escritorio y diálogo nativo en móvil, carga/error/vacío y contacto externo. No se modificaron confirmaciones ni paneles administrativos. Pruebas con PostgreSQL embebido y React/jsdom; comprobación adicional de repositorios contra PostgreSQL remoto de solo lectura. Esta última no equivale a una prueba completa de Auth/navegador.

React usa Supabase exclusivamente para Auth. Las consultas de negocio van a Express con Bearer token. Express verifica cada identidad mediante `getUser(token)` y consulta `perfiles`/membresía/permisos en PostgreSQL con `pg`. Ni el rol del JWT/metadata ni un header/body elegido por cliente autoriza operaciones. El cliente web solo presenta el rol obtenido de `/auth/yo`; los guards visuales complementan la autorización real del servidor.

`AuthGateway` aísla Supabase. `StudentIdentityProvider` y `DemoStudentIdentityProvider` resuelven expediente ficticio a email interno sin acoplar ofertas a un futuro proveedor de identidad autorizado. El password login usa un cliente Auth por petición, sin persistencia/autorefresh en servidor, para no compartir sesiones entre usuarios. La API no recibe la contraseña universitaria real.

`ProfilesRepository` hace joins parametrizados de perfil, carrera, organización y permisos. `OrganizationsRepository` registra uid verificado + perfil publisher + organización pending + membresía + evento de auditoría dentro de una transacción y serializa altas del mismo usuario con advisory lock. No hay endpoints para elevar roles ni mover membresías. La revisión administrativa y los permisos se implementan por separado en `OrganizationManagementRepository`.

`AuthProvider` usa `onAuthStateChange` como única fuente de inicialización (`INITIAL_SESSION`); no compite con una llamada inicial a `getSession`. Compara `session.user.id` para distinguir identidad y token: la misma identidad conserva perfil, UI y caché mientras el token vigente se publica inmediatamente en contexto. Cada evento revalida `/auth/yo` en segundo plano. Hay una petición en vuelo por generación; eventos repetidos se agrupan y un token más nuevo provoca una única comprobación posterior, descartando respuestas del token anterior. Cambiar identidad o cerrar sesión invalida la generación, limpia caché y retira el contenido anterior. El cleanup invalida peticiones pendientes. Un `INITIAL_SESSION` tardío no revierte un evento posterior.

Desde Fase 8 la revalidación solo conserva acceso ante fallo temporal si ya existe un perfil validado, el token no ha expirado y no han pasado cinco minutos desde la última comprobación exitosa de perfil. Un intervalo de 60 segundos comprueba el perfil sin desmontar la UI; renovar tokens no amplía esa vigencia de perfil. Se muestra aviso con reintento; se retira acceso al primer deadline entre `expires_at` y vigencia del perfil. Respuestas tardías no revierten ese bloqueo. No es un temporizador para esconder cargas. Una respuesta 401/403 bloquea y limpia datos; `PROFILE_REQUIRED` conserva onboarding. También se rechazan respuestas exitosas con perfil inactivo o identidad distinta. El cambio efectivo de rol, organización, estado o permisos limpia caché y remonta el árbol protegido. Refrescar el token de la misma cuenta conserva formularios y rutas montadas. `getSession` solo se usa para reintento explícito, con protección frente a cierres/cambios concurrentes. Cerrar sesión usa el scope local de Supabase y los eventos entre pestañas; no pretende revocar instantáneamente JWT de otros dispositivos. La API sigue verificando identidad/perfil/permisos en cada solicitud.

En Fase 7, `ProfilesRepository.list` usa un único statement parametrizado para total y página consistente, búsqueda literal por nombre/correo, rol y activo, proyección mínima y orden estable `created_at DESC,id`. `OrganizationManagementRepository.members` deriva el alcance desde la membresía del publicador autenticado y une solo los perfiles de esa organización. Permite lectura con organización pendiente/rechazada/suspendida, igual que la información propia existente; esto no concede permisos de publicación. No admite ID de organización ni acciones sobre miembros.

`OffersRepository.publisherSummary` agrega por organización autenticada en un único statement: última revisión, puntero publicado y hasta cinco oportunidades recientes. No hay consultas por fila ni descarga de todas las ofertas para contar. Los conteos y recientes comparten snapshot; una edición pendiente puede coexistir con una publicación activa. Definiciones exactas en `api.md`. No cambia SQL de aprobación, permisos ni versionado.

## Modelo y migraciones

No se modificó el modelo relacional. `db/migrations/001_init.sql` es una copia íntegra del SQL de referencia: 13 tablas de negocio, restricciones, índices, triggers, RLS y revocaciones de acceso cliente.

Se añade infraestructura fuera del modelo de negocio: `private_app.schema_migrations` guarda nombre, checksum y fecha de ejecución. Razón: los triggers/constraints del SQL original no se pueden repetir aunque algunas tablas usen IF NOT EXISTS; el runner transaccional evita reejecutar DDL y rechaza migraciones alteradas. El esquema técnico no es accesible por PUBLIC/anon/authenticated. Para nuevos cambios se crearán migraciones nuevas; no se alterará silenciosamente la referencia.

No hay políticas RLS para clientes. El pool privilegiado del servidor conserva acceso; las credenciales DB y la clave administrativa no se compilan en web. No se guardan contraseñas ni tokens en tablas de negocio/auditoría. Solo Auth gestiona credenciales.

## Seed y pruebas

El seed aprovisiona usuarios ficticios con clave administrativa y marca de propiedad en app_metadata; esto solo permite reconocer identidades del seed, nunca definir rol desde cliente. Reutiliza usuarios propios sin cambiar contraseña. La parte SQL es transaccional, con claves estables, y no reinicializa permisos/estados ya modificados. Ante fallo entre Auth y DB se puede repetir: no existe transacción distribuida entre ambos servicios.

Supertest prueba HTTP real con gateway Auth simulado; PostgreSQL embebido ejecuta el SQL de migración completo, RLS, repositorios y fixtures. Esto valida SQL/lógica local, no sustituye la comprobación contra un proyecto Supabase configurado. Las pruebas no requieren acceso a servicios externos ni credenciales reales.

## Organizaciones en Fase 2

`OrganizationManagementRepository` concentra listado, lectura propia/detalle, decisiones, permisos y elegibilidad para publicar. El router aplica sesión/perfil/rol; las escrituras vuelven a comprobar el administrador activo en la transacción. No se añade ningún campo, tabla ni política RLS al esquema existente.

Las decisiones y reemplazos de permisos bloquean la fila de organización con `FOR UPDATE`. La versión opaca se compara dentro del bloqueo para impedir sobrescrituras concurrentes. Las decisiones insertan `revisiones_organizacion`; las decisiones y los cambios de permisos insertan `eventos_auditoria`. Un fallo revierte todos los cambios. La versión proviene de `updated_at` existente: no hay nueva migración.

La comprobación de publicación deriva membresía, estado y permisos del servidor. Se vuelve a leer el conjunto de permisos después de adquirir el bloqueo para observar revocaciones que hayan terminado mientras esperaba. La creación/envío de Fase 3 comprueba elegibilidad bajo el mismo bloqueo y transacción que la escritura, para impedir carreras entre validar y publicar.

Las lecturas de detalle/historial usan snapshot repetible de solo lectura. El listado está paginado y filtrado por parámetros SQL. El panel publicador se actualiza al recuperar foco, cada 30 segundos o manualmente; muestra organización, permisos, decisiones y auditoría propios. La UI administrativa exige confirmar las mutaciones y presenta estados de carga, vacío, error y conflicto; no concede permisos por estado visual ni ofrece reactivaciones no previstas.

## Ofertas en Fase 3

`OffersRepository` implementa ofertas, versiones, carreras por revisión y decisiones finales usando el esquema existente. No se añade migración, columna o política RLS. La parte nueva del router usa los guards de Auth/roles existentes y valida todos los cuerpos con Zod.

Cada escritura vuelve a comprobar perfil activo/rol, obtiene la organización de la membresía o de la oferta, bloquea organización y después oferta y comprueba permisos dentro de la transacción. Este orden es compatible con los bloqueos de revisión/permisos de organizaciones. Los cambios que esperan un bloqueo releen revisiones y permisos después de adquirirlo. La versión opaca y el índice único de revisiones abiertas impiden sobrescrituras y borradores paralelos; la restricción de dictamen único impide dos decisiones finales.

Las revisiones usan un token opaco construido con timestamps existentes y xmin (versión MVCC del registro). Permite detectar escrituras concurrentes sin cambiar el modelo. El cliente no reconstruye ni interpreta el token. Guardar modifica únicamente draft. Enviar congela pending. Aprobar registra dictamen, estado approved y puntero publicado en una transacción, con auditoría. Rechazar no altera el puntero anterior.

La lectura del detalle visible une exclusivamente ofertas.revision_publicada_id con una revisión approved de esa oferta, estado open, organización approved y fecha vigente según el día de Hermosillo. No usa MAX(numero_version) ni la última revisión para contenido público. Es el mínimo necesario para verificar la publicación en Fase 3; el catálogo con filtros/personalización/paginación es Fase 4.

Las correcciones de administrador crean una revisión nueva y pasan por el mismo flujo interno de aprobación, dentro de una transacción con auditoría adicional. Se rechazan si hay draft/pending para no borrar ni sustituir trabajo abierto. Cierre y archivo conservan historia; solo la publicación inicial abre una oferta automáticamente. Los fallos de dictamen/auditoría revierten toda la operación.

Las pruebas usan HTTP Supertest y PostgreSQL embebido, incluido el esquema completo, más React/jsdom. Se prueban doble decisión, revisión paralela, guardados desactualizados, propiedad, permiso revocado, suspensión, vigencia local, cierre, archivo y rollback. No se ejecutaron migraciones/seed ni escrituras en Supabase remoto durante Fase 3.

## Controles de Fase 8

Se conserva la arquitectura de una API Express y cliente React. El adaptador Auth aplica deadline de 8 s y separa indisponibilidad 503 de rechazo real 401. `createPool` exige TLS verify-full fuera de localhost, acota consultas/locks y descarta clientes cuyo rollback falla. El proceso tiene límites HTTP y cierre acotado; no añade servicios externos.

La API limita el origen y preflight explícitamente, JSON sin compresión a 100 kB, y configura proxy únicamente mediante allowlist de IP/CIDR. Login y registro de organización tienen cupos separados en memoria. Los límites del signup directo de Supabase siguen siendo responsabilidad del proveedor; no se pretende cubrirlo con Express.

`publicEnv.ts` comparte validación pura entre cliente y configuración Vite. Un build con clave privada/token de usuario o variable VITE desconocida falla antes de transformar fuentes. `audit-security.mjs` revisa también fuentes nuevas, configuración local/CI y artefactos; sus canarios sintéticos y el build negativo se prueban con Node test. La clave de servicio no participa en el runtime normal de API ni en web.

El informe `security-review.md` distingue pruebas embebidas y verificación remota: transacción read-only de metadatos, TLS cliente verificado, RLS en las 13 tablas y cero grants/políticas cliente observados. No acredita Auth/SMTP reales, proxy de hosting ni concurrencia entre conexiones remotas. Health devuelve estado neutral, sin fase codificada.
