# UniOportunidades — Plan de cierre (Fases 7–10)

**Objetivo:** terminar UniOportunidades como una **aplicación full-stack de portafolio, pública y demostrable**, con un nivel razonable de seguridad y calidad. No se pretende certificar ni operar un sistema institucional oficial de la Universidad de Sonora.

**Punto de partida:** Fases 0–6 implementadas. Arquitectura actual: npm workspaces, React/Vite/TypeScript, Express/TypeScript, Supabase Auth y PostgreSQL, API con control de acceso por roles, oportunidades versionadas, catálogo, dashboards, pruebas Vitest/Supertest/PGlite/Playwright. Conservar estas decisiones salvo razón técnica documentada.

## Reglas generales de ejecución

- Una fase a la vez. Al concluir, Codex debe **detenerse** y entregar un informe verificable. No declarar completada una fase únicamente por compilar.
- Ejecutar tests existentes, E2E cuando corresponda, build, lint, formato y auditoría de seguridad. Informar **comandos realmente ejecutados**, pruebas nuevas, advertencias y verificaciones manuales pendientes.
- No ejecutar migraciones, seeds, despliegues o escrituras **remotas** sin explicar primero su impacto y obtener autorización del usuario. Proteger los datos ya existentes.
- Evitar regresiones en roles, organizaciones, permisos, versiones de oferta y catálogo. No agregar postulaciones internas, mensajería, pagos, ni SSO institucional.
- No comprometer `.env`, contraseñas, cadenas de conexión, tokens ni service role. Nunca poner valores reales en ejemplos o documentación.
- Antes de empezar: commit Git con estado estable de la Fase 6. Tras cada fase: commit independiente si la revisión manual resulta satisfactoria.
- Documentar cambios de API y esquemas, actualizar tests, README y guion de demo según proceda.

---

## Fase 7 — Refinamiento UX, directorios y estabilidad de sesión

### Meta

Mejorar la experiencia diaria sin rediseñar de nuevo la identidad azul y amarilla. Resolver el cambio de pestaña que muestra «Validando sesión…», mejorar el dashboard del publicador, ampliar el directorio de usuarios del admin y permitir ver integrantes de la propia organización.

### 7.1. Corregir la revalidación visible de sesión (prioridad alta)

**Hallazgo en los archivos compartidos:** `apps/web/src/features/auth/AuthProvider.tsx` llama `load(session)` desde `onAuthStateChange`, y `load` ejecuta `cache.clear()` y `auth.status = "loading"` antes de obtener `/auth/yo`. `ProtectedRoute.tsx` sustituye la página por «Validando sesión…» cuando está en `loading`. Eventos de Supabase al recuperar foco o refrescar token pueden activar este comportamiento incluso si el usuario sigue autenticado.

**Comportamiento requerido:**

- Mostrar el estado de carga global **solo cuando aún no se conoce la sesión/perfil inicial**, o cuando realmente se cambia de identidad y debe bloquearse el contenido anterior.
- En revalidaciones de la **misma persona** (`SIGNED_IN` redundante, `TOKEN_REFRESHED`, retorno a pestaña, eventos equivalentes), mantener la interfaz visible, actualizar el token y comprobar el perfil en segundo plano cuando corresponda.
- No ejecutar `cache.clear()` ni desmontar rutas protegidas automáticamente por cada evento; invalidar o limpiar **de forma selectiva** al cambiar de cuenta, cerrar sesión o cuando realmente cambian los permisos.
- Evitar solicitudes duplicadas, condiciones de carrera y respuestas tardías de un perfil anterior; tener una única estrategia documentada de inicialización/refresco.
- Un `SIGNED_OUT` real (también entre pestañas) debe retirar inmediatamente el acceso al contenido privado; un error de autorización confirmado nunca debe dejar un acceso privilegiado vigente.
- Una pérdida temporal de conexión durante una revalidación de fondo no debe borrar el estado válido sin necesidad; proporcionar error/reintento no intrusivo, con tratamiento seguro de sesiones expiradas y cambios de permiso.
- No debilitar la comprobación de roles ni sustituir validación real por un temporizador artificial que esconda el problema.

**Tests importantes:** evento repetido `SIGNED_IN` misma persona; `TOKEN_REFRESHED`; cambio y regreso de pestaña; refresco de navegador; primer inicio; `SIGNED_OUT`; cierre desde otra pestaña; cambio de identidad; respuesta desordenada de `/auth/yo`; error temporal de red; token inválido/perfil desactivado.

