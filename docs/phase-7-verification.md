# Verificación de Fase 7

Fecha: 21 de octubre de 2026. Alcance: únicamente UX, directorios de lectura y estabilidad de sesión de la Fase 7 de `04_PLAN_FINAL_FASES_7_A_10.md`. Base Git estable encontrada: `e4a179b` (Fase 6). Se revisaron plan, verificaciones 0–6, esquema, repositorios, guards, contratos, pruebas React/API y harness Playwright antes de implementar. Las fases 8–10 no se ejecutaron.

## Cambios y decisiones

- **Sesión:** inicialización única por `INITIAL_SESSION`; identidad por `session.user.id`; token actual publicado inmediatamente. Eventos redundantes de la misma cuenta revalidan perfil sin desmontar UI ni limpiar caché. Una petición por generación agrupa eventos; nuevos tokens se comprueban después de descartar la respuesta anterior. Respuestas tardías y reintentos no revierten cambio de usuario/cierre. `SIGNED_OUT` entre pestañas retira acceso. Cambios efectivos de autorización limpian datos y remontan el árbol protegido. Los 401/403 y perfiles inactivos bloquean; error temporal mantiene perfil ya validado solo hasta el vencimiento real del token, con aviso/reintento. No hay temporizador cosmético.
- **Publicador:** organización/estado/permisos compactos, enlaces a detalle/miembros y tareas, cinco recientes y métricas reales. Última revisión y puntero publicado se contabilizan por separado: pueden coincidir una edición pendiente y una publicación activa. Una consulta SQL obtiene métricas y cinco recientes; no N+1. Definiciones completas en `api.md`.
- **Usuarios:** consulta admin de solo lectura con nombre/correo literal, rol, activo, total y paginación en servidor; una sentencia obtiene página y total del mismo snapshot. Parámetros estrictos y acotados, SQL parametrizado, orden estable y cinco campos por cuenta. No hay edición de cuentas o roles.
- **Miembros:** ruta `/publicador/miembros`, disponible desde sidebar, panel e información propia. La API deriva membresía del usuario autenticado, rechaza IDs arbitrarios y devuelve únicamente nombre, correo interno, rol interno y activo de miembros reales. Mantiene lectura propia en estados pending/approved/rejected/suspended; la autorización de publicación no cambia. Sin invitaciones, altas/bajas ni cambio de roles.
- **Accesibilidad/móvil:** etiquetas explícitas de filtros; conteos/avisos anunciados; región de tabla enfocada y desplazamiento horizontal con ancho legible y aviso móvil. Se corrigió una regla CSS que hacía azul el texto del botón azul dentro de encabezados; Chromium comprueba su texto blanco. Se conserva identidad azul/amarilla, catálogo y sistema de componentes.

No se necesita migración: las consultas usan `perfiles`, `miembros_organizacion`, organizaciones, permisos, ofertas y revisiones existentes, con sus índices actuales. No se modificaron aprobación, versionado, RLS, seed productivo ni configuración del limitador de producción. No se instalaron dependencias ni se cambiaron variables. El plan de entrada se normalizó únicamente con Prettier; no se ejecutó trabajo de otras fases.

## Evidencia automatizada

Las pruebas nuevas cubren:

- `INITIAL_SESSION` con/sin sesión, `SIGNED_IN` redundante, `TOKEN_REFRESHED`, `USER_UPDATED`, deduplicación, token vigente, formulario/caché conservados y rechazo tardío de un token anterior.
- Cierre local y recibido desde otra pestaña; inicialización/reintento tardíos; cambio de usuario con respuestas fuera de orden; error de red/reintento; rol y permisos revocados; perfil inactivo; 401/403; expiración real sin renovación.
- SQL/HTTP con 105 cuentas: página posterior a 100 registros, filtros combinados y correo insensible a mayúsculas, búsqueda literal de comodines, parámetros inválidos/duplicados, orden consistente, vacío/página fuera de rango, campos mínimos y autorización admin.
- Dos organizaciones aisladas, un único miembro real, miembros inactivos, ausencia de membresía, estados organizacionales y roles no permitidos.
- Conteos de últimas revisiones frente a publicaciones abiertas/cerradas/vencidas/archivadas/suspendidas y edición pendiente de versión aprobada; una sola consulta del resumen y ceros reales.
- Contratos Zod del cliente: filtros codificados, estado false conservado, señal de cancelación y rechazo de respuestas inválidas.
- React: estados carga/error/reintento/vacío, filtros/paginación, conteos, miembros y tareas del publicador.
- Chromium: los ocho recorridos previos y tres nuevos; 31 cuentas efímeras para paginación real, miembros de publicadores distintos y organización pendiente, rutas profundas/recarga, 360 px, y dos pestañas con 12 alternancias, observación del DOM sin carga ni desmontaje del campo y cierre propagado.

El harness E2E añade 24 perfiles ficticios solo a PostgreSQL efímero. Asigna una IP controlada distinta por test para aislar intentos de login, conservando el limitador real dentro de cada test. No incorpora un mecanismo de bypass en producción. Las capturas bajo `test-results/` son locales, efímeras y de datos ficticios; no se guardan tokens/contraseñas, vídeos ni trazas.

## Comandos ejecutados y resultados

```powershell
# Límite local de workers; no cambia configuración del proyecto.
$env:VITEST_MAX_WORKERS='2'
npm.cmd test
npm.cmd run test:e2e
npm.cmd run build
npm.cmd run lint
npm.cmd run format
npm.cmd run format:check
npm.cmd run audit:security
```

