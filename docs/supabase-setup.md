# Configuración de Supabase · Fase 1

Usa un proyecto nuevo de desarrollo/prueba. Las cuentas ficticias se reconocen por el dominio reservado `.test`; las carreras y organizaciones son ejemplos ficticios, no catálogos oficiales.

## 1. Proyecto y conexión PostgreSQL

1. Crea el proyecto y conserva su contraseña de base de datos en un gestor de secretos.
2. En **Connect**, copia la cadena PostgreSQL **Direct connection** si tu red tiene IPv6 o **Session pooler** para redes IPv4. Usa el usuario privilegiado `postgres`/`postgres.<referencia>` que muestra Supabase. La conexión debe poder operar sobre tablas con RLS desde el backend; no uses roles `anon`/`authenticated` para el pool del servidor.
3. Pon esa cadena en `DATABASE_URL` de `apps/api/.env`. Sustituye la contraseña de ejemplo por la de DB; codifica caracteres reservados de contraseña en la URL. Para los scripts de migración usa conexión directa o pooler en modo sesión, no el puerto de transaction pooling.
4. Añade `?sslmode=verify-full` (o `&sslmode=verify-full` si ya había parámetros). Si tu cadena requiere certificado de CA, descarga el certificado desde la configuración SSL de Database y añade `sslrootcert=` con la ruta codificada en la URL, accesible al proceso Node. No uses `NODE_TLS_REJECT_UNAUTHORIZED=0` ni desactives validación de certificados. No subas certificado/configuración privados al repositorio.

Referencia: [conexiones PostgreSQL de Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres).

## 2. Claves de Auth

En la configuración de API del proyecto copia **Project URL** y la clave pública **anon** (o clave publicable) del mismo proyecto.

| Variable                    | Ubicación                      | Valor                                            |
| --------------------------- | ------------------------------ | ------------------------------------------------ |
| `SUPABASE_URL`              | `apps/api/.env`                | URL HTTPS del proyecto                           |
| `SUPABASE_ANON_KEY`         | `apps/api/.env`                | Clave pública para password login y getUser      |
| `SUPABASE_SERVICE_ROLE_KEY` | `apps/api/.env`, solo seed     | Clave administrativa `service_role` del proyecto |
| `DATABASE_URL`              | `apps/api/.env`, solo servidor | Cadena PostgreSQL privilegiada con TLS           |
| `VITE_SUPABASE_URL`         | `apps/web/.env`                | Misma URL pública del proyecto                   |
| `VITE_SUPABASE_ANON_KEY`    | `apps/web/.env`                | Misma clave pública; jamás `service_role`        |
| `VITE_API_BASE_URL`         | `apps/web/.env`                | `/api/v1` en desarrollo                          |
| `WEB_ORIGIN`                | `apps/api/.env`                | `http://127.0.0.1:5173`                          |

No pongas `DATABASE_URL`, claves administrativas ni contraseñas demo en variables `VITE_*`: Vite incorpora estas variables al navegador. La API no usa `service_role` para autenticar peticiones; la necesita exclusivamente el seed para crear identidades. Puedes retirarla del entorno del proceso API tras sembrar. No pegues valores secretos en el chat ni los incluyas en capturas.

## 3. Ajustes de autenticación y correo

En **Authentication**:

1. Habilita el proveedor **Email** con password y permite nuevos registros para publicadores.
2. Mantén activada **Confirm email**. Configura una longitud mínima de 12 caracteres para contraseñas del proyecto, consistente con el formulario/seed.
3. En **URL Configuration**, establece **Site URL**: `http://127.0.0.1:5173` y añade como redirect permitido `http://127.0.0.1:5173/registro-organizacion`.
4. Si decides usar `localhost` en lugar de `127.0.0.1`, añade también su redirect exacto y cambia CORS/proxy/URL de apertura de forma coherente. No mezcles hosts durante un mismo flujo: el almacenamiento de sesión es por origen.
5. Para registrar correos de personas que no pertenezcan al equipo del proyecto, configura **Custom SMTP** y verifica el remitente/dominio. El servicio de correo integrado tiene restricciones de destinatarios y límites; no desactives confirmación para evitar esos límites. Revisa **Rate Limits** y habilita CAPTCHA antes de abrir registros públicamente; esta fase es un entorno local de demostración.
6. No añadas triggers que copien `user_metadata.role` a `perfiles`. Un registro normal no crea un administrador ni un estudiante: solo la API crea un perfil `publisher` tras identidad/correo verificados.