### 7.2. Dashboard del publicador

- Elevar el panel principal a **resumen operativo**: estado de organización, permisos, número de borradores, pendientes, rechazadas y publicadas/activas (usar semántica correcta entre revisión y estado operativo), más oportunidades recientes y acciones rápidas.
- Mantener como prioridad las ofertas: crear, revisar pendientes, corregir rechazadas y administrar publicadas; siempre respetar permisos efectivos.
- Condensar la tarjeta informativa de la organización y evitar duplicar contenido con «Información y estado» y «Mis oportunidades».
- Estados de carga/error/vacío, responsive y consultas eficientes (sin cargar todas las ofertas para contar registros si es evitable).
- No falsear métricas ni atribuir una edición pendiente a la versión publicada.

### 7.3. Directorio de usuarios de administración

**Hallazgo:** `apps/web/src/features/admin/UsersPage.tsx` muestra una tabla sencilla; `/admin/usuarios` usa `ProfilesRepository.list()` que devuelve los 100 perfiles más recientes, sin filtros ni paginación.

- Convertirlo en un directorio **de solo lectura** con búsqueda por nombre/correo, filtros por rol y estado activo/inactivo, paginación en servidor, total y estados vacíos claros.
- Añadir indicadores de rol/estado legibles, recuento y orden consistente; opcional mostrar organización del publicador si la consulta resulta segura y pertinente.
- No agregar cambio de roles, eliminación de cuentas ni modificación de perfiles en esta fase.
- Proteger el endpoint en API como **solo admin**; validar parámetros, limitar longitud de búsqueda y tamaño de página, usar consultas parametrizadas, minimizar campos devueltos y evitar exponer información sensible del estudiante.
- Actualizar esquema Zod del cliente y pruebas de paginación, filtros, autorización y respuesta vacía.

### 7.4. Miembros de la organización para publicadores

**Hallazgo:** ya existe `public.miembros_organizacion` en el esquema, con `usuario_id`, `organizacion_id`, `rol_interno = 'representative'`, y vínculo con `public.perfiles`.

- Crear un apartado **«Miembros de mi organización»**, accesible desde el dashboard o «Información y estado» (y sidebar si aporta valor).
- Mostrar solo los integrantes existentes: nombre, rol interno, estado y correo si es apropiado para el acceso autorizado.
- El backend determina la organización mediante el **usuario autenticado y su membresía**; nunca confiar en un `organizacion_id` enviado por el navegador para leer la lista de otra organización.
- Respuesta mínima, sin contraseñas, tokens ni información de estudiantes u otras organizaciones.
- En este modelo una organización puede tener solo un miembro en los datos actuales: mostrar correctamente esa situación; no inventar miembros.
- **Fuera de alcance:** invitaciones, incorporación, eliminación o cambio de roles de miembros. Si se considera necesario para una futura versión, documentarlo como mejora posterior.
- Probar lectura autorizada, aislamiento entre organizaciones, usuario sin membresía, organizaciones pendientes/suspendidas según la política existente y no-administradores intentando otros endpoints.

### 7.5. Pulido visual y regresiones

- Conservar la identidad azul/amarilla y el catálogo (no repetir Fase 6).
- Mejorar consistencia de encabezados, espaciado, densidad de información, textos y navegación; accesibilidad básica y mobile.
- Revisar rutas profundas, recarga de página y navegación de cuenta.
- Añadir tests de React, API y Playwright para los flujos nuevos.

### Aceptación Fase 7

1. Cambiar de pestaña y volver **no** muestra «Validando sesión…» si la sesión es válida.
2. El cierre de sesión y la revocación real de acceso siguen protegiendo las rutas.
3. El panel del publicador prioriza tareas y métricas reales.
4. El admin puede buscar, filtrar y paginar el directorio completo de usuarios, sin editar roles.
5. El publicador puede ver **solo** integrantes de su organización.
6. No se rompen catálogo, moderación, versiones y permisos; pasan tests/build/lint.

**Comprobación manual:** probar dos pestañas abiertas; alternar entre ellas 10–15 veces, cerrar sesión en una, comprobar la otra; entrar con demo admin y examinar filtros; entrar con cada publicador y examinar su membresía; verificar móvil.

---

## Fase 8 — Auditoría de seguridad y fiabilidad

### Meta

Dejar la aplicación segura **para una demostración pública controlada**, sin pretender seguridad empresarial ni integración real con datos institucionales.

### Actividades

**Autorización y aislamiento de datos**

