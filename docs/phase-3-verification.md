# Fase 3: publicación, versiones y moderación

## Implementado y límites

El publicador crea borradores desde `/publicador/ofertas/nueva`, los actualiza y los envía desde `/publicador/ofertas/:id/editar`. El listado propio tiene filtros por tipo, estado y texto, paginación y separación de última edición frente a versión publicada. Tras un rechazo, una revisión nueva conserva el motivo y el historial anterior.

Administración consulta `/admin/revisiones` y `/admin/ofertas`; el detalle `/admin/ofertas/:id` compara publicada y última versión, permite aprobar/rechazar con confirmación (motivo obligatorio al rechazar), cerrar/reabrir/archivar o crear una corrección nueva autoaprobada y auditada. El histórico conserva versiones, decisiones, motivos, actores y fechas.

La versión pendiente nunca sustituye el puntero publicado. `/ofertas/:id` presenta únicamente el contenido aprobado vigente visible y contacto externo, sin postulaciones. El listado del catálogo para estudiantes, sus filtros y personalización continúan pendientes de Fase 4.

No cambia el modelo relacional ni se añade una migración. Se usa el esquema inicial con sus índices de una revisión abierta y una decisión final. No se ejecutaron migraciones, seed, escrituras ni envíos de correo contra Supabase remoto. No se imprimieron secretos ni se alteraron `.env` o SSL.

## Archivos principales

- `apps/api/src/db/offersRepository.ts`: SQL parametrizado y transacciones de creación, actualización, clonado, presentación, decisión, estado, corrección y lectura publicada.
- `apps/api/src/modules/offers/{validation,router}.ts`: validación Zod, día de Hermosillo y endpoints.
- `apps/api/src/modules/offers/offers.test.ts`: 17 pruebas SQL/HTTP del ciclo completo y seguridad.
- `apps/api/src/modules/auth/router.ts`, `server.ts`, `app.ts`: integración y healthcheck phase=3.
- `apps/web/src/lib/offers.ts`: contratos y cliente tipado.
- `apps/web/src/features/ofertas`: formulario React Hook Form, listados, detalle/editor, moderación, comparación y detalle visible.
- Router, portada y acceso desde dashboard publicador actualizados.
- `seed.ts` conserva las instrucciones de contacto al crear las revisiones ficticias 2; se comprobó con el test SQL idempotente. No sobrescribe revisiones ya existentes ni se ejecutó contra el proyecto remoto.
- `README.md`, `docs/api.md` y `docs/architecture.md`: comandos, contratos, decisiones de concurrencia y límites.

## Verificación ejecutada

| Comando                                                                             | Resultado                                      |
| ----------------------------------------------------------------------------------- | ---------------------------------------------- |
| `npm.cmd run test -w @unioportunidades/api -- src/modules/offers/offers.test.ts`    | 17 casos SQL/HTTP aprobados                    |
| `npm.cmd run test -w @unioportunidades/web -- src/features/ofertas/Offers.test.tsx` | 9 casos React aprobados                        |
| `npm.cmd test`                                                                      | 114 pruebas aprobadas: 85 API y 29 web         |
| `npm.cmd run build`                                                                 | API TypeScript y web TypeScript/Vite correctos |
| `npm.cmd run lint`                                                                  | Sin errores ni advertencias                    |
| `npm.cmd run format`                                                                | Formato aplicado                               |
| `npm.cmd run format:check`                                                          | Sin diferencias                                |

El build conserva advertencias de comentarios PURE de Zod y bundle principal de unos 803 kB (237 kB gzip). No impiden compilar; no se modificaron dependencias para ocultarlas.

Los tests de API ejecutan el esquema y los repositorios reales en PostgreSQL embebido, con transporte de Auth simulado. El test de ciclo HTTP crea, envía, ve la cola, aprueba y consulta el detalle publicado como estudiante. La prueba de edición compara exactamente el resultado público antes y después de draft/pending y comprueba que solo una nueva aprobación lo sustituye.

Casos de concurrencia cubiertos como solicitudes duplicadas/desactualizadas: doble aprobación con el mismo token da 200/409 y solo un dictamen; dos solicitudes de nueva revisión no abren dos drafts; un guardado obsoleto no sobreescribe la edición actual. No se afirma que se haya hecho una prueba de carga contra múltiples conexiones PostgreSQL remotas.

También se comprueban propiedad (404 sin filtrar datos), token/roles, permisos por tipo, revocación entre crear/enviar, suspensión entre enviar/aprobar, inmutabilidad de pending/approved, rechazo con motivo, carreras, protocolos de contacto, cierre/reapertura, vigencia de Hermosillo, archivo lógico, corrección auditada y rollback por fallo de auditoría.

React se prueba con jsdom y API simulada: guardado/envío separados, validación de contacto, errores de guardado, filtros/vacío, publicada y pendiente separadas, confirmación de moderación, motivo de rechazo, corrección confirmada, detalle aprobado y error/reintento. No se hizo una revisión visual en navegador ni un flujo real de login contra Supabase en esta fase.

## Decisiones de implementación

Tras ajustar las revisiones ficticias del seed, se ejecutó también `npm.cmd run test -w @unioportunidades/api -- src/db/database.test.ts`: 6 casos aprobados. Se repitieron build de API, lint y comprobación de formato, todos correctos.

- Guardar draft respeta los campos obligatorios del SQL (título, descripción, fecha, cupos y medio de contacto); la validación completa se exige al enviar/aprobar.
- El tipo se fija al crear y no se acepta en actualizaciones de revisión.
- Los tokens opacos de revisión usan timestamps + xmin de PostgreSQL; los de oferta usan updated_at. No se añaden columnas.
- Una aprobación posterior no reabre ofertas cerradas. Reabrir exige publicación aprobada vigente, organización aprobada y permiso actual del tipo.
- La aprobación y corrección administrativa vuelven a comprobar permiso y organización; rechazo puede resolver una revisión aunque se haya revocado el permiso.
- Una corrección administrativa se bloquea mientras hay draft/pending. No se descarta trabajo ajeno silenciosamente.
- Si un seed antiguo dejó una edición pending sin instrucciones de contacto, recházala con motivo, crea otra revisión y completa el campo antes de reenviar. No se reparan revisiones congeladas silenciosamente ni se sobrescriben desde el seed.
- Crear y enviar desde el formulario son dos operaciones explícitas: si guardar tiene éxito y enviar falla, se conserva el draft y se muestra el error para corregirlo sin duplicar ofertas.
- Archivo es solo admin y es irreversible en el flujo normal; no elimina historia.

## Guía manual con la Fase 1 configurada

1. Iniciar servicios con `npm.cmd run dev` y entrar como publisher de una organización aprobada con permiso del tipo.
2. Crear y guardar una oportunidad; completar los datos y enviarla a revisión.
3. Como admin, abrir la cola, revisar ambas columnas y aprobar; abrir el enlace al detalle publicado.
4. Como publisher, crear otra revisión, cambiar título/contacto/carreras y enviar. El enlace publicado debe conservar el contenido aprobado anterior.
5. Rechazar con motivo; comprobarlo como propietario y crear una nueva revisión para corregir y reenviar.
6. Aprobar la corrección: solo entonces debe cambiar el contenido publicado.
7. Cerrar/reabrir y, como admin, archivar. Verificar que el historial permanece y el detalle visible deja de estar disponible cuando corresponde.
8. Sin draft/pending abierto, realizar una corrección administrativa con motivo; comprobar nueva versión, decisión aprobada y auditoría.

La implementación se detiene en Fase 3. Fase 4 queda pendiente de una nueva instrucción.
