# Scripts de servidor

`migrate.ts` y `seed-demo.ts` delegan en el workspace de API. Ejecuta `npm.cmd run db:migrate` y `npm.cmd run seed:demo` desde la raíz. Configuración: `apps/api/.env`; instrucciones en `docs/supabase-setup.md`. No importar estas entradas desde la web.

`audit-security.mjs` se ejecuta con `npm.cmd run audit:security` después de build. Inspecciona fuentes/bundle y secretos locales sin imprimir valores. No hace llamadas de red ni escrituras en DB. Guion de cuentas y escenarios: `docs/demo.md`. Playwright se ejecuta con `npm.cmd run test:e2e` y no utiliza la base remota.
