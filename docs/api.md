# Contratos API · Fase 3

Base: `/api/v1`. Respuesta `{data,error,meta}`. Las rutas de Auth/perfil/roles llevan `Cache-Control: no-store`. Token solo en `Authorization: Bearer <access_token>`, nunca en URL. JSON no válido o campos extra en mutaciones se rechazan con 400.

| Método y ruta                           | Acceso                              | Contrato                                                                                                                                                                      |
| --------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/health`                           | Público                             | `status`, `service`, `phase:3`, `authentication:configured/not_configured`, `database:available/not_configured/unavailable`; DB se prueba con SELECT 1, caída DB devuelve 503 |
| POST `/auth/estudiantes/iniciar-sesion` | Público, limitado                   | `{expediente,password}`; resuelve email demo en DB, autentica con Auth, verifica perfil student activo; devuelve tokens para `setSession`                                     |
| POST `/auth/correo/iniciar-sesion`      | Público, limitado                   | `{email,password}`; login publisher/admin o usuario confirmado sin perfil aún; no permite student ni inactivos                                                                |
| GET `/auth/yo`                          | Token validado + perfil activo      | Perfil `{id,nombre_completo,email,rol,activo,estudiante,organizacion}`; carrera y permisos desde SQL                                                                          |
| POST `/organizaciones/registro`         | Token + correo confirmado, limitado | `{nombre_completo,nombre,tipo,email_contacto,descripcion?}`; 201 `{id,estado:pending,permisos:[]}`; no acepta uid/rol/estado/permisos                                         |
| GET `/organizaciones/mia`               | Publisher activo                    | Organización del perfil y permisos                                                                                                                                            |
| GET `/admin/usuarios`                   | Admin activo                        | Hasta 100 perfiles, sin secretos ni contraseñas; `meta.limit=100`                                                                                                             |

El endpoint de login por email se añadió para mantener errores uniformes y limitador en Express. El signup sigue usando Supabase Auth en navegador con confirmación de email y límites del proveedor; no hay registro público de estudiantes o admin.

Tokens de login: `{access_token,refresh_token,expires_in,token_type}`. Credenciales inválidas: 401 `INVALID_CREDENTIALS`, mismo mensaje sin confirmar existencia de expediente/email. No se registran cuerpos ni tokens.

Sesión inválida/ausente: 401 `UNAUTHORIZED`. Correo sin confirmar: 403 `EMAIL_NOT_CONFIRMED`. Perfil faltante: 403 `PROFILE_REQUIRED` (salvo alta inicial de organización). Perfil inactivo: 403 `ACCOUNT_DISABLED`. Rol distinto: 403 `FORBIDDEN`. Alta repetida: 409 `ALREADY_REGISTERED`. Campos inválidos: 400 `VALIDATION_ERROR`. Límite de acceso: 429 `TOO_MANY_REQUESTS`. Configuración ausente: 503 `NOT_CONFIGURED`. Fallo interno: 500 genérico sin detalles de SQL/secretos.

Todo `/admin/*` y `/publicador/*` pasa primero por sesión/perfil/rol, incluso rutas aún no implementadas; las rutas autorizadas ausentes devuelven 404. `/ofertas/*` y `/catalogos/*` requieren sesión/perfil, pero sus operaciones de negocio quedan para fases posteriores. No hay endpoints de ofertas que devuelvan éxito ficticio.

## Organizaciones y permisos

El healthcheck ahora informa `phase:3`. Los endpoints Auth conservan su contrato.

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
