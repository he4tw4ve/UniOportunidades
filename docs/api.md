# API · Fase 0

Base local: `http://127.0.0.1:3001/api/v1`.

`GET /health` responde 200 con:

```json
{
  "data": {
    "status": "ok",
    "service": "unioportunidades-api",
    "phase": 0,
    "authentication": "not_implemented",
    "database": "not_connected"
  },
  "error": null,
  "meta": null
}
```

Este endpoint no certifica disponibilidad de PostgreSQL ni Supabase. No requiere credenciales. Cualquier otra ruta responde 404 con `data: null`, `meta: null` y `error: {code: "NOT_FOUND", message: "La ruta solicitada no existe."}`.

JSON mal formado responde 400 `INVALID_JSON`; errores inesperados responden 500 `INTERNAL_ERROR`, sin stacks ni secretos. CORS permite únicamente `WEB_ORIGIN`; no es un mecanismo de autenticación. El cliente valida el contrato del healthcheck con Zod y presenta fallos de conexión/formato en español.

Los contratos de negocio de la especificación quedan pendientes; no se exponen rutas que devuelvan éxitos ficticios.
