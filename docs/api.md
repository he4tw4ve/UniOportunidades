# Contratos API · Fase 8

Base: `/api/v1`. Respuesta `{data,error,meta}`. Healthcheck devuelve estado neutral, sin `phase`. Las rutas de Auth/perfil/roles llevan `Cache-Control: no-store`. Token solo en `Authorization: Bearer <access_token>`, nunca en URL. JSON no válido o campos extra en mutaciones se rechazan con 400.

## Indicadores de Fase 5

GET `/admin/metricas`, solo administrador con perfil activo. Devuelve `{ofertas_pendientes,organizaciones_pendientes,publicadas,proximas_a_vencer}` con enteros no negativos. Pendientes cuenta revisiones pending; organizaciones pendientes cuenta estado pending. Publicadas aplica exactamente las condiciones del catálogo. Próximas a vencer es el subconjunto con fecha entre hoy y hoy + 7 días inclusive, en Hermosillo. Una sola consulta SQL obtiene un snapshot coherente. No revela cuentas ni contenido. Sin token: 401; otros roles: 403.

GET `/admin/usuarios` ofrece el directorio paginado de solo lectura descrito abajo. Los timeouts de conexión conocidos responden 503 `SERVICE_UNAVAILABLE`, sin mensajes crudos ni secretos.

## Catálogo de Fase 4

Todos los endpoints requieren sesión validada y perfil activo, para los tres roles:

- GET `/ofertas`: `{items,total,page,pageSize,alcance,carrera_personalizada}`.
- GET `/ofertas/:id`: versión publicada, carreras, fechas y contacto externo; ocultas/inexistentes responden 404.
- GET `/catalogos/filtros`: `{carreras,departamentos,ciudades}` desde PostgreSQL; ciudades solo de ofertas visibles.

Query combinable: `tipo=social_service/internship`, `carrera_id=UUID`, `departamento_id=UUID`, `modalidad=in_person/hybrid/remote`, `ciudad`, `q` (título/descripción/organización, máximo 150 caracteres), `orden=recientes/fecha_limite`, `alcance=mine/all`, `page=1`, `pageSize=12` (máximo 48). Campos inválidos o desconocidos: 400. Búsqueda literal de comodines, orden estable por ID; recientes usa fecha de aprobación publicada.

Estudiantes con carrera usan inicialmente mine salvo filtro explícito de carrera/departamento; la carrera procede del perfil servidor. «Ver todas» usa all; otros roles siempre usan all. Ofertas de alcance all coinciden con cualquier carrera/departamento. `para_tu_carrera` también destaca coincidencias al explorar todas.

Listado y detalle comparten puntero publicado perteneciente a la oferta, revisión approved, oferta open, organización approved y fecha límite igual o posterior a hoy en America/Hermosillo. Una revisión pendiente no participa en contenido, búsqueda ni filtros. Sin solicitud interna.

| Método y ruta                           | Acceso                              | Contrato                                                                                                                                                           |
| --------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET `/health`                           | Público                             | `status`, `service`, `authentication:configured/not_configured`, `database:available/not_configured/unavailable`; DB se prueba con SELECT 1, caída DB devuelve 503 |
| POST `/auth/estudiantes/iniciar-sesion` | Público, limitado                   | `{expediente,password}`; resuelve email demo en DB, autentica con Auth, verifica perfil student activo; devuelve tokens para `setSession`                          |
| POST `/auth/correo/iniciar-sesion`      | Público, limitado                   | `{email,password}`; login publisher/admin o usuario confirmado sin perfil aún; no permite student ni inactivos                                                     |
| GET `/auth/yo`                          | Token validado + perfil activo      | Perfil `{id,nombre_completo,email,rol,activo,estudiante,organizacion}`; carrera y permisos desde SQL                                                               |
| POST `/organizaciones/registro`         | Token + correo confirmado, limitado | `{nombre_completo,nombre,tipo,email_contacto,descripcion?}`; 201 `{id,estado:pending,permisos:[]}`; no acepta uid/rol/estado/permisos                              |
| GET `/organizaciones/mia`               | Publisher activo                    | Organización del perfil y permisos                                                                                                                                 |
| GET `/admin/usuarios`                   | Admin activo                        | Directorio paginado mínimo `{items,total,page,pageSize}`; filtros de Fase 7                                                                                        |

