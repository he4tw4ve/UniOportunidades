# Migraciones

`001_init.sql` conserva íntegro el esquema de referencia. Ejecuta `npm.cmd run db:migrate`; no repitas manualmente el SQL después de aplicarlo. El runner guarda versión/checksum en el esquema privado técnico y hace rollback ante fallos. No modifiques archivos ya aplicados.