También se ejecutaron pruebas dirigidas:

```powershell
npm.cmd exec -w @unioportunidades/web -- vitest run src/features/auth/AuthProvider.test.tsx --maxWorkers 1
npm.cmd exec -w @unioportunidades/web -- vitest run --maxWorkers 2
npm.cmd exec -w @unioportunidades/api -- vitest run src/modules/organizations/organizations.test.ts src/modules/offers/offers.test.ts
```

| Control final                  | Resultado                                                         |
| ------------------------------ | ----------------------------------------------------------------- |
| `npm.cmd test` con dos workers | 195/195 satisfactorias: 110 API + 85 web                          |
| `npm.cmd run test:e2e`         | 11/11 satisfactorias en Chromium                                  |
| `npm.cmd run build`            | API y web compiladas; JS 858.69 kB / 251.94 kB gzip; CSS 35.90 kB |
| `npm.cmd run lint`             | Sin errores ni advertencias                                       |
| `npm.cmd run format:check`     | Formato correcto                                                  |
| `npm.cmd run audit:security`   | 60 fuentes/artefactos de frontend revisados; findings: []         |

Incidencias intermedias registradas: el sandbox impidió inicialmente leer ancestros al arrancar esbuild; se ejecutaron checks locales con permisos del entorno. Ninguna acción fue rechazada por la revisión automática de aprobación. El arranque simultáneo de workers produjo timeouts; se acotaron a dos mediante variable del proceso. Una ejecución posterior sufrió otro timeout de procesos y se repitió. Se corrigieron dos fixtures/asserts React al nuevo contrato paginado, una etiqueta de select detectada por Chromium y dos opciones `exact` incompatibles con los tipos de Testing Library detectadas por build. El primer E2E acumuló intentos de login de distintos tests hasta el límite; se aisló el cliente por test en el harness. Una solución intermedia que recreaba apps durante la petición emitió validación de express-rate-limit y fue reemplazada por el aislamiento de clientes. El formato inicial detectó archivos nuevos y el plan de entrada sin normalizar; se aplicó Prettier. Estas ejecuciones fallidas no se cuentan como pruebas satisfactorias.

## Aceptación y límites

| Criterio de Fase 7                          | Validación local                                  | Supabase real    |
| ------------------------------------------- | ------------------------------------------------- | ---------------- |
| Recuperar foco conserva UI de sesión válida | React + dos pestañas Chromium                     | Pendiente        |
| Cierre/revocación/expiración protegen rutas | React + API; cierre entre pestañas Chromium       | Pendiente        |
| Panel prioriza tareas y cifras reales       | PostgreSQL embebido, React, Chromium              | Pendiente        |
| Directorio admin completo de lectura        | API con 105 cuentas; React; Chromium paginado     | Pendiente        |
| Solo miembros de organización propia        | API con dos organizaciones/roles; React; Chromium | Pendiente        |
| Catálogo, moderación, versiones y permisos  | Suites de regresión existentes                    | Pendiente remoto |

La auditoría `audit:security` revisa secretos y consultas directas de frontend con el script existente; no equivale a auditoría de dependencias o certificación. Se conservan advertencias conocidas de Vite sobre anotaciones de Zod y tamaño del bundle y mensajes de color del runner E2E. El healthcheck conserva `phase:5` por alcance; su revisión corresponde al plan de Fase 8.

## Comprobaciones manuales pendientes con Supabase real

1. Inicia el entorno existente, sin migrar ni resembrar. Abre dos pestañas con una cuenta. Mantén un filtro/formulario sin enviar, alterna 10–15 veces, vuelve después de renovar token y comprueba que no aparece carga global ni se pierde trabajo. Revisa Network: un evento redundante durante una validación no debe duplicar `/auth/yo`.
2. Recarga rutas profundas autenticadas y comprueba carga inicial legítima. Cierra sesión en una pestaña: la otra debe retirar contenido. Cambia cuenta y comprueba que ningún perfil/dato anterior reaparece.
3. Desconecta/red lenta mediante DevTools durante revalidación de fondo: UI válida y aviso con reintento; al volver la conexión se recupera. Sin renovación, la expiración real retira acceso. Comprueba token inválido y perfil inactivo con fixtures ya preparadas; no alteres perfiles remotos sin autorización.
4. Como admin, busca nombre/correo, combina rol/activo, recorre páginas si existen más de 20 cuentas y prueba vacío/limpiar. No crees cuentas remotas para probar paginación.
5. Como cada publicador, contrasta panel y estados reales. Comprueba revisión pendiente frente a versión publicada sin alterar publicaciones existentes. Abre miembros y verifica solo los miembros reales de esa organización, incluso si existe uno solo. Repite con organización pendiente/suspendida ya preparada.
6. Verifica 360 px, tablet y escritorio, teclado, foco y desplazamiento de tabla. Confirma que Crear es legible y solo aparece con estado/permisos efectivos. Explora catálogo, cuenta y rutas profundas conservadas.

No se realizaron conexiones, migraciones, seeds, despliegues ni escrituras contra Supabase remoto en esta fase. La aceptación remota y la revisión manual del usuario quedan pendientes. No se creó commit final ni etiqueta: el plan condiciona el commit de cierre a esa revisión manual. El trabajo se detiene en Fase 7.