El endpoint de login por email se añadió para mantener errores uniformes y limitador en Express. El signup sigue usando Supabase Auth en navegador con confirmación de email y límites del proveedor; no hay registro público de estudiantes o admin.

Tokens de login: `{access_token,refresh_token,expires_in,token_type}`. Credenciales inválidas: 401 `INVALID_CREDENTIALS`, mismo mensaje sin confirmar existencia de expediente/email. No se registran cuerpos ni tokens.

Sesión inválida/ausente: 401 `UNAUTHORIZED`. Correo sin confirmar: 403 `EMAIL_NOT_CONFIRMED`. Perfil faltante: 403 `PROFILE_REQUIRED` (salvo alta inicial de organización). Perfil inactivo: 403 `ACCOUNT_DISABLED`. Rol distinto: 403 `FORBIDDEN`. Alta repetida: 409 `ALREADY_REGISTERED`. Campos inválidos: 400 `VALIDATION_ERROR`. Límite de acceso: 429 `TOO_MANY_REQUESTS`. Configuración ausente: 503 `NOT_CONFIGURED`. Fallo interno: 500 genérico sin detalles de SQL/secretos.

Todo `/admin/*` y `/publicador/*` pasa primero por sesión/perfil/rol, incluso rutas aún no implementadas; las rutas autorizadas ausentes devuelven 404. `/ofertas/*` y `/catalogos/*` requieren sesión/perfil y consultan PostgreSQL para todos los roles.

## Organizaciones y permisos

El healthcheck conserva status/service/authentication/database; desde Fase 8 ya no incluye la fase de desarrollo. Los endpoints Auth conservan su formato de respuesta.

| Método/ruta                               | Acceso    | Datos                                                                                                                      |
| ----------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| GET `/admin/organizaciones`               | Admin     | Query `estado?`, `q?`, `page` (1 por defecto), `pageSize` (20 por defecto, máximo 50). Data: `{items,total,page,pageSize}` |
| GET `/admin/organizaciones/:id`           | Admin     | Detalle completo, permisos, `version`, `revisiones[]` y `auditoria[]`                                                      |
| POST `/admin/organizaciones/:id/decision` | Admin     | `{decision,comentario?,permisos?,version}`; decision `approved/rejected/suspended`; permisos solo al aprobar               |
| PUT `/admin/organizaciones/:id/permisos`  | Admin     | `{permisos:[social_service/internship],version}`; reemplaza conjunto sin duplicados; `[]` revoca todos                     |
| GET `/organizaciones/mia`                 | Publisher | Mismo detalle completo solo de su membresía, o null si no hay asociación                                                   |
| POST `/publicador/ofertas`                | Publisher | `{tipo,contenido}`; 201. Requiere aprobación y permiso del tipo, validados dentro de la transacción.                       |

Las respuestas de las mutaciones contienen el detalle actualizado. Los UUID, filtros y cuerpos se validan con Zod. `version` procede del detalle (`updated_at::text`); es opaco, no lo reconstruyas como fecha. Bajo bloqueo de fila se compara con la versión actual: diferencias producen 409 `STALE_ORGANIZATION` sin sobreescribir cambios ajenos. Añadir este campo no cambia el esquema; evita que dos administradores guarden formularios antiguos.

Transiciones permitidas: pending → approved/rejected; approved → suspended. Motivo obligatorio (no espacios) al rechazar/suspender. No hay reactivación de rejected/suspended en el flujo v1. Conflictos de transición: 409 `INVALID_TRANSITION`. Aprobar sin `permisos` no concede ninguno por defecto; una aprobación con permisos se guarda en la misma transacción.

Solo organizaciones approved reciben nuevos permisos. Se permite revocar los existentes en otros estados. Revocar un permiso no cierra ofertas existentes; suspender bloquea publicaciones nuevas aunque persistan filas de permisos. La consulta futura del catálogo deberá excluir organizaciones suspendidas conforme a la especificación.

