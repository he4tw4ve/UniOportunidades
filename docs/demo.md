# Guion de demostración · Fase 6

## Preparación

Sigue `supabase-setup.md`. Usa un proyecto de desarrollo, nunca contraseñas universitarias. Conserva SSL con verificación completa. Desde la raíz:

```powershell
npm.cmd ci
npm.cmd run db:diagnose
# Solo si la migración inicial aún falta:
npm.cmd run db:migrate
# Solo cuando quieras crear datos de demostración:
npm.cmd run seed:demo
npm.cmd run dev
```

El seed exige `DEMO_SEED_ENABLED=true`, clave administrativa server-only y las tres contraseñas demo en `apps/api/.env`. Crea o conserva 7 cuentas, 3 organizaciones, 8 ofertas y 10 versiones, incluida una pendiente y una rechazada. En una base nueva añade escenarios de carreras y un vencimiento en 5 días. Repetirlo no reinicia permisos, estados, contraseñas, contenido ni fechas. Si tus datos existentes son distintos, no los restaura: utiliza otra base de desarrollo para una demo desde cero. No borres tablas ni ejecutes SQL manual para reiniciar.

| Acceso                        | Cuenta                                   | Contraseña                                       |
| ----------------------------- | ---------------------------------------- | ------------------------------------------------ |
| Estudiante                    | `DEMO-001`, `DEMO-002`, `DEMO-003`       | La elegida en `DEMO_STUDENT_PASSWORD` al crearla |
| Admin                         | `admin@demo.unioportunidades.test`       | `DEMO_ADMIN_PASSWORD` original                   |
| Publicador de prácticas       | `publicador1@demo.unioportunidades.test` | `DEMO_PUBLISHER_PASSWORD` original               |
| Publicador pendiente          | `publicador2@demo.unioportunidades.test` | La misma variable original                       |
| Publicador de servicio social | `publicador3@demo.unioportunidades.test` | La misma variable original                       |

Las cuentas seed ya están confirmadas. El registro autoservicio con un correo propio sigue requiriendo confirmación; compruébalo con SMTP configurado. No desactives esa confirmación.

## Recorrido manual (15 minutos)

1. Entra con DEMO-001: comprueba carrera, «Ver todas», búsqueda, combinación de filtros y detalle. Comprueba contacto externo y ausencia de solicitud interna. Recarga la página: conserva sesión. Usa teclado y prueba 360 px.
2. Entra con publicador2: organización pendiente sin permisos, publicación bloqueada. Navega al catálogo y vuelve al panel.
3. En otra sesión de navegador, entra como admin: revisa indicadores y lista de usuarios. Aprueba la organización pendiente concediendo únicamente Servicio social. Esta acción modifica datos demo; no la hagas en un proyecto que debas conservar intacto.
4. Como publicador autorizado, crea una oportunidad de Servicio social marcada FICTICIA con fecha futura, completa el formulario y envía. Prácticas debe estar bloqueado si no tiene ese permiso.
5. Admin abre Revisiones, rechaza con motivo. El publicador ve el motivo, crea nueva versión y reenvía. Admin aprueba; estudiante la encuentra en catálogo.
6. Publicador crea una edición, cambia el título y envía. Estudiante sigue viendo el anterior. Admin aprueba; ahora se ve el nuevo, conservando historial.
7. Cierra la oferta creada para la demo; desaparece del catálogo y permanece en el historial. La exclusión por fecha vencida se prueba automáticamente sin cambiar el reloj ni alterar datos remotos.
8. Publicador1 no debe acceder a ofertas de otra organización. Estudiante/publicador no acceden a Admin ni conceden permisos. Revisa auditoría y fechas de los cambios anteriores.
9. Abre Mi cuenta en el encabezado y cierra sesión; vuelve a una ruta protegida: solicita acceso. Comprueba también restauración de sesión tras recarga y navegación atrás. `/mi-perfil` conserva compatibilidad abriendo la cuenta compacta. Para cambios de estado/decisiones, usa el diálogo de confirmación: no hay casilla previa.

## Demo automatizada aislada

```powershell
npm.cmd exec -- playwright install chromium
npm.cmd run test:e2e
```

Playwright inicia web en 3100 y API en 3101, con PostgreSQL embebido efímero y un adaptador Auth exclusivamente de pruebas. No carga `.env` del servidor ni contacta Supabase. Usa el código de UI, rutas, repositorios y seed reales. No sustituye la verificación del proveedor Auth, SMTP o conectividad de tu proyecto. Credenciales y tokens de prueba carecen de acceso a producción. Los puertos deben estar libres. Guarda capturas de UI con datos ficticios aislados para revisión visual bajo `test-results/`; no guarda contraseñas, tokens, vídeos ni trazas.
