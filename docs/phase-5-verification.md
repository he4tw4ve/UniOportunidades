# Fase 5: cierre técnico y verificación

## Cambios

- `apps/api/src/db/adminRepository.ts`: indicadores en una sola consulta parametrizada y snapshot consistente. Rutas y composición en `modules/auth/router.ts` y `server.ts`. Solo admin; sin cambios del modelo.
- `apps/web/src/features/admin/AdminDashboard.tsx` y `UsersPage.tsx`: indicadores con actualización, carga/error/vacío y lista de usuarios de consulta. Se conservan rutas y estilo. No se habilita edición de roles.
- `RevisionForm.tsx`: valida los requisitos de envío antes de llamar API; mantiene guardado parcial de borrador y validación autoritativa en servidor. Error asociado al formulario, anuncio y estado ocupado.
- `Layouts.tsx` y `globals.css`: enlace de salto con destino enfocable, foco visible para campos y controles adaptables. Catálogo comprobado sin desbordamiento a 360 px. No se declara conformidad WCAG completa.
- `seed.ts` y CLI: escenarios por carrera y próximos a vencer exclusivamente al insertar ofertas nuevas, idempotencia conservada, mensaje final sin afirmar que reinicializó datos existentes. Las nuevas carreras de las ofertas seed no alteran las cuentas previas.
- `e2e/server.ts`, `demo.spec.ts`, `playwright.config.ts`: demo automatizada con UI/API reales, PostgreSQL embebido y Auth de pruebas. Puertos 3100/3101, sin `.env` de servidor ni escrituras remotas. No usar ese servidor de pruebas en producción.
- `scripts/audit-security.mjs`, scripts npm, README, contratos y guion `docs/demo.md`.

No se ejecutaron migraciones, seed ni escrituras en Supabase durante esta fase. No hacen falta migraciones ni nuevas variables de producción. Las mejoras no incorporan postulaciones, pagos, chat, archivos ni integración institucional.

## Comandos y resultados

```powershell
npm.cmd install -D @playwright/test
npm.cmd exec -- playwright install chromium
npm.cmd test
npm.cmd run build
npm.cmd run lint
npm.cmd run format
npm.cmd run format:check
npm.cmd run test:e2e
npm.cmd run audit:security
```

Vitest: 150 pruebas satisfactorias, 104 API y 46 web. Se ejecutó el esquema completo y repositorios en PostgreSQL embebido, incluido el seed y su repetición. Se conservaron pruebas anteriores de autorización, carreras, versiones, decisiones dobles, conflictos y rollback. Build de API/web y lint satisfactorios. Playwright: 4 pruebas satisfactorias en Chromium; verifica acceso de los tres roles, detalle/contacto, persistencia al recargar, cierre de sesión, diálogo móvil, indicadores, usuarios y flujo HTTP completo de rechazo/reenvío/aprobación/edición pendiente/cierre. También comprueba teclado, campos obligatorios y error de credenciales.

Vite conserva advertencias sobre anotaciones PURE de Zod y bundle de aproximadamente 836 kB (246 kB gzip), sin impedir compilación. No se presenta como optimización de rendimiento completada. Las primeras ejecuciones de Playwright detectaron un token inconsistente en el adaptador aislado, que se corrigió y se volvió a probar; no se alteró Auth de producción. Lint detectó accesos dinámicos partidos y globals de MJS, corregidos antes de cerrar.

## Auditoría de endpoints y secretos

La prueba `audita todas las familias de endpoints protegidos antes de validar cuerpos` envía solicitudes sin token y con roles student/publisher a métricas, usuarios, organizaciones, decisiones, permisos, cola, correcciones y cambios de estado admin. Espera 401/403. Las rutas de publicación rechazan student y token ausente. Pruebas específicas adicionales verifican propietario, organización pendiente, tipo no autorizado y que el publicador no se conceda permisos. Un guard visual no sustituye las comprobaciones de API.