Errores de publicación: 403 `ORGANIZATION_REQUIRED`, `ORGANIZATION_NOT_APPROVED` o `PUBLICATION_NOT_ALLOWED`. Nunca se toman estado, organización, permisos o actor del cuerpo del publicador. En Fase 3 se comprueban dentro de la misma transacción que crea/edita/envía una oferta.

## Ofertas y versiones · Fase 3

El endpoint preparatorio de Fase 2 que devolvía 501 se reemplaza por creación real. La lista de organizaciones y sus permisos conserva sus reglas.

| Método/ruta                                   | Acceso                       | Cuerpo o consulta                                                                                             |
| --------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
| GET `/publicador/ofertas`                     | Publisher                    | Query `tipo?`, `estado?`, `q?`, `page=1`, `pageSize=20` (máximo 50)                                           |
| GET `/publicador/ofertas/:id`                 | Publisher dueño              | Detalle con todas las revisiones, publicada, decisiones, auditoría y vigencia                                 |
| POST `/publicador/ofertas`                    | Publisher autorizado         | `{tipo,contenido}`; 201, crea oferta cerrada y revisión 1 draft, sin publicación                              |
| POST `/publicador/ofertas/:id/nueva-revision` | Publisher dueño autorizado   | `{version}` de oferta; 201, clona la última rechazada o la publicada a nuevo draft                            |
| PATCH `/publicador/revisiones/:id`            | Publisher dueño autorizado   | `{version,contenido}` de revisión; solo draft                                                                 |
| POST `/publicador/revisiones/:id/enviar`      | Publisher dueño autorizado   | `{version}` de revisión; valida y congela como pending                                                        |
| PATCH `/publicador/ofertas/:id/estado`        | Publisher dueño              | `{version,estado:open/closed}` de oferta                                                                      |
| GET `/admin/ofertas`                          | Admin                        | Mismos filtros y paginación, todas las organizaciones                                                         |
| GET `/admin/ofertas/:id`                      | Admin                        | Detalle completo                                                                                              |
| GET `/admin/revisiones`                       | Admin                        | Cola paginada de revisiones pending                                                                           |
| GET `/admin/revisiones/:id`                   | Admin                        | Detalle de la oferta a la que pertenece la revisión                                                           |
| POST `/admin/revisiones/:id/decision`         | Admin                        | `{version,decision:approved/rejected,comentario?}`; motivo obligatorio al rechazar                            |
| PATCH `/admin/ofertas/:id/estado`             | Admin                        | `{version,estado:open/closed/archived}`                                                                       |
| POST `/admin/ofertas/:id/correccion`          | Admin                        | `{version,contenido,comentario}`; motivo obligatorio; nueva versión y aprobación auditadas en una transacción |
| GET `/catalogos/carreras`                     | Cualquier perfil autenticado | Carreras activas y departamentos para el formulario                                                           |
| GET `/ofertas/:id`                            | Cualquier perfil autenticado | Solo contenido de `revision_publicada_id`, si open + approved + organización approved + fecha vigente         |

Las mutaciones devuelven detalle actualizado `{data,error:null,meta:null}`. Los listados devuelven `data:{items,total,page,pageSize}`. Los filtros de estado admiten draft/pending/approved/rejected para última revisión, y open/closed/archived para estado operativo. Cada elemento distingue `titulo`/`numero_version` de la edición y `titulo_publicado`/`version_publicada`.

`contenido` incluye `titulo`, `descripcion`, `actividades`, `requisitos`, `beneficios`, `modalidad` (in_person/hybrid/remote), `ciudad`, `estado_region`, `cupos`, `fecha_limite` (YYYY-MM-DD), `duracion_info`, `alcance_carreras` (all/selected), `carreras` (UUID[]), `contacto_nombre`, `contacto_email`, `contacto_url` e `contacto_instrucciones`. No acepta tipo, actor o estado dentro del contenido. Tipo se define una vez al crear.