- Revisar cada endpoint sensible: autenticación, estado `activo`, rol, pertenencia a organización, propiedad de oferta, permisos de tipo, organización aprobada/suspendida, acceso a revisiones pendientes y directorios.
- Agregar pruebas negativas con ID de otra organización, payload alterado, rol incorrecto, token ausente/inválido/expirado, cuentas suspendidas y escenarios de doble envío/concurrencia.
- Verificar que el catálogo público al rol autenticado únicamente devuelve versiones publicadas aprobadas y vigentes; no permitir leer borradores por ID.

**Validación y superficie de ataque**

- Revisar Zod, longitudes, consultas SQL parametrizadas, cuerpos máximos, CORS, errores y logs; proteger contra exposición de detalles internos.
- Evaluar rate limit de inicio de sesión/registro y su comportamiento real bajo proxies. El middleware actual (`apps/api/src/middleware/limiter.ts`) utiliza almacenamiento en memoria/IP: adecuar configuración a la arquitectura elegida, sin complejidad innecesaria para una sola instancia.
- Evitar secretos y credenciales en Git, en el bundle o en registros; actualizar ejemplos `.env.example`, scripts y auditoría. Comprobar dependencias y remediar hallazgos de relevancia real.
- Revisar la configuración de Supabase Auth y RLS; mantener operaciones de negocio por la API. Las pruebas automatizadas no sustituyen comprobaciones de la instancia real.

**Estabilidad y errores**

- Conexión PostgreSQL/TLS, límites y timeouts; fallos de red y reconexión; solicitudes repetidas; cierre limpio.
- Asegurar que la revalidación silenciosa de Fase 7 no deja una sesión inválida indefinidamente.
- Revisar `GET /health` para que deje de codificar la fase 5 como un supuesto dato de producción; mantener compatibilidad o actualizar contrato/pruebas.
- Revisar y priorizar advertencias de build; no bloquear la entrega por advertencias cosméticas.

**Verificación**

- Tests unitarios, integración y E2E; auditoría local y pruebas manuales de autorización con Supabase real de demostración.
- Elaborar `docs/security-review.md`: hallazgos, severidad, correcciones, riesgos aceptados y trabajos fuera de alcance. No afirmar que se realizó una auditoría profesional si no es el caso.

### Aceptación Fase 8

1. Sin vulnerabilidades críticas/altas **conocidas y reproducibles** en el alcance evaluado.
2. Casos negativos por rol, propiedad y membresía probados en API.
3. Secretos fuera del repositorio y frontend; CORS, rate limiting, errores y registros revisados.
4. Se distingue claramente qué se validó localmente y con Supabase real.
5. Tests/build/lint/audit pasan o queda justificación explícita de excepciones.

**Fuera de alcance:** pentesting formal, SSO oficial UNISON, monitorización de nivel empresarial, escalamiento a miles de usuarios, cumplimiento legal institucional completo.

---

## Fase 9 — Despliegue público controlado

### Meta

Obtener una **URL HTTPS funcional**, accesible sin conexión PostgreSQL directa desde la computadora del usuario, y verificarla expresamente desde la Wi‑Fi universitaria.

### Arquitectura esperada

`Navegador -> frontend HTTPS -> API Express HTTPS -> PostgreSQL Supabase`, con Supabase Auth. El frontend no recibe `DATABASE_URL` ni `SUPABASE_SERVICE_ROLE_KEY`.

### Actividades

1. Proponer hosting simple y de costo bajo (p. ej. frontend estático y API Node administrada). Comparar brevemente ventajas y limitaciones y escoger una arquitectura concreta antes de desplegar.
2. Adaptar Express al entorno cloud: el `apps/api/src/server.ts` actual escucha en `127.0.0.1`; en hosting probablemente deberá usar `0.0.0.0` y el `PORT` asignado. Mantener configuración segura y desarrollo local funcional.
3. Configurar builds, comandos de arranque, variables de entorno, SSL/TLS PostgreSQL, `WEB_ORIGIN`, URL de API, CORS y Vite. Configurar fallback SPA para rutas profundas y redirecciones de Auth.
4. Establecer HTTPS, comprobación de salud, un mínimo de logs de diagnóstico y recuperación tras reinicio.
5. Evaluar separar entorno demo de desarrollo. No desplegar datos reales de estudiantes; usar cuentas y organizaciones ficticias. Proteger credenciales demo privilegiadas; no publicar admin/passwords. Desactivar seed remoto por defecto después de provisionar datos controlados.
6. Definir si el registro de organizaciones estará activo en el demo público; si lo está, protegerlo contra abuso y documentar que no representa autorización institucional.
7. Probar CORS, sesión y cambio de pestañas, perfiles, altas permitidas, revisión, catálogo, recarga en rutas profundas, endpoints de salud.
8. Verificar desde la **Wi‑Fi UNISON**, móvil y hotspot. La universidad ya bloqueó puertos 5432 y 6543 desde el equipo local; la prueba relevante es que el navegador consume la API por HTTPS 443 y el backend remoto llega a Supabase.
9. Registrar URL, configuración sin secretos, despliegue/redeploy/rollback y costos/límites del proveedor elegido.