La auditoría local verifica archivos `.env` versionados, coincidencias exactas de DATABASE_URL/service_role/contraseñas demo en fuentes y build web, posibles claves privadas y llamadas directas de negocio con supabase.from/rpc. Resultado sin hallazgos. No imprime valores. La instalación reportó 0 vulnerabilidades conocidas en 433 paquetes. Esto no es una auditoría externa ni demuestra ausencia absoluta de secretos; tampoco inspecciona historial remoto de Git. El servidor mantiene SSL verificado y no almacena contraseñas en tablas de negocio.

## Matriz de los 12 criterios

“Automatizado local” significa prueba ejecutada con PostgreSQL embebido y/o navegador, no validación del proyecto Supabase remoto. El cierre de aceptación remota sigue pendiente del recorrido manual en `docs/demo.md`.

| N.º | Criterio y evidencia ejecutada                                                                                                                                 | Límite / comprobación manual                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | Auth API prueba expediente; catálogo prueba carrera propia + alcance all y Ver todas; Playwright inicia sesión estudiante y navega catálogo.                   | Auth local sustituido; repetir con DEMO-001 en Supabase.                                                         |
| 2   | `database.test.ts` y organizaciones prueban registro transaccional pending sin permisos; sesión/correo confirmados exigidos por middleware.                    | Confirmación de correo/SMTP real pendiente.                                                                      |
| 3   | Organizaciones prueban aprobación/permisos por tipo y bloqueo de autopermisos; Playwright rechaza internship para publicador solo social_service.              | Repetir aprobación manual en datos demo autorizados.                                                             |
| 4   | Ofertas y Playwright HTTP ejecutan crear, enviar, rechazar con motivo y reenviar nueva versión. UI prueba presentación de rechazos.                            | Recorrido completo con ambos roles reales pendiente.                                                             |
| 5   | Prueba HTTP de ofertas y Playwright aprueban y leen título publicado desde la misma base.                                                                      | Repetir contra Supabase configurado.                                                                             |
| 6   | Ofertas, catálogo y Playwright comprueban que draft/pending no reemplaza contenido publicado ni filtros/contacto.                                              | Comprobar visualmente con estudiante en otra sesión.                                                             |
| 7   | Playwright aprueba nueva versión, comprueba título nuevo e historial de tres versiones. Pruebas de ofertas conservan anteriores/auditoría.                     | Revisar historial y actor en panel real.                                                                         |
| 8   | Catálogo prueba vencidas, cerradas y archivadas, inclusive hoy; Playwright cierra y recibe 404 del catálogo sin borrar oferta.                                 | No se alteró reloj ni fechas remotas; probar cierre en oferta creada para demo.                                  |
| 9   | Ofertas prueba que dueño ajeno no ve, edita, envía, clona ni cierra.                                                                                           | Intentar URL de otra organización con cuentas demo.                                                              |
| 10  | Auditoría HTTP 401/403 y pruebas de organizaciones/permisos; Playwright bloquea área admin para publisher.                                                     | No existe editor público de roles; repetir accesos prohibidos.                                                   |
| 11  | AuthProvider prueba sesión persistida, descarte de respuesta obsoleta y limpieza de caché; Playwright recarga detalle y cierra sesión, luego deniega catálogo. | Renovación real de token a largo plazo no probada.                                                               |
| 12  | Revisión de rutas/modelo: solo contacto externo, sin solicitudes internas ni SSO UNISON; tests de detalle verifican correo/enlace externo.                     | No existe una prueba que pueda demostrar por sí sola toda ausencia de integración; revisar navegación del guion. |

## Pendientes explícitos

- Ejecutar confirmación por correo y flujo completo de tres roles contra Supabase; no se declara terminado el criterio de aceptación remoto por pruebas aisladas.
- Comprobación manual con lector de pantalla y contraste exhaustivo; no se ejecutó una certificación de accesibilidad.
- El timeout intermitente de red hacia Supabase no se soluciona cambiando localhost ni se elimina con esta fase. El diagnóstico y mensaje 503 siguen disponibles.
- No hubo rediseño general, despliegue ni cambios fuera del alcance de Fase 5.