Un draft necesita título, descripción, cupos positivos, fecha válida y correo o URL HTTPS válidos por las restricciones del esquema. Puede tener vacíos los campos de presentación restantes. Para enviar/aprobar se requieren actividades, requisitos, responsable e instrucciones, ciudad/estado salvo remoto, al menos una carrera si alcance selected y fecha no vencida en America/Hermosillo. Alcance all no lleva filas en revision_carreras. URLs no HTTPS se rechazan; el contenido se presenta como texto, sin HTML.

Las ofertas exponen `version` opaca basada en updated_at; las revisiones usan created_at/submitted_at + xmin de PostgreSQL, sin nueva columna ni cambio de modelo. El cliente debe devolver exactamente el token que recibió. Un guardado o decisión obsoleto recibe 409 `STALE_OFFER`.

Pending, approved y rejected no se editan. Una nueva edición crea otra fila. Solo aprobar cambia el puntero publicado; rechazar conserva el anterior. Una nueva aprobación abre únicamente la primera publicación, no reabre ofertas ya cerradas. Archivar es baja lógica, solo admin, irreversible en el flujo actual. Reabrir requiere publicada approved, fecha vigente y organización aprobada con permiso del tipo. Revocar permisos no oculta por sí mismo publicaciones existentes; suspender organización sí excluye su detalle público.

Las correcciones admin no descartan drafts/pending del publicador: 409 `OPEN_REVISION` hasta resolverlos. Para aprobar una revisión (incluida corrección) se vuelve a verificar organización aprobada y permiso actual, y se valida vigencia/contenido. El rechazo sigue disponible aunque la organización haya perdido permisos, para resolver la cola.

Errores principales: 404 `OFFER_NOT_FOUND` para inexistencia o propietario ajeno; 403 por rol/organización/permiso; 409 `REVISION_FROZEN`, `OPEN_REVISION`, `ALREADY_DECIDED`, `STALE_OFFER`, `OFFER_ARCHIVED`, `NO_PUBLICATION` o `INVALID_STATE`; 400 por campos/carreras/contacto/vigencia de envío inválidos. No se incluyen secretos ni errores crudos de SQL.

`revisiones[]` conserva decisión, motivo, fecha y administrador. `auditoria[]` contiene eventos de alta, revisión y permisos con antes/después, actor y fecha. No contiene tokens/contraseñas. El publicador no puede leer el detalle de otras organizaciones ni usar las rutas de admin para concederse permisos.

## Directorios y panel · Fase 7

Todos estos endpoints requieren token verificado y perfil activo, devuelven `{data,error:null,meta:null}` y `Cache-Control: no-store`.

### GET `/admin/usuarios`

Solo admin. Query estricta: `q?` (nombre o correo, trim, máximo 150 caracteres), `rol?=student|publisher|admin`, `activo?=true|false`, `page=1` (entero 1–100000), `pageSize=20` (entero 1–50). Desconocidos, duplicados/arrays o valores inválidos responden 400. La búsqueda es literal, insensible a mayúsculas y usa SQL parametrizado; `%`, `_` y barra inversa no son comodines del usuario. Orden `created_at DESC,id`. No tiene límite global de 100 cuentas.

Data: `{items:[{id,nombre_completo,email,rol,activo}],total,page,pageSize}`. Total y página comparten snapshot; página fuera de resultados conserva el total y devuelve `items:[]`. No incluye expediente, carrera, metadata de Auth ni datos sensibles adicionales. No hay endpoints nuevos de escritura o gestión de cuentas. Sin token: 401; otros roles o perfil inactivo: 403.

### GET `/publicador/miembros`

Solo publisher. No admite parámetros, especialmente ningún ID de organización. La API deriva la organización desde el ID autenticado y `miembros_organizacion`. Data: `{organizacion:{nombre},items:[{nombre_completo,email,rol_interno:'representative',activo}]}`. Correo es el de cuenta del miembro para consulta interna; activo representa el estado de perfil (el modelo no tiene otro estado de membresía). Orden por nombre/correo. Incluye miembros inactivos existentes, sin inventar integrantes. Un miembro se muestra como tal. Publicador sin membresía: 403 `MEMBERSHIP_REQUIRED`. Otros roles: 403; token inválido/ausente: 401. Se permite consultar la propia organización pendiente, rechazada o suspendida, manteniendo la política de lectura existente. No ofrece invitaciones, altas/bajas ni cambios de roles.