### Aceptación Fase 9

1. Frontend y API accesibles públicamente por HTTPS.
2. Backend obtiene datos reales de Supabase sin depender de la red local del desarrollador.
3. Flujos de estudiante, publicador y admin funcionan en la instancia desplegada.
4. Recargar rutas profundas, refrescar token, cambiar pestañas y cerrar sesión funciona.
5. Probado desde la red universitaria (si no se puede probar, declararlo pendiente y no afirmar éxito).
6. No se entregan secretos al navegador ni se publican cuentas admin de fácil acceso.

**Punto de control:** ningún despliegue que escriba datos reales ni costo recurrente no autorizado; pedir confirmación antes de ejecutar operaciones remotas.

---

## Fase 10 — Documentación, portafolio y entrega v1.0

### Meta

Que una persona ajena al proyecto pueda **entenderlo, ejecutarlo o explorarlo**, y que el autor pueda explicarlo de forma convincente en una entrevista o presentación.

### Entregables

- `README.md` de calidad: qué problema resuelve, alcance, demo/URL, capturas, funcionalidades por rol, tecnologías, inicio rápido, test/build, configuración, limitaciones y aviso de prototipo no oficial.
- `docs/architecture.md` actualizado: diagrama de componentes, ciclo de autenticación, roles/permisos, flujo de aprobación/versiones, modelo de datos y motivación de decisiones importantes.
- `docs/deployment.md`: proveedor elegido, variables **por nombre** sin valores sensibles, deploy/redeploy/rollback, rutas SPA/CORS, diagnóstico, operaciones mínimas y limitaciones de free tier.
- `docs/demo.md`: guion de 5–10 minutos; dos caminos: demo segura pública limitada y demo privada con roles privilegiados; datos ficticios.
- Capturas reales legibles: landing, catálogo, admin, publicador, directorio de usuarios, miembros de organización.
- Verificación responsive, accesibilidad, flujos manuales y una **matriz final de aceptación** con probado local / probado en cloud / pendiente.
- GitHub limpio: sin `.env`, dependencias generadas, artefactos grandes, secretos ni documentación contradicha; licencia solo si el autor decide otorgarla; créditos de recursos gráficos cuando corresponda.
- Marcar versión **v1.0.0** solo tras pasar la verificación final; registrar mejoras futuras separadas, sin tratarse como requisitos del prototipo.

### Temas que el autor debe poder explicar

1. Request React → Express → Supabase PostgreSQL y separación de secretos.
2. Supabase Auth, recuperación de sesión, token refresh y autorización real en API.
3. Diferencia entre rol y permisos de organización.
4. Versionamiento de oportunidades y por qué una edición pendiente no reemplaza la versión publicada.
5. Migraciones, seeds idempotentes y pruebas automatizadas frente a pruebas reales.
6. Problema de red universitaria y por qué un backend hospedado lo resuelve.

### Aceptación Fase 10 / definición de terminado

- [ ] Fases 7–9 validadas con evidencia.
- [ ] Seguridad básica y riesgos residuales documentados honestamente.
- [ ] URL pública de demostración y experiencia estable en móvil/escritorio.
- [ ] Todas las acciones principales por rol verificadas en deploy.
- [ ] README, arquitectura, despliegue y demo actualizados.
- [ ] Screenshots auténticos y guion de presentación.
- [ ] Git limpio, tests/build/lint y registro de versiones.
- [ ] Etiqueta `v1.0.0` creada **solo después** de la aceptación.

## Trabajo posterior a v1.0 (no bloqueante)

Integración oficial de identidad UNISON, invitaciones/gestión de miembros, funciones de búsqueda avanzada o notificaciones, mejoras de rendimiento para escala mayor, observabilidad y operaciones institucionales. Estas ideas no deben expandir el alcance de las fases de cierre.
