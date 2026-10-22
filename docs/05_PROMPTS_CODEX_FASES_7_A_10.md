# UniOportunidades — Prompts para Codex (Fases 7–10)

**Uso:** copia **un solo prompt por vez** en Codex. Adjunta o coloca en `docs/` el archivo `04_PLAN_FINAL_FASES_7_A_10.md`. Antes de iniciar, confirma que la Fase 6 está en un commit estable. Pide a Codex que se detenga tras cada fase; revisa el resultado real antes de pasar a la siguiente.

---

## Prompt para Fase 7 — UX, sesión, usuarios y miembros

```text
Continúa el proyecto UniOportunidades ejecutando ÚNICAMENTE la Fase 7 del documento 04_PLAN_FINAL_FASES_7_A_10.md. Antes de implementar, lee ese plan y revisa el código y las pruebas existentes de las fases 0–6. Objetivo: refinar UX y operaciones existentes SIN rediseñar la identidad azul/amarilla, sin reescribir la arquitectura y sin añadir funciones de negocio ajenas al alcance.

PRIORIDAD 1 — Resolver «Validando sesión…» al cambiar de pestaña. Revisa apps/web/src/features/auth/AuthProvider.tsx y ProtectedRoute.tsx: actualmente los eventos de onAuthStateChange vuelven a poner auth.status='loading' y ejecutan cache.clear() incluso cuando se trata de la misma identidad. Distingue inicialización real, cambio de identidad y cierre de sesión de revalidación en segundo plano. Mantén la UI montada al recuperar foco o renovar el token de la misma cuenta; actualiza el token vigente, evita recargas indiscriminadas de caché, peticiones duplicadas y condiciones de carrera. La seguridad NO debe degradarse: una salida real entre pestañas, token inválido o perfil deshabilitado deben bloquear correctamente el acceso. No soluciones el síntoma escondiendo una pantalla con un temporizador. Añade pruebas para INITIAL_SESSION, SIGNED_IN redundante, TOKEN_REFRESHED, SIGNED_OUT, dos pestañas, error de red, cambio de usuario y respuestas tardías.

PRIORIDAD 2 — Mejorar panel del publicador. Usa datos reales y los estados correctos de revisión/publicación para mostrar resumen operativo compacto (borradores, en revisión, rechazadas, publicadas/activas según definiciones exactas), oportunidades recientes y enlaces rápidos. Condensa datos organizacionales duplicados y mantén estado/permisos visibles. No inventes cifras ni introduzcas consultas N+1.

PRIORIDAD 3 — Mejorar /admin/usuarios. Actualmente apps/web/src/features/admin/UsersPage.tsx y ProfilesRepository.list() ofrecen una tabla sin filtros, limitada a las últimas 100 cuentas. Implementa directorio de lectura con búsqueda nombre/correo, filtros por rol y activo, paginación real del servidor, conteo total, buenos estados de tabla y responsive. Preserva autorización exclusivamente admin, valida parámetros y limita los campos retornados. NO implementar edición de roles, altas/bajas, ni operaciones destructivas.

PRIORIDAD 4 — Miembros de organización. Ya existe public.miembros_organizacion. Añade una vista «Miembros de mi organización» para publicadores, mostrando solamente miembros existentes (nombre, rol interno, estado y correo pertinente). Deriva la organización desde el perfil/membresía autenticada en la API, jamás desde un ID arbitrario del cliente. Evita que un publicador vea otra organización. No implementar invitaciones, alta/baja de miembros o cambio de roles; si los datos demo tienen solo un miembro, mostrar ese miembro correctamente sin inventar otros. Agrega rutas, contratos Zod, UI y pruebas de aislamiento entre organizaciones y roles. Si se requiere migración, explica primero por qué; aprovecha el modelo existente.

Mejora pequeños detalles de espaciado, accesibilidad y experiencia móvil, pero conserva los aspectos del catálogo y diseño de Fase 6 que ya funcionan. No cambies reglas de aprobación, permisos ni versionado. Actualiza pruebas de frontend/API/E2E y la documentación correspondiente. Ejecuta npm.cmd test, npm.cmd run test:e2e, npm.cmd run build, npm.cmd run lint, npm.cmd run format:check y npm.cmd run audit:security según dependencias necesarias. Reporta comandos realmente ejecutados, resultados y pruebas manuales a realizar con Supabase real. No ejecutes escrituras/migraciones/seeds remotos sin autorización; detente al completar Fase 7.
```

