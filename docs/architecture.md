# Arquitectura · Fase 2

React usa Supabase exclusivamente para Auth. Las consultas de negocio van a Express con Bearer token. Express verifica cada identidad mediante `getUser(token)` y consulta `perfiles`/membresía/permisos en PostgreSQL con `pg`. Ni el rol del JWT/metadata ni un header/body elegido por cliente autoriza operaciones. El cliente web solo presenta el rol obtenido de `/auth/yo`; los guards visuales complementan la autorización real del servidor.

`AuthGateway` aísla Supabase. `StudentIdentityProvider` y `DemoStudentIdentityProvider` resuelven expediente ficticio a email interno sin acoplar ofertas a un futuro proveedor de identidad autorizado. El password login usa un cliente Auth por petición, sin persistencia/autorefresh en servidor, para no compartir sesiones entre usuarios. La API no recibe la contraseña universitaria real.

`ProfilesRepository` hace joins parametrizados de perfil, carrera, organización y permisos. `OrganizationsRepository` registra uid verificado + perfil publisher + organización pending + membresía + evento de auditoría dentro de una transacción y serializa altas del mismo usuario con advisory lock. No hay endpoints para elevar roles ni mover membresías. La revisión administrativa y los permisos se implementan por separado en `OrganizationManagementRepository`.

`AuthProvider` recupera sesión de Supabase, consulta perfil en la API y bloquea contenido mientras valida. La generación de peticiones impide que una respuesta de sesión anterior autorice un usuario nuevo. Un usuario confirmado sin perfil entra en onboarding; inactivos, fallos de red y sesiones inválidas bloquean rutas. Cerrar sesión limpia sesión local y cachés. Las sesiones JWT emitidas mantienen las reglas de expiración de Supabase; no se promete revocación instantánea propia.

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

La comprobación de publicación deriva membresía, estado y permisos del servidor. Se vuelve a leer el conjunto de permisos después de adquirir el bloqueo para observar revocaciones que hayan terminado mientras esperaba. Por ahora el endpoint retorna 501 si la organización cumple los requisitos: crear ofertas es Fase 3. Ese futuro flujo debe comprobar la elegibilidad bajo el mismo bloqueo/transacción que la escritura, para no introducir una carrera entre validar y publicar.

Las lecturas de detalle/historial usan snapshot repetible de solo lectura. El listado está paginado y filtrado por parámetros SQL. El panel publicador se actualiza al recuperar foco, cada 30 segundos o manualmente; muestra organización, permisos, decisiones y auditoría propios. La UI administrativa exige confirmar las mutaciones y presenta estados de carga, vacío, error y conflicto; no concede permisos por estado visual ni ofrece reactivaciones no previstas.

Catálogo, CRUD de ofertas y moderación de revisiones quedan pendientes. No se ejecutaron comandos de migración/seed ni mutaciones en servicios remotos durante Fase 2.
