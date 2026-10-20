# Arquitectura · Fase 1

React usa Supabase exclusivamente para Auth. Las consultas de negocio van a Express con Bearer token. Express verifica cada identidad mediante `getUser(token)` y consulta `perfiles`/membresía/permisos en PostgreSQL con `pg`. Ni el rol del JWT/metadata ni un header/body elegido por cliente autoriza operaciones. El cliente web solo presenta el rol obtenido de `/auth/yo`; los guards visuales complementan la autorización real del servidor.

`AuthGateway` aísla Supabase. `StudentIdentityProvider` y `DemoStudentIdentityProvider` resuelven expediente ficticio a email interno sin acoplar ofertas a un futuro proveedor de identidad autorizado. El password login usa un cliente Auth por petición, sin persistencia/autorefresh en servidor, para no compartir sesiones entre usuarios. La API no recibe la contraseña universitaria real.

`ProfilesRepository` hace joins parametrizados de perfil, carrera, organización y permisos. `OrganizationsRepository` registra uid verificado + perfil publisher + organización pending + membresía + evento de auditoría dentro de una transacción y serializa altas del mismo usuario con advisory lock. No hay endpoints para elevar roles ni mover membresías. Se incluyen solo el alta inicial y lectura necesarias para autenticación; la revisión administrativa de organizaciones queda en Fase 2.

`AuthProvider` recupera sesión de Supabase, consulta perfil en la API y bloquea contenido mientras valida. La generación de peticiones impide que una respuesta de sesión anterior autorice un usuario nuevo. Un usuario confirmado sin perfil entra en onboarding; inactivos, fallos de red y sesiones inválidas bloquean rutas. Cerrar sesión limpia sesión local y cachés. Las sesiones JWT emitidas mantienen las reglas de expiración de Supabase; no se promete revocación instantánea propia.

## Modelo y migraciones

No se modificó el modelo relacional. `db/migrations/001_init.sql` es una copia íntegra del SQL de referencia: 13 tablas de negocio, restricciones, índices, triggers, RLS y revocaciones de acceso cliente.

Se añade infraestructura fuera del modelo de negocio: `private_app.schema_migrations` guarda nombre, checksum y fecha de ejecución. Razón: los triggers/constraints del SQL original no se pueden repetir aunque algunas tablas usen IF NOT EXISTS; el runner transaccional evita reejecutar DDL y rechaza migraciones alteradas. El esquema técnico no es accesible por PUBLIC/anon/authenticated. Para nuevos cambios se crearán migraciones nuevas; no se alterará silenciosamente la referencia.

No hay políticas RLS para clientes. El pool privilegiado del servidor conserva acceso; las credenciales DB y la clave administrativa no se compilan en web. No se guardan contraseñas ni tokens en tablas de negocio/auditoría. Solo Auth gestiona credenciales.

## Seed y pruebas

El seed aprovisiona usuarios ficticios con clave administrativa y marca de propiedad en app_metadata; esto solo permite reconocer identidades del seed, nunca definir rol desde cliente. Reutiliza usuarios propios sin cambiar contraseña. La parte SQL es transaccional, con claves estables, y no reinicializa permisos/estados ya modificados. Ante fallo entre Auth y DB se puede repetir: no existe transacción distribuida entre ambos servicios.

Supertest prueba HTTP real con gateway Auth simulado; PostgreSQL embebido ejecuta el SQL de migración completo, RLS, repositorios y fixtures. Esto valida SQL/lógica local, no sustituye la comprobación contra un proyecto Supabase configurado. Las pruebas no requieren acceso a servicios externos ni credenciales reales.

Catálogo, moderación, búsquedas y gestión de permisos están pendientes. Los fixtures de ofertas sirven a fases futuras; no se han creado endpoints de publicación/moderación en Fase 1.
