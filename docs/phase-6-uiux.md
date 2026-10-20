# Fase 6 · UI/UX y verificación

## Cambios por etapa

**A · Arquitectura de interfaz.** Un layout autenticado compartido integra catálogo y áreas de trabajo. Sidebar fijo en el viewport de escritorio, grupos por rol, sección activa única, modo contraído y drawer nativo para móvil/tablet. El encabezado identifica el contexto y permite abrir Mi cuenta. La navegación usa el perfil validado; Crear oportunidad depende además de la organización/permisos consultados por API. Los guards de rutas y de servidor siguen siendo obligatorios. `/mi-perfil` redirige al inicio de cada rol y abre la cuenta compacta, conservando enlaces anteriores.

**B · Experiencia pública.** Landing con propósito, explicación de tipos, recorrido de estudiantes, organizaciones y revisión. Acceso y registro se integran en un panel con URLs `/iniciar-sesion` y `/registro-organizacion`, y ancla `#acceso`. Reutiliza los formularios originales, validaciones, registro, confirmación de correo y restauración de sesión. Quien entra autenticado dispone de acceso directo a su área. No se consulta catálogo público, se inventan estadísticas ni se ofrece registro estudiantil. Se retiró de la portada el panel técnico de estado del servidor; su endpoint sigue disponible.

**C · Dashboards y confirmaciones.** Administración conserva métricas y muestra hasta cinco organizaciones y cinco versiones pendientes, con enlaces reales, carga/error/vacío y reintentos independientes. Reutiliza las consultas existentes, paginadas y limitadas a 20 resultados, sin consultas por cada fila. No se añadió un feed global de auditoría: el contrato actual expone historial por entidad; se enlaza al detalle correspondiente y se evita ampliar backend/índices para este cambio visual. Publicador distingue estado/permisos, últimas oportunidades y versiones; Crear está disponible cuando corresponde. Un permiso único se selecciona automáticamente en el formulario, sin ofrecer tipos no autorizados.

Los cambios de estado, dictámenes, permisos, revisión de organizaciones y corrección auditada usan diálogos. Cancelar no escribe. Escape funciona salvo durante una operación. Hay foco inicial seguro, retorno al control de origen (o contenido si ya no existe/está deshabilitado), errores dentro del diálogo, estado ocupado y bloqueo de envíos duplicados. Motivos, versiones opacas y contratos API se conservan.

**D · Sistema visual.** Tokens en `styles/design-system.css`: azul, amarillo y azul oscuro de referencia; neutros adaptados, superficies, texto, bordes, estados semánticos, radios, espaciado y sombras. Botones, campos, badges, avisos y diálogos comparten estilos. El catálogo conserva búsqueda, filtros, tarjetas y personalización: recibe el nuevo shell, ajustes de foco, CTA y cuenta. Sin nuevas bibliotecas, fuentes descargadas ni imágenes de terceros.

**E · Refinamiento.** Pruebas de regresión, teclado, diálogos, roles, contraste y responsive. Revisión visual de capturas reales de Chromium con datos aislados: landing de escritorio, registro móvil, admin de escritorio/móvil, publicador de tablet, catálogo y confirmación. Se eliminaron tres componentes PendingPage sin rutas ni referencias. La auditoría local ahora admite archivos eliminados del árbol de trabajo sin fallar por ENOENT.

## Referencia de identidad

