# UniOportunidades — instrucciones para Codex

## Cómo empezar

1. Crear y abrir una carpeta vacía llamada `unioportunidades` en VS Code.
2. Copiar a su raíz los documentos `01_ESPECIFICACION_CODEX.md` y `02_ESQUEMA_SQL.sql` (también se pueden colocar en `docs/`).
3. Abrir el panel de Codex y usar primero el prompt de **Fase 0**.
4. Conectar Supabase cuando Codex solicite los valores para el `.env` local. **Nunca pegar secretos reales en el chat, en commits ni en archivos públicos.** Usar `.env` ignorado por Git.
5. Trabajar por fases; pedir pruebas, revisar cambios y hacer commits pequeños.

## Prompt inicial para Codex (Fase 0)

```text
Estamos creando UniOportunidades, un prototipo funcional de un portal de servicio social y prácticas profesionales para estudiantes de la Universidad de Sonora.

Lee COMPLETAMENTE estos dos archivos antes de generar código:
- 01_ESPECIFICACION_CODEX.md (requisitos funcionales, arquitectura, rutas, flujos, alcance y aceptación)
- 02_ESQUEMA_SQL.sql (esquema relacional de referencia)

Trata la especificación como fuente de verdad. NO añadas gestión de postulaciones, pagos, chat, generación de currículums ni integración real con UNISON. La interfaz completa debe estar en español; código y nombres internos pueden estar en inglés si es más mantenible. No uses contraseñas universitarias reales.

Primera tarea: ejecuta SOLO la Fase 0: configura un monorepo npm workspaces con React + Vite + TypeScript, Tailwind CSS + shadcn/ui, Express + TypeScript y una estructura por módulos. Añade scripts dev/build/test/lint donde sea posible, archivos .env.example sin secretos, healthcheck de API, cliente API tipado, manejo básico de errores y un README con comandos ejecutables. Crea layouts coherentes de catálogo, publicador y administrador, con rutas protegidas preparadas para integrarse después, SIN fingir que la autenticación o los datos ya funcionan.

Antes de terminar, ejecuta las verificaciones disponibles y corrige fallos. Resume archivos creados, comandos reales ejecutados, resultados y lo que queda para Fase 1. No pases a la siguiente fase hasta que lo solicite.
```

## Fase 1: migraciones, autenticación, seed

```text
Continúa con la Fase 1 de 01_ESPECIFICACION_CODEX.md, usando 02_ESQUEMA_SQL.sql como base de migración versionada. No modifiques el modelo sin documentar la razón. Implementa Supabase Auth con perfiles/roles, login demo de estudiante por expediente, login por email para publisher/admin, middleware de sesión validada, endpoints /auth/yo, DB repositories y seed-demo idempotente de cuentas FICTICIAS. No almacenes contraseñas en Postgres ni expongas service_role/DATABASE_URL al frontend. Activa RLS y no habilites consultas de negocio directas desde el navegador. Implementa tests que denieguen operaciones por rol y acceso sin token. Documenta exactamente qué debo configurar en Supabase. Ejecuta tests/build y reporta resultados; detente al acabar Fase 1.
```

## Fase 2: alta y aprobación de organizaciones

```text
Implementa Fase 2: registro autoservicio de publicador/organización (email confirmado, organización pending); dashboard publicador con estado de revisión; panel admin para aprobar, rechazar y suspender organizaciones y conceder/revocar permisos de social_service/internship. Registra historial y auditoría. Las decisiones y permisos deben aplicarse en la API con transacciones. Implementa UI española con estados de carga, error y vacío. Escribe tests: un publicador pendiente no puede publicar, uno aprobado pero sin permiso tampoco, y nunca puede concederse permisos. Ejecuta build y tests y detente.
```

## Fase 3: ofertas con versiones y moderación

```text
Implementa Fase 3: oferta + versiones (draft/pending/approved/rejected), formulario para crear y actualizar borradores, presentación a revisión, cola admin, rechazo con motivo y aprobación transaccional, histórico de decisiones, cierre/reapertura/archivo y edición corregida por admin auditada. Es obligatorio que una edición pendiente NO sustituya la versión publicada; consulta 01_ESPECIFICACION_CODEX.md. Incluye pruebas con casos de concurrencia o doble aprobación, control de propietario, restricción de tipo permitido y protección de revisión publicada. Ejecuta tests/build y detente.
```

## Fase 4: catálogo estudiantil

```text
Implementa Fase 4: catálogo y detalles usando EXCLUSIVAMENTE versiones aprobadas, ofertas abiertas, organizaciones aprobadas y fechas no vencidas. Filtros por tipo, carrera, departamento, modalidad, ciudad, búsqueda, orden y paginación. Al entrar como estudiante mostrar primero oportunidades para su carrera e incluir filtro 'Ver todas'; los publicadores y administradores también navegan catálogo. Interfaz responsive en español, con contacto externo claro y SIN solicitud interna. Incluye pruebas de exclusión para ofertas vencidas/cerradas y revisiones pendientes. Ejecuta tests/build y detente.
```

## Fase 5: pulido y demo

```text
Implementa Fase 5: indicadores de panel admin, mejora accesibilidad y responsive, valida formularios y errores, limpia código, audita endpoints y secrets, completa README y script de datos demo. Añade Playwright (si las dependencias y el entorno lo permiten) y guion de demostración. Comprueba los 12 criterios de aceptación de 01_ESPECIFICACION_CODEX.md. No declares éxito si no ejecutaste una prueba. No implementes extras antes de que el flujo principal esté probado.
```

## Prompt de revisión final

```text
Audita este repositorio contra 01_ESPECIFICACION_CODEX.md. Produce una matriz de los 12 criterios de aceptación con estado comprobado / incompleto / bloqueado. Cita archivos y tests específicos que sustentan cada estado. Busca filtración de credenciales, bypass de permisos por manipulación de payload, consultas que muestren revisiones pendientes a estudiantes, condiciones de carrera inválidas y diferencias entre UI y API. Corrige primero fallos críticos y ejecuta nuevamente pruebas/build. Documenta pasos precisos para presentar el prototipo.
```

## Mini-guion de demo ante profesor

1. Entrar como organización cuya cuenta está pendiente: no tiene permiso para publicar.
2. Entrar como administrador: aprobarla y activar solo «Servicio social».
3. Volver al publicador: crear servicio social, guardarlo, enviarlo. Mostrar que no puede enviar prácticas.
4. Entrar como administrador: revisar y rechazar con comentario.
5. Volver como publicador: corregir, reenviar.
6. Admin aprueba; entrar como estudiante de carrera relevante y encontrar la nueva oferta.
7. Editar la oferta desde el publicador: en catálogo sigue visible el texto anterior hasta que la revisión sea aprobada.
8. Admin aprueba la nueva revisión: el catálogo muestra contenido actualizado.
9. Mostrar filtros, contacto externo y cierre/vencimiento, sin postulaciones internas.
