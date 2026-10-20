# Fase 2: organizaciones, permisos y verificación

## Implementado

El alta autoservicio existente conserva confirmación de email en Supabase antes del alta transaccional de perfil publisher, organización pending, membresía y auditoría. No asigna permisos, no crea estudiantes/admin y rechaza intentos de elegir rol/actor/estado desde el cliente.

Publicador: `/publicador/panel` y `/publicador/organizacion` consultan su organización desde la API y muestran estado, bloqueo, permisos por tipo, historial con motivos y auditoría propia. Incluyen carga, error/reintento, ausencia de organización y actualización manual/periódica. No se muestran conteos ficticios de ofertas.

Admin: `/admin/panel`, `/admin/organizaciones` y `/admin/organizaciones/:id` presentan filtros por estado/nombre, paginación, vacío, carga/error, detalle, historial y formularios de decisiones/permisos. El usuario debe confirmar cada cambio; rechazo y suspensión requieren motivo.

API: listado/detalle de organizaciones, revisión, reemplazo de permisos, detalle propio y bloqueo de publicación por organización/tipo. Las mutaciones vuelven a verificar al admin activo en PostgreSQL, bloquean la fila y comparan una versión opaca para rechazar ediciones desactualizadas (409).

No se cambió el esquema SQL ni el modelo: se usan las tablas de organizaciones, permisos, revisiones y auditoría ya previstas. No hay migración nueva. No se ejecutaron migraciones, seed ni escrituras contra Supabase remoto.

## Reglas comprobadas

- Pending solo puede pasar a approved o rejected; approved puede pasar a suspended. Sin reactivación implícita de rejected/suspended.
- Aprobar no concede permisos por defecto. Aprobar con permisos registra decisión, permisos, revisión y auditoría en una transacción.
- Solo se conceden permisos nuevos a organizaciones aprobadas. Se pueden revocar permisos existentes en otros estados.
- Un publicador pendiente, rechazado o suspendido no pasa la autorización de publicación; uno aprobado sin el permiso específico tampoco. El tipo de organización no sustituye los permisos explícitos.
- Nunca se aceptan privilegios/membresía/actor desde los datos enviados por el publicador. Solo se consulta su propia membresía.
- Las revisiones conservan decisión, motivo, administrador y fecha. Los permisos registran antes/después, actor y fecha en auditoría. Los errores de transacción revierten estado, revisión, permisos y eventos.
- El endpoint preparatorio `POST /publicador/ofertas` devuelve 403 si faltan requisitos y 501 si está autorizado: no crea ni envía ofertas. Fase 3 debe efectuar la comprobación bajo el mismo bloqueo/transacción que la creación/envío real.

## Archivos principales

- `apps/api/src/db/organizationManagementRepository.ts`: SQL parametrizado, bloqueos, transacciones, lectura propia y auditoría.
- `apps/api/src/modules/organizations/{types,policy,router}.ts`: contratos, estados, validación y autorización de publicación.
- `apps/api/src/modules/auth/router.ts`, `server.ts`, `app.ts`: conexión de endpoints y healthcheck Fase 2.
- `apps/web/src/lib/organizations.ts`: contratos Zod y cliente tipado.
- `apps/web/src/components/organizations/OrganizationInfo.tsx`: estados, datos e historial.
- `apps/web/src/features/publicador/OrganizationDashboard.tsx`: dashboard real de revisión.
- `apps/web/src/features/admin/{OrganizationsPage,OrganizationDetailPage}.tsx`: listado y mutaciones administrativas.
- Router web, portada y registro actualizados. README, API y arquitectura documentan alcance y límites.

## Comandos y resultados

| Comando ejecutado                                                                              | Resultado                                                                                                        |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `npm.cmd run build`                                                                            | API TypeScript y web TypeScript/Vite correctos                                                                   |
| `npm.cmd test`                                                                                 | 88 pruebas aprobadas: 68 API y 20 web                                                                            |
| `npm.cmd run test -w @unioportunidades/api -- src/modules/organizations/organizations.test.ts` | 14 pruebas de organizaciones correctas tras reforzar rollback por auditoría fallida después de escribir permisos |
| `npm.cmd run lint`                                                                             | Sin errores ni advertencias                                                                                      |
| `npm.cmd run format`                                                                           | Formato aplicado                                                                                                 |
| `npm.cmd run format:check`                                                                     | Sin diferencias                                                                                                  |

Supertest usa los repositorios reales sobre PostgreSQL embebido (PGlite); solo el transporte Auth se simula. La suite prueba alta confirmada/pending/idempotente, tipos y UUIDs inválidos, filtros, roles/token, accesos ajenos, decisiones repetidas, versiones obsoletas, aprobación combinada, concesión/revocación/suspensión y rollback. Un trigger temporal de fallo se crea únicamente en la base efímera de pruebas, nunca en Supabase.

React se prueba con jsdom y API simulada: carga/error/reintento/vacío, estado pendiente y aprobación sin permiso, filtros, confirmaciones obligatorias, motivo de rechazo, aprobación con permisos, actualización independiente y conflicto sin éxito ficticio. No se probó visualmente un navegador ni se modificaron cuentas reales del proyecto.

El build conserva advertencias de comentarios PURE de Zod y un bundle principal de unos 739 kB (217 kB gzip), sin impedir compilar. No se ocultaron advertencias modificando dependencias.

## Prueba manual y siguiente fase

Con migración inicial aplicada, Auth/SMTP configurados y cuentas de prueba existentes:

1. Registrar un publicador nuevo, confirmar el correo y completar organización; debe quedar pending y sin permisos.
2. Abrir su dashboard y verificar el mensaje de revisión pendiente.
3. Entrar como admin, filtrar pendientes, abrir detalle y aprobar solo servicio social.
4. Actualizar el dashboard del publicador: debe mostrar aprobación y solo ese permiso. La creación de ofertas sigue pendiente de Fase 3.
5. Revocar el permiso como admin y verificar auditoría antes/después; el dashboard debe reflejarlo al actualizar.
6. Suspender con motivo y revisar el historial; con otra solicitud pending, probar rechazo con motivo.
7. Intentar las rutas administrativas con publisher/student: 403. No se puede conceder permisos ni cambiar su estado manipulando la interfaz.

Fase 3 queda pendiente: CRUD de borradores, envío, revisión de ofertas y conservación de la versión publicada. No se continúa hasta una nueva instrucción.