### GET `/publicador/resumen`

Solo publisher, sin parámetros. Data: `{total,borradores,en_revision,rechazadas,publicadas,activas,recientes}`. `recientes` tiene hasta cinco filas con el mismo contrato de ítem de `/publicador/ofertas`, en orden `ofertas.updated_at DESC,id`. Cuenta únicamente ofertas de la membresía autenticada; sin ofertas devuelve ceros y `[]`.

- `total`: todas las oportunidades propias, incluidas archivadas.
- `borradores`, `en_revision`, `rechazadas`: estado de la revisión con mayor número de versión (`draft`, `pending`, `rejected`) de oportunidades no archivadas.
- `publicadas`: puntero publicado a revisión aprobada perteneciente a la oferta, excluyendo archivadas; puede incluir cerradas, vencidas u organización suspendida.
- `activas`: publicadas con estado `open`, organización `approved` y fecha límite de la revisión publicada igual o posterior a hoy en America/Hermosillo; coincide con la visibilidad del catálogo.

Los grupos se superponen: una nueva edición `pending` no reemplaza el puntero aprobado ni altera su fecha. Las métricas y cinco recientes se calculan juntas sin N+1. Sin migración ni cambios en las reglas de aprobación o permisos.

## Controles HTTP y fiabilidad · Fase 8

- GET `/health` devuelve `{status:'ok'|'degraded',service:'unioportunidades-api',authentication:'configured'|'not_configured',database:'available'|'not_configured'|'unavailable'}`. Retira `phase`; se actualizaron el contrato Zod y las pruebas. Error de DB: 503 con estado degradado, sin detalles de conexión.
- Todas las respuestas API usan no-store y cabeceras nosniff/no-referrer/DENY/CSP de API. CORS permite el origen exacto de WEB_ORIGIN, sin cookies; otros orígenes (incluido null) reciben 403 `ORIGIN_NOT_ALLOWED`. Preflight solo para métodos previstos y Authorization/Content-Type. Peticiones sin Origin siguen requiriendo token en las rutas protegidas.
- JSON máximo 100 kB y sin compresión: exceso → 413 `BODY_TOO_LARGE`; encoding/charset no admitido → 415 `UNSUPPORTED_ENCODING`; JSON roto → 400 `INVALID_JSON`. Búsquedas mantienen máximo 150 y paginación acotada.
- Login por correo y expediente comparten 10 intentos por IP en 15 min. Registro de organización tiene cupo separado de 5/15 min. 429 `TOO_MANY_REQUESTS`; el limitador local incluye Retry-After. El signup de credenciales directo en Supabase se rige por límites/configuración del proveedor.
- `TRUST_PROXY` es opt-in mediante IPs/CIDRs; por defecto no confía en XFF. No se admiten true, número de saltos ni /0 desde entorno. Ver topología y riesgos en `security-review.md`.
- Token rechazado/caducado → 401; perfil deshabilitado/rol no permitido → 403. Caída de red/5xx de Auth → 503 `AUTH_UNAVAILABLE`, sin interpretar la caída como token inválido. Respuestas 429 del proveedor usan error genérico de límite.
- Transporte Auth: 8 s. Cliente web: 15 s y cancelación combinada. Pool: adquisición 10 s, consulta SQL 15 s, espera de lock 5 s, timeout de query cliente 20 s e idle-in-transaction 15 s. Caídas/locks transitorios normalizados a 503 `SERVICE_UNAVAILABLE`, sin SQL ni datos de conexión.
- Perfil en UI revalidado cada 60 s. La conservación por fallo temporal vence al expirar el token o a 5 min desde la última validación exitosa de perfil, lo que suceda primero. Renovar token no extiende un perfil sin verificar. No cambian permisos, propiedad ni reglas de moderación del backend.
