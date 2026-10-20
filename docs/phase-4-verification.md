# Fase 4: catálogo y verificación

Implementación completada sin modificar el modelo, añadir migraciones ni cambiar confirmaciones o paneles administrativos. No se ejecutaron migraciones, seeds ni escrituras contra Supabase remoto. Fase 5 queda pendiente de una nueva solicitud.

## Archivos principales

- API: `apps/api/src/db/catalogRepository.ts`, `modules/catalog/router.ts`, `validation.ts`, `catalog.test.ts`, integración en `modules/auth/router.ts` y `server.ts`.
- Web: `features/catalogo/CatalogPage.tsx`, `CatalogFilters.tsx`, `OpportunityCard.tsx`, `Catalog.test.tsx`, `lib/catalog.ts` y detalle en `features/ofertas/PublishedOfferPage.tsx`.
- Contratos y composición: router web, esquema de detalle, healthcheck de Fase 4, estilos del diálogo móvil y portada.
- Diagnóstico de lectura: `apps/api/src/cli/check-catalog.ts`. Documentación: README, API y arquitectura.

## Comandos ejecutados

```powershell
npm.cmd run test -w @unioportunidades/api -- src/modules/catalog/catalog.test.ts
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd run format
npm.cmd run format:check
npm.cmd exec -w @unioportunidades/api -- tsx src/cli/check-catalog.ts
```

Tests: 140 satisfactorios (99 API y 41 web); incluyen 14 nuevos de catálogo PostgreSQL y 12 de UI. Cubren cerradas, archivadas, vencidas, organización no aprobada, revisión no publicada/pendiente/rechazada, protección de título/contacto/filtros publicados, vigencia inclusive hoy, personalización, combinaciones, orden/paginación, token obligatorio y acceso de los tres roles. UI: filtros, diálogo móvil, búsqueda, chips, paginación, carga/error/vacío, detalle y contacto externo.

La comprobación de repositorios contra PostgreSQL configurado devolvió: conexión/consultas correctas, 9 ofertas visibles, 3 carreras activas, 3 departamentos, 1 ciudad y detalle publicado comprobado. Solo imprime conteos; no secretos ni contenido. No usa mocks de frontend. No se necesitaron nuevas variables.

Build compila API y web. Vite advierte sobre anotaciones PURE de Zod y tamaño del bundle; no impiden generar artefactos. El sandbox bloqueó una ejecución de esbuild por acceso a directorios; se repitió con permisos de ejecución apropiados. La verificación UI automatizada usa jsdom: no se realizó inspección visual en navegador real.

## Comprobación manual

Inicia `npm.cmd run dev`, entra con estudiante demo y visita `/ofertas`. Comprueba su carrera inicial, «Ver todas», filtros combinables, orden, navegación de páginas y regreso desde detalle. En móvil abre Filtros y comprueba el cierre por Escape. Prueba también con publicador/admin. Cerrar, suspender o vencer una oferta debe excluirla en la próxima consulta; una revisión pendiente conserva el contenido aprobado. Los enlaces de correo y sitio externo son los únicos medios de contacto; no hay solicitud interna.