El navegador llama a Supabase exclusivamente para Auth (registro, confirmación, almacenamiento/renovación y cierre de sesión). El login por expediente y el login por correo visibles pasan por Express con límite de 10 peticiones por IP cada 15 minutos; el mismo límite se comparte con el alta de organización. Las llamadas directas al proveedor Auth se rigen además por los límites de Supabase.

El backend llama a [getUser(token)](https://supabase.com/docs/reference/javascript/auth-getuser) para verificar la identidad y consulta el perfil/rol en DB en cada petición privada. No confía en `getSession()` del navegador ni en metadatos del usuario para autorizar.

## 4. Migración versionada

Desde la raíz del repo, con las variables de servidor configuradas:

```powershell
npm.cmd run db:migrate
```

El runner aplica `db/migrations/001_init.sql` dentro de una transacción con bloqueo e historial de checksum. La segunda ejecución no repite DDL. No edites una migración aplicada: añade otra versión si cambia el modelo. No ejecutes antes el SQL de referencia manualmente; si ya lo hiciste en un proyecto vacío, utiliza un proyecto de prueba nuevo o reconcilia el historial explícitamente, porque algunos triggers/constraints de referencia no son DDL reejecutable.

No se cambió el modelo de negocio: el archivo de migración es idéntico a `02_ESQUEMA_SQL.sql`. El runner añade solo `private_app.schema_migrations`, infraestructura para no repetir migraciones; revoca acceso al esquema a PUBLIC, anon y authenticated. No requiere contraseñas de usuarios ni las almacena.

## 5. Comprobar RLS

La migración activa RLS en las 13 tablas y revoca todos los privilegios de `anon`/`authenticated`; no crea ninguna política de acceso cliente. En SQL Editor puedes comprobar:

```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
SELECT has_table_privilege('anon','public.perfiles','SELECT') AS anon_read,
       has_table_privilege('authenticated','public.perfiles','SELECT') AS user_read;
```

Resultado esperado en proyecto nuevo: las 13 tablas con `rowsecurity=true`, cero políticas y ambos permisos `false`. No actives políticas sugeridas de lectura pública ni habilites escrituras desde Data API. El pool privilegiado del backend hace las consultas SQL; el navegador no llama `.from()` ni `.rpc()` para datos de negocio.

## 6. Sembrar cuentas y fixtures ficticios

En `apps/api/.env` elige contraseñas de demostración diferentes, de al menos 12 caracteres, y configura:

```dotenv
DEMO_SEED_ENABLED=true
DEMO_ADMIN_PASSWORD=
DEMO_STUDENT_PASSWORD=
DEMO_PUBLISHER_PASSWORD=
```

Los valores vacíos de arriba deben rellenarse solo localmente. Después:

```powershell
npm.cmd run seed:demo
```

Se crean 7 identidades: un admin, tres estudiantes (`DEMO-001` a `DEMO-003`) y tres publicadores. Se crean tres carreras/departamentos ficticios, tres organizaciones (aprobada para prácticas, pendiente sin permisos y aprobada para servicio social), ocho ofertas con diez revisiones: una edición pendiente y otra rechazada, manteniendo el puntero publicado. Estos son fixtures para las próximas fases, no APIs de publicación implementadas.

El seed usa [admin.createUser con email_confirm](https://supabase.com/docs/reference/javascript/auth-admin-createuser), exclusivamente con clave administrativa en servidor. Así las cuentas `.test` funcionan sin SMTP y sin desactivar confirmación para otros usuarios. Los roles se escriben en `perfiles`, nunca se extraen de metadatos enviados por cliente.

Idempotencia: reutiliza usuarios marcados con `app_metadata.seed_owner=unioportunidades-v1`, rechaza correos reservados ajenos, no cambia contraseñas existentes ni reasigna roles. SQL usa claves estables y preserva permisos revocados/estados modificados después de la primera ejecución. Auth y PostgreSQL no comparten transacción: ante fallo puede quedar una identidad Auth sin perfil; corrige la causa y vuelve a ejecutar para completarla. No borres indiscriminadamente esas cuentas: las FK protegen historial.

## 7. Alta nueva y prueba de acceso

1. Ejecuta `npm.cmd run dev` y abre `/registro-organizacion`.
2. Registra correo y contraseña propios del prototipo; confirma el enlace recibido. Si no se recupera sesión desde el enlace, usa login por correo.
3. Completa nombre, tipo y correo de la organización. Express usa el uid real; crea perfil publisher + organización pending + membresía + auditoría en una sola transacción. El cliente no puede elegir rol, estado ni permisos. Una cuenta ya perfilada recibe 409.
4. Abre Mi perfil: estado pendiente y sin permisos. Aprobación, rechazo, suspensión y edición de permisos quedan para Fase 2.
5. Prueba estudiantes por expediente y admin/publicadores por email según la tabla del README; recarga y cierra sesión. La web restaura/renueva sesión con Supabase y vuelve a pedir el perfil al backend. Cerrar sesión limpia la sesión de este dispositivo; un access token ya emitido puede seguir válido hasta expirar, como en el funcionamiento habitual de JWT. No se implementa una lista propia de revocación.

## Diagnóstico

### TLS con Session pooler y `pg_stat_ssl`

Hay dos tramos diferentes: Node → pooler y pooler → PostgreSQL. `pg_stat_ssl WHERE pid=pg_backend_pid()` observa el backend PostgreSQL, no el socket TLS de Node al pooler. Por eso un `ssl=false` en esa vista no implica que el cliente esté enviando su tráfico externo sin cifrar.

El diagnóstico ahora muestra `clientToEndpointTls`: lee el socket real del driver `pg`, comprueba `encrypted`, `authorized`, que no esté desactivada la validación y verifica también el hostname con `tls.checkServerIdentity`. `verified=true` requiere que todas esas comprobaciones pasen. `tlsActive` describe ahora ese socket cliente. Si el driver cambia y no puede inspeccionarse, informa `null` y no asegura validación.

`postgresBackendTls` muestra por separado la fila de PostgreSQL (`ssl`, versión, cifrado y bits). Una fila ausente se informa como desconocida, no como `false`. Esta comprobación no demuestra cifrado de extremo a extremo entre todos los tramos de la infraestructura.

En la comprobación de solo lectura realizada con la configuración actual, Node → pooler negoció **TLSv1.3**, cifrado **TLS_AES_256_GCM_SHA384**, certificado autorizado y hostname válido, manteniendo `sslmode=verify-full` con CA explícita. El backend PostgreSQL reportó una fila real con `ssl=false`. `auth.users` existe, el historial no existe y hay cero tablas públicas: la migración inicial sigue pendiente. No se ejecutó ninguna migración durante esta comprobación.

La conexión cliente está verificada y permite proceder a `npm.cmd run db:migrate` desde el punto de vista de TLS; los permisos/DDL solo se comprobarán al ejecutarla. Si se exige TLS en cada tramo hasta PostgreSQL, esta comprobación no lo acredita: hay que utilizar y verificar una conexión directa o confirmar la configuración interna con Supabase.

Referencias: [Node TLS](https://nodejs.org/api/tls.html), [pg_stat_ssl](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-SSL-VIEW) y [pooler como intermediario](https://supabase.com/docs/guides/troubleshooting/monitor-supavisor-postgres-connections).

### Error `SELF_SIGNED_CERT_IN_CHAIN`

Significa que la validación TLS no puede establecer una cadena de confianza con las CA disponibles en Node. Ocurre antes de autenticar en PostgreSQL y antes de ejecutar la migración; no demuestra que la contraseña sea correcta o incorrecta.

1. En el Dashboard de tu proyecto abre **Database → Settings → SSL Configuration → Download certificate** y descarga el certificado CA oficial. [Referencia de Supabase](https://supabase.com/docs/guides/platform/ssl-enforcement).
2. Guarda el certificado en una ruta estable. Ejemplo de ruta local: `C:/certs/supabase-ca.crt` (puedes elegir otra; el archivo debe existir).
3. En `apps/api/.env`, conserva la cadena de conexión actual y `sslmode=verify-full`. Añade a sus parámetros `&sslrootcert=C%3A%2Fcerts%2Fsupabase-ca.crt`, adaptando la ruta al archivo descargado. Es solo un parámetro adicional: no reemplaces usuario, contraseña, host ni base de datos. Para una ruta diferente puedes obtener la codificación con `[uri]::EscapeDataString('C:/ruta/al/certificado.crt')`, que solo muestra una ruta, nunca credenciales.
4. Guarda el `.env`. No basta con descargar el certificado: el driver debe recibir su ruta mediante `sslrootcert`. No combines esto con otro objeto SSL que pueda ser reemplazado por los parámetros de la URL.
5. Ejecuta `npm.cmd run db:diagnose`. Este comando solo comprueba conexión y metadatos con `BEGIN READ ONLY`; no ejecuta migraciones. Muestra categorías y códigos seguros, nunca URLs, contraseñas ni mensajes crudos del driver.
6. Cuando el diagnóstico confirme conexión y TLS, ejecuta `npm.cmd run db:migrate`. Si aparece otro error, el runner ahora indica su código y una explicación segura sin divulgar secretos.

El diagnóstico revisa también si `DATABASE_URL` ya venía del entorno del proceso y difiere del `.env`: dotenv conserva por defecto el valor del proceso. No se cambia esa precedencia silenciosamente. Si persiste el mismo error tras configurar la CA oficial, puede haber inspección TLS en la red: habría que verificar esa cadena con el administrador de red; nunca confiar automáticamente en un certificado capturado de la conexión fallida.

No cambies `verify-full` por `no-verify` ni desactives la validación SSL. La configuración de certificado afecta también al pool de la API y al seed, que comparten `createPool`.

- `503 NOT_CONFIGURED`: faltan variables del backend. Sin configuración sigue abriendo la portada.
- `health` con `database=unavailable`: revisa URL, conectividad, contraseña y certificado. `available` solo prueba `SELECT 1`, no asegura que hayas aplicado todas las tablas. `authentication=configured` indica configuración, no una comprobación remota de login.
- `401 INVALID_CREDENTIALS`: mensaje genérico; revisa cuenta demo, contraseña elegida y confirmación sin revelar si existe un expediente.
- `403 PROFILE_REQUIRED`: usuario Auth válido todavía sin organización/perfil; completa el registro.
- `403 EMAIL_NOT_CONFIRMED`: confirma el correo; no se crea organización sin identidad verificada.
- `403 FORBIDDEN`: el rol leído desde DB no autoriza esa ruta. `ACCOUNT_DISABLED`: perfil inactivo.
- `429 TOO_MANY_REQUESTS`: espera la ventana del limitador; reiniciar la API local reinicia su almacenamiento en memoria.

La implementación se verificó con dependencias simuladas de Auth y PostgreSQL embebido. Sin credenciales no se ha migrado tu proyecto remoto ni enviado correos ni comprobado un login real contra Supabase.