Se consultaron el [portal Identidad Búho](https://identidadbuho.unison.mx/) y el [Manual de Identidad Institucional](https://identidadbuho.unison.mx/wp-content/uploads/2025/08/MANUAL-DE-IDENTIDAD_25-30_INICIAL-1.pdf). El manual indica azul `#24398A` y amarillo `#E1B73D` en la página impresa 8 (índice PDF 7), y azul complementario `#20305A` en la 9 (índice 8). Calibri figura para medios electrónicos en la página 26; se usa con fallbacks de sistema. Las variantes de fondos, colores semánticos y demás decisiones son adaptaciones propias del producto, no códigos oficiales adicionales. No se usa escudo ni se presenta como servicio autorizado. El render remoto de algunas páginas del PDF tuvo fallos intermitentes; los valores de color sí se obtuvieron de su texto.

## Archivos principales

| Área                | Archivos                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Navegación y cuenta | `components/layout/Layouts.tsx`, `navigation.ts`, `AccountMenu.tsx`, `features/perfil/ProfilePage.tsx`, `app/router.tsx`                    |
| Público             | `features/catalogo/HomePage.tsx`, `features/auth/AccessPage.tsx`, `RegistrationPage.tsx`                                                    |
| Paneles             | `features/admin/AdminDashboard.tsx`, `ReviewInbox.tsx`, `features/publicador/OrganizationDashboard.tsx`, `PublisherOverview.tsx`            |
| Confirmaciones      | `components/ui/Dialog.tsx`, `features/ofertas/OfferDetailPage.tsx`, `RevisionForm.tsx`, `features/admin/OrganizationDetailPage.tsx`         |
| Estilos y controles | `styles/design-system.css`, `globals.css`, `components/ui/button.tsx`, `field.ts`, `components/organizations/OrganizationInfo.tsx`          |
| Verificación        | Tests de layouts, navegación, inbox, ofertas, organizaciones y contraste; `e2e/demo.spec.ts`, `e2e/server.ts`, `scripts/audit-security.mjs` |

No se modificaron endpoints de producción, esquema, seed ni variables de entorno. No se ejecutaron migraciones, provisión ni escrituras contra Supabase remoto. El healthcheck de backend conserva su versión de Fase 5. El servidor E2E incorpora únicamente una respuesta local de signup sin sesión para probar el aviso de confirmación; no sustituye SMTP ni se distribuye en el build productivo.

## Verificación ejecutada

```powershell
npm.cmd test
npm.cmd run test:e2e
npm.cmd run build
npm.cmd run lint
npm.cmd run format
npm.cmd run format:check
npm.cmd run audit:security
```

| Verificación final           | Resultado ejecutado                                                  |
| ---------------------------- | -------------------------------------------------------------------- |
| `npm.cmd test`               | 159 pruebas satisfactorias: 104 API + 55 web                         |
| `npm.cmd run test:e2e`       | 8 pruebas satisfactorias en Chromium                                 |
| `npm.cmd run build`          | API y web compiladas; JS 850.04 kB / 249.72 kB gzip, CSS 34.56 kB    |
| `npm.cmd run lint`           | Sin errores                                                          |
| `npm.cmd run format:check`   | Formato correcto                                                     |
| `npm.cmd run audit:security` | Sin hallazgos de secretos ni consultas directas en la revisión local |

Las pruebas de API usan PostgreSQL embebido con el esquema original. Chromium usa UI, rutas y repositorios reales con Auth de prueba y base efímera, no Supabase remoto. La suite mantiene el flujo crear → enviar → rechazar → reenviar → aprobar → editar → pendiente visible anterior → aprobar → cerrar. Se comprobaron los viewports 360, 768, 1280 y 1440 px; los controles de filtros y las tablas mantienen su funcionalidad.

El test de contraste evalúa nueve pares principales de tokens con mínimo 4.5:1. No equivale a certificación WCAG 2.2 AA ni cubre todos los estados, todos los navegadores o lectores de pantalla. Las capturas bajo `test-results/` son efímeras y contienen únicamente datos ficticios aislados. No contienen contraseñas ni tokens; no se guardan trazas ni vídeos.

## Criterios de aceptación de Fase 6

| N.º | Evidencia y resultado esperado                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Layout React y Chromium: admin accede al panel desde catálogo en una interacción; navegación hacia herramientas existentes.                                         |
| 2   | Chromium: panel de organización, listado y creación accesibles directamente.                                                                                        |
| 3   | Navegación estudiantil centrada en explorar, conservando filtros y carrera.                                                                                         |
| 4   | Menú de cuenta con datos reales y cierre de sesión; URL anterior compatible, sin página informativa intermedia.                                                     |
| 5   | Landing explica propósito, tipos, acceso, organizaciones, revisión y carácter académico.                                                                            |
| 6   | Login/registro integrados y rutas directas; pruebas de campos, credenciales y aviso de confirmación.                                                                |
| 7   | Inbox real por API, métricas conservadas y enlaces al detalle; pruebas de listas, errores, recuperación y vacíos.                                                   |
| 8   | Estado/permisos visibles, últimas oportunidades y selección de tipos autorizados; bloqueo de organización pendiente probado en ruta directa.                        |
| 9   | Diálogos con cancelar/confirmar, foco, error/reintento y bloqueo de duplicados probados.                                                                            |
| 10  | Pruebas anteriores de catálogo y detalle conservadas; navegador comprueba filtros, contacto y móvil.                                                                |
| 11  | Referencia oficial consultada, tokens y semántica compartidos, marca propia y aviso académico.                                                                      |
| 12  | Chromium comprueba móvil/tablet/escritorio, drawer, tablas y ausencia de desbordamiento en escenarios cubiertos.                                                    |
| 13  | Suite de API intacta: roles, permisos, propietario, transacciones, concurrencia y versión publicada.                                                                |
| 14  | Comandos de prueba/build/lint/formato/auditoría ejecutados; advertencias y límites se registran.                                                                    |
| 15  | Rutas principales, enlaces de dashboard y cuenta antigua probados; se retiraron placeholders sin uso. No se afirma un rastreo exhaustivo de todas las URL posibles. |

## Verificación manual con Supabase

1. Ejecuta `npm.cmd run dev`. Abre `/`, `/iniciar-sesion` y `/registro-organizacion`. Confirma claridad del contenido, tabs del panel y acceso por teclado. Prueba el registro con correo propio y SMTP: el aviso de pruebas no acredita recepción real de email.
2. Entra con `DEMO-001` y tu contraseña demo original. Explora carrera/Ver todas, filtra, abre contacto y vuelve conservando búsqueda. Abre Mi cuenta, comprueba expediente/carrera, cierra con Escape y recarga la sesión.
3. Entra con `publicador2@demo.unioportunidades.test`: si conserva estado pending, no debe ofrecer Crear ni permitir el formulario desde una URL directa. Con publicador1 o 3 aprobado y autorizado, revisa oportunidades y acceso a Crear. Los permisos actuales de tu DB prevalecen sobre el estado inicial del seed.
4. Entra con `admin@demo.unioportunidades.test`: abre organizaciones/versiones pendientes desde el panel; visita Usuarios y catálogo desde sidebar, contráelo y verifica sección activa. Los conteos pueden diferir del seed según tus datos reales.
5. En una oportunidad de demostración, abre Cerrar o Archivar y cancela: no debe cambiar. Para probar confirmación real, usa solo una oferta que puedas modificar; verifica historial después. No archives una oferta que necesites reabrir. Repite motivos y permisos en los diálogos correspondientes.
6. Comprueba 360 px, tablet y escritorio, drawer por teclado, Escape, retorno del foco y cierre de sesión desde Mi cuenta. El enlace antiguo `/mi-perfil` debe abrir esa información en el nuevo layout.

Pendientes de verificación externa: Auth/SMTP reales, recorrido remoto completo, Safari/Firefox y lector de pantalla. Se conservan las advertencias de Vite sobre anotaciones de Zod y tamaño del bundle. No se añadió el feed global de auditoría, no se desplegó y no se pretende resolver desde UI la conectividad intermitente a Supabase.
