# Verificaciones de Fase 0

Entorno: Windows, Node 25.0.0, npm 11.6.2. Sin credenciales ni servicios remotos configurados.

| Comando ejecutado                                                                                       | Resultado final                                                  |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `npm.cmd install`                                                                                       | Instalacion completa; generado package-lock.json                 |
| `npm.cmd install -D vitest@^4.1.12 --workspace @unioportunidades/api --workspace @unioportunidades/web` | Version corregida instalada; auditoria: 0 vulnerabilidades       |
| `npm.cmd run format`                                                                                    | Formato aplicado                                                 |
| `npm.cmd run build`                                                                                     | API y web compiladas correctamente                               |
| `npm.cmd test`                                                                                          | 10 pruebas correctas: 5 API y 5 web                              |
| `npm.cmd run lint`                                                                                      | Sin errores                                                      |
| `npm.cmd run format:check`                                                                              | Sin diferencias                                                  |
| `npm.cmd run dev`                                                                                       | Vite en 5173 y Express en 3001 iniciados                         |
| `Invoke-RestMethod http://127.0.0.1:3001/api/v1/health`                                                 | Respuesta real de API: ok, DB sin conectar, Auth sin implementar |
| `Invoke-RestMethod http://127.0.0.1:5173/api/v1/health`                                                 | Proxy de Vite a API correcto                                     |
| `(Invoke-WebRequest http://127.0.0.1:5173 -UseBasicParsing).StatusCode`                                 | HTTP 200                                                         |

Las pruebas cubren healthcheck, 404, JSON mal formado, CORS, entorno, denegacion por estado/rol y contrato/fallos del cliente API. No se ejecuto una prueba visual de navegador ni un flujo autenticado: la autenticacion todavia no existe.

Incidencias resueltas: PowerShell bloqueaba npm.ps1 (se uso npm.cmd); el sandbox impedia lecturas de esbuild y cache de npm (instalacion/build/tests ejecutados con permiso fuera del sandbox); corregidos errores de lint y formato. La primera auditoria encontro tres alertas de Vitest/dependencias; la actualizacion a 4.1.12 las elimino.

El build conserva dos advertencias de anotaciones PURE en comentarios de Zod, eliminados por Rollup durante empaquetado; no impiden compilar. No se modificaron dependencias instaladas para silenciar advertencias.

No se ejecutaron migraciones, semillas ni conexiones a Supabase. Las variables de servicios siguen vacias en los ejemplos; no hacen falta para Fase 0. Pendiente Fase 1: migracion, Auth real, autorizacion backend y seed de cuentas ficticias.