---

## Prompt para Fase 8 — Seguridad y fiabilidad

```text
Ejecuta ÚNICAMENTE la Fase 8 del archivo 04_PLAN_FINAL_FASES_7_A_10.md. Primero revisa el código actualizado por Fase 7 y sus pruebas; no asumas que los componentes conservan ubicaciones anteriores. La meta es seguridad y fiabilidad adecuadas para un proyecto de portafolio accesible públicamente, NO crear infraestructura empresarial ni integrar SSO institucional.

Audita y prueba sistemáticamente los endpoints existentes: autenticación, rol, cuenta activa, propiedad de oferta, permisos de publicación, estado de organización, moderación, versiones aprobadas vs pendientes, directorio admin y listado de miembros. Incluye intentos de acceder a datos de otras organizaciones cambiando IDs, payloads manipulados, usuario sin membresía, tokens inválidos o caducados, doble envío y conflictos. La autorización siempre se valida en el backend. Comprueba los controles de catálogo: nunca filtrar borradores o revisiones pendientes a estudiantes.

Revisa validación Zod, SQL parametrizado, CORS, límites de cuerpo y tamaño de búsquedas, rate limiting de login/registro y configuración detrás de proxy, TLS/timeout del pool PostgreSQL, errores y logs, variables de entorno, secretos y bundles frontend. Evalúa vulnerabilidades de dependencias de forma contextualizada. Corrige problemas de severidad alta/crítica y los fallos razonables para este alcance. No introduzcas Redis, microservicios u observabilidad compleja si no hacen falta para una instancia pequeña. Examina la sesión de Fase 7 para asegurar que no persiste autorización inválida indefinidamente. Revisa el campo 'phase: 5' del healthcheck y su contrato si conviene sustituirlo por información neutral de estado o versión de aplicación.

Crea docs/security-review.md con metodología, áreas revisadas, evidencias, hallazgos, correcciones, riesgos aceptados y límites: distingue tests aislados de comprobaciones realizadas realmente en Supabase. Ejecuta todas las pruebas, E2E, build, lint, formato y audit:security, informa resultados REALES. No afirmes 'seguro al 100%' ni 'pentest completado'. No cambies datos o configuración remota sin consentimiento; detente al terminar Fase 8.
```

---

## Prompt para Fase 9 — Deploy

```text
Ejecuta ÚNICAMENTE la Fase 9 del documento 04_PLAN_FINAL_FASES_7_A_10.md, que tiene por objetivo desplegar UniOportunidades como prototipo de portafolio en HTTPS (React frontend + Express API + Supabase Auth/PostgreSQL). Antes de modificar infraestructura o generar gastos, analiza el monorepo actual, comandos y variables, y recomienda UNA arquitectura de despliegue simple y de costo razonable (p. ej. frontend estático + API Node administrada). Explica costos/riesgos conocidos, configuración necesaria y pasos que requieren que el usuario actúe. Solicita confirmación antes de desplegar, crear servicios, generar costos, ejecutar migraciones, seeds o modificar datos remotos. No inventes que existe una cuenta/servicio ya creado.

Prepara el repositorio para cloud sin romper localhost. En apps/api/src/server.ts revisa que el servidor escucha actualmente 127.0.0.1: debe escuchar en la interfaz y puerto adecuados para el proveedor (por ejemplo 0.0.0.0 + PORT) con configuración segura. Define start/build correctos para workspaces, entorno Node, orígenes permitidos, proxy o URL absoluta de API, VITE_API_BASE_URL, WEB_ORIGIN, rutas SPA con fallback a index.html, HTTPS, redirecciones Auth, conexión Supabase por TLS, logs de diagnóstico sin secretos y healthcheck. Configura rate limiting según la topología real. Documenta instrucciones reproducibles por proveedor y rollback.

Separa información ficticia de datos reales. Usa una instancia demo controlada cuando sea posible; no publiques credenciales de admin ni de publicadores privilegiados. No expongas DATABASE_URL ni SERVICE_ROLE en frontend y desactiva seed remoto tras preparar datos demo si aplica. Define una estrategia deliberada para registro público de organizaciones y mitigación de abuso.

Con usuario autorizado y hosting disponible, despliega; ejecuta pruebas manuales completas por rol, recarga de rutas profundas, sesión entre pestañas, errores, CORS y acceso desde la Wi-Fi de la Universidad de Sonora. Antes se observó que puertos 5432 y 6543 hacia Supabase fallan desde esa red: ahora el navegador debe usar la API pública por HTTPS y solamente el backend hospedado llega a PostgreSQL. Si no puedes verificar el deploy real o la red universitaria, márcalos PENDIENTES, jamás como comprobados.

Entrega docs/deployment.md, cambios realizados, URL real solo si existe, costos/limitaciones, resultados de pruebas y lista concreta de acciones que el usuario deba completar. No avances a Fase 10 hasta solicitarlo.
```

