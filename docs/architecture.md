# Arquitectura · Fase 0

Npm workspaces separa web y API. La web usa React Router y TanStack Query; la API Express concentra los futuros accesos de negocio a PostgreSQL. En esta fase solo hay un endpoint real de infraestructura. No se instala ni inicializa Supabase/pg todavía; corresponde a Fase 1.

Los módulos `auth`, `organizations`, `offers`, `reviews`, `catalog` y `admin` tienen límites reservados. Las features de web mantienen páginas y guards separados de componentes compartidos. Los componentes shadcn/ui son código local, con aliases definidos en `components.json`; Button usa Radix Slot, CVA y utilidades Tailwind.

`AuthProvider` declara explícitamente estado `unavailable`. El guard admite roles tipados pero no hay mecanismo público para asignar una sesión o simular roles. La protección del navegador no sustituye autorización backend: en Fase 1 cada endpoint privado validará token y consultará rol/permisos en DB. Actualmente no existen endpoints privados ni datos que exponer.

No se modifica ni ejecuta el SQL de referencia en Fase 0. Las revisiones, transacciones, permisos organizacionales y políticas RLS se implementarán respetando la especificación en fases posteriores.
