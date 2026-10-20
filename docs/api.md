# Contratos API · Fase 1

Base: `/api/v1`. Respuesta `{data,error,meta}`. Las rutas de Auth/perfil/roles llevan `Cache-Control: no-store`. Token solo en `Authorization: Bearer <access_token>`, nunca en URL. JSON no válido o campos extra en mutaciones se rechazan con 400.

| Método y ruta                           | Acceso                              | Contrato                                                                                                                                                                      |
| --------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/health`                           | Público                             | `status`, `service`, `phase:1`, `authentication:configured/not_configured`, `database:available/not_configured/unavailable`; DB se prueba con SELECT 1, caída DB devuelve 503 |
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