---

## Prompt para Fase 10 — Documentación, demo y v1.0

```text
Ejecuta ÚNICAMENTE la Fase 10 del documento 04_PLAN_FINAL_FASES_7_A_10.md. Objetivo: convertir UniOportunidades en un proyecto full-stack de portafolio terminado, explicable y presentable. No agregues funciones de negocio nuevas ni realices otro rediseño general.

Revisa la implementación real y los resultados de fases 7–9; actualiza README.md con descripción atractiva pero precisa, capturas auténticas disponibles, arquitectura/stack, funciones por rol, URL de demo solamente si existe y fue verificada, setup local, comandos exactos, variables de entorno solo por nombre, pruebas, limitaciones y aviso explícito de prototipo académico no oficial de UNISON. Ajusta docs/architecture.md, docs/api.md, docs/deployment.md, docs/demo.md y cualquier documento de fases desactualizado. Incluye un diagrama legible React -> Express -> Supabase, flujo Auth/permisos y explicación del esquema de revisiones y versión publicada. No afirmes integración institucional, seguridad certificada ni funcionamiento remoto que no esté probado.

Prepara guion demostrativo de 5–10 minutos mostrando estudiante, organización, revisión admin, versión publicada estable durante edición pendiente, directorio admin y miembros de la organización. Distingue credenciales privadas para presentar de cualquier demo público de acceso limitado. Asegura que archivos de configuración, secretos y passwords no acaben en el repositorio ni en capturas. Documenta cómo desplegar/reproducir el proyecto y cómo verificarlo con Supabase real, sin copiar datos personales.

Crea matriz de aceptación final con evidencia específica: tests automáticos, pruebas manuales locales, pruebas cloud, móvil y red UNISON; cualquier pendiente debe quedar señalado. Corre tests/E2E/build/lint/format/auditoría; verifica rutas, enlaces y capturas. Sugiere una lista breve de mejoras futuras separada del alcance de v1.0. NO crees un tag Git v1.0.0 ni declares publicación final hasta que el usuario confirme que la matriz y demo satisfacen los criterios. Entrega resumen final y detente.
```

---

## Verificación manual rápida por fase

**Después de Fase 7:** cambiar pestaña 10–15 veces sin pantalla de carga; cerrar sesión desde la otra pestaña; recargar; probar `TOKEN_REFRESHED` con tests; admin filtra/pagina usuarios; cada publicador ve exclusivamente sus miembros; verificar dashboard y móvil.

**Después de Fase 8:** intentar acceder por API a datos de otra organización con un publicador; denegar lectura a cuentas sin rol; invalidar token; examinar logs y código empaquetado para detectar secretos; ejecutar la suite completa.

**Después de Fase 9:** comprobar URL HTTPS real en Wi-Fi de campus, móvil y hotspot; login por cada rol; recarga directa en `/admin/usuarios` y `/publicador/panel`; edición/revisión/publicación y refresco de token; revisar costos.

**Después de Fase 10:** abrir README desde cero, reproducir demo con documentación, explicar arquitectura de memoria y etiquetar versión solo con aceptación del autor.
