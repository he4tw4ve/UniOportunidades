# Contratos API · Fase 2

Base: `/api/v1`. Respuesta `{data,error,meta}`. Las rutas de Auth/perfil/roles llevan `Cache-Control: no-store`. Token solo en `Authorization: Bearer <access_token>`, nunca en URL. JSON no válido o campos extra en mutaciones se rechazan con 400.

| Método y ruta                           | Acceso                              | Contrato                                                                                                                                                                      |
| --------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/health`                           | Público                             | `status`, `service`, `phase:2`, `authentication:configured/not_configured`, `database:available/not_configured/unavailable`; DB se prueba con SELECT 1, caída DB devuelve 503 |
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

El healthcheck ahora informa `phase:2`. El resto de los endpoints Auth de Fase 1 conserva su contrato.

| Método/ruta                               | Acceso    | Datos                                                                                                                                   |
| ----------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/admin/organizaciones`               | Admin     | Query `estado?`, `q?`, `page` (1 por defecto), `pageSize` (20 por defecto, máximo 50). Data: `{items,total,page,pageSize}`              |
| GET `/admin/organizaciones/:id`           | Admin     | Detalle completo, permisos, `version`, `revisiones[]` y `auditoria[]`                                                                   |
| POST `/admin/organizaciones/:id/decision` | Admin     | `{decision,comentario?,permisos?,version}`; decision `approved/rejected/suspended`; permisos solo al aprobar                            |
| PUT `/admin/organizaciones/:id/permisos`  | Admin     | `{permisos:[social_service/internship],version}`; reemplaza conjunto sin duplicados; `[]` revoca todos                                  |
| GET `/organizaciones/mia`                 | Publisher | Mismo detalle completo solo de su membresía, o null si no hay asociación                                                                |
| POST `/publicador/ofertas`                | Publisher | Valida `tipo` y elegibilidad real. Sin aprobación o permiso: 403. Con autorización: 501 `PHASE_NOT_IMPLEMENTED`; no crea nada en Fase 2 |

Las respuestas de las mutaciones contienen el detalle actualizado. Los UUID, filtros y cuerpos se validan con Zod. `version` procede del detalle (`updated_at::text`); es opaco, no lo reconstruyas como fecha. Bajo bloqueo de fila se compara con la versión actual: diferencias producen 409 `STALE_ORGANIZATION` sin sobreescribir cambios ajenos. Añadir este campo no cambia el esquema; evita que dos administradores guarden formularios antiguos.

Transiciones permitidas: pending → approved/rejected; approved → suspended. Motivo obligatorio (no espacios) al rechazar/suspender. No hay reactivación de rejected/suspended en el flujo v1. Conflictos de transición: 409 `INVALID_TRANSITION`. Aprobar sin `permisos` no concede ninguno por defecto; una aprobación con permisos se guarda en la misma transacción.

Solo organizaciones approved reciben nuevos permisos. Se permite revocar los existentes en otros estados. Revocar un permiso no cierra ofertas existentes; suspender bloquea publicaciones nuevas aunque persistan filas de permisos. La consulta futura del catálogo deberá excluir organizaciones suspendidas conforme a la especificación.

Errores de publicación: 403 `ORGANIZATION_REQUIRED`, `ORGANIZATION_NOT_APPROVED` o `PUBLICATION_NOT_ALLOWED`. Nunca se toman estado, organización, permisos o actor del cuerpo del publicador. La comprobación actual no autoriza una escritura futura fuera de su transacción: en Fase 3 el bloqueo/validación debe ejecutarse dentro de la misma transacción que inserte/envíe la oferta.

`revisiones[]` conserva decisión, motivo, fecha y administrador. `auditoria[]` contiene eventos de alta, revisión y permisos con antes/después, actor y fecha. No contiene tokens/contraseñas. El publicador no puede leer el detalle de otras organizaciones ni usar las rutas de admin para concederse permisos.
