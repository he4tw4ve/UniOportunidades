-- UniOportunidades | PostgreSQL (Supabase) | Migración inicial de referencia
-- Ejecutar únicamente en un proyecto Supabase de desarrollo o prueba.
-- La autenticación vive en auth.users (gestionada por Supabase), no aquí.
-- Negocio: solo API Express con conexión privilegiada; no accesos directos
-- del frontend a estas tablas mientras no se diseñen políticas RLS.

BEGIN;

CREATE TABLE IF NOT EXISTS public.departamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.carreras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  departamento_id uuid NOT NULL REFERENCES public.departamentos(id),
  nombre text NOT NULL,
  activa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (departamento_id, nombre)
);

CREATE TABLE IF NOT EXISTS public.perfiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  nombre_completo text NOT NULL,
  email text NOT NULL,
  rol text NOT NULL CHECK (rol IN ('student', 'publisher', 'admin')),
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS perfiles_email_ci_uniq
  ON public.perfiles (lower(email));

CREATE TABLE IF NOT EXISTS public.estudiantes (
  usuario_id uuid PRIMARY KEY REFERENCES public.perfiles(id) ON DELETE RESTRICT,
  expediente text NOT NULL UNIQUE,
  carrera_id uuid NOT NULL REFERENCES public.carreras(id),
  proveedor_identidad text NOT NULL DEFAULT 'demo',
  sujeto_externo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(trim(expediente)) BETWEEN 3 AND 30)
);
CREATE UNIQUE INDEX IF NOT EXISTS estudiantes_identidad_externa_uniq
  ON public.estudiantes (proveedor_identidad, sujeto_externo)
  WHERE sujeto_externo IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.organizaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('company','university','government','nonprofit','other')),
  descripcion text,
  email_contacto text NOT NULL,
  telefono text,
  sitio_web text,
  estado text NOT NULL DEFAULT 'pending'
    CHECK (estado IN ('pending','approved','rejected','suspended')),
  revisada_por uuid REFERENCES public.perfiles(id),
  revisada_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.miembros_organizacion (
  usuario_id uuid PRIMARY KEY REFERENCES public.perfiles(id) ON DELETE RESTRICT,
  organizacion_id uuid NOT NULL REFERENCES public.organizaciones(id) ON DELETE RESTRICT,
  rol_interno text NOT NULL DEFAULT 'representative'
    CHECK (rol_interno IN ('representative')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_miembros_org ON public.miembros_organizacion(organizacion_id);

-- Presencia de fila = permiso de publicar el tipo indicado.
CREATE TABLE IF NOT EXISTS public.permisos_organizacion (
  organizacion_id uuid NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
  tipo_oferta text NOT NULL CHECK (tipo_oferta IN ('social_service','internship')),
  concedido_por uuid NOT NULL REFERENCES public.perfiles(id),
  concedido_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organizacion_id, tipo_oferta)
);

CREATE TABLE IF NOT EXISTS public.revisiones_organizacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES public.organizaciones(id) ON DELETE RESTRICT,
  administrador_id uuid NOT NULL REFERENCES public.perfiles(id),
  decision text NOT NULL CHECK (decision IN ('approved','rejected','suspended')),
  comentario text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (decision = 'approved' OR nullif(trim(coalesce(comentario,'')),'') IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_revisiones_organizacion_org
  ON public.revisiones_organizacion(organizacion_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.ofertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES public.organizaciones(id) ON DELETE RESTRICT,
  creado_por uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE RESTRICT,
  tipo text NOT NULL CHECK (tipo IN ('social_service','internship')),
  estado_operativo text NOT NULL DEFAULT 'closed'
    CHECK (estado_operativo IN ('open','closed','archived')),
  revision_publicada_id uuid,  -- FK compuesta creada después de revisiones_oferta
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ofertas_org ON public.ofertas(organizacion_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ofertas_tipo_estado ON public.ofertas(tipo,estado_operativo);

CREATE TABLE IF NOT EXISTS public.revisiones_oferta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oferta_id uuid NOT NULL REFERENCES public.ofertas(id) ON DELETE RESTRICT,
  numero_version integer NOT NULL CHECK (numero_version > 0),
  estado_revision text NOT NULL DEFAULT 'draft'
    CHECK (estado_revision IN ('draft','pending','approved','rejected')),
  titulo text NOT NULL,
  descripcion text NOT NULL,
  actividades text NOT NULL,
  requisitos text NOT NULL,
  beneficios text,
  modalidad text NOT NULL CHECK (modalidad IN ('in_person','hybrid','remote')),
  ciudad text,
  estado_region text,
  cupos integer NOT NULL DEFAULT 1 CHECK (cupos >= 1),
  fecha_limite date NOT NULL,
  duracion_info text,
  alcance_carreras text NOT NULL DEFAULT 'selected'
    CHECK (alcance_carreras IN ('all','selected')),
  contacto_nombre text NOT NULL,
  contacto_email text,
  contacto_url text,
  contacto_instrucciones text,
  created_by uuid NOT NULL REFERENCES public.perfiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  decided_at timestamptz,
  UNIQUE (oferta_id, numero_version),
  UNIQUE (oferta_id, id),
  CHECK (nullif(trim(titulo),'') IS NOT NULL),
  CHECK (nullif(trim(descripcion),'') IS NOT NULL),
  CHECK (nullif(trim(contacto_email),'') IS NOT NULL
      OR nullif(trim(contacto_url),'') IS NOT NULL)
);
-- A lo sumo una versión en edición o revisión por oferta. Esto evita
-- conflictos y hace clara la interfaz de cambios pendientes.
CREATE UNIQUE INDEX IF NOT EXISTS idx_revision_abierta_unica
  ON public.revisiones_oferta(oferta_id)
  WHERE estado_revision IN ('draft','pending');
CREATE INDEX IF NOT EXISTS idx_revisiones_pendientes
  ON public.revisiones_oferta(created_at DESC)
  WHERE estado_revision = 'pending';
CREATE INDEX IF NOT EXISTS idx_revisiones_busqueda
  ON public.revisiones_oferta USING gin
  (to_tsvector('spanish', coalesce(titulo,'') || ' ' || coalesce(descripcion,'')));

-- Garantiza que la revisión publicada pertenezca a esta misma oferta.
ALTER TABLE public.ofertas
  ADD CONSTRAINT ofertas_revision_publicada_fk
  FOREIGN KEY (id, revision_publicada_id)
  REFERENCES public.revisiones_oferta(oferta_id, id)
  DEFERRABLE INITIALLY IMMEDIATE;

CREATE TABLE IF NOT EXISTS public.revision_carreras (
  revision_id uuid NOT NULL REFERENCES public.revisiones_oferta(id) ON DELETE RESTRICT,
  carrera_id uuid NOT NULL REFERENCES public.carreras(id) ON DELETE RESTRICT,
  PRIMARY KEY (revision_id, carrera_id)
);
CREATE INDEX IF NOT EXISTS idx_revision_carreras_carrera
  ON public.revision_carreras(carrera_id);

CREATE TABLE IF NOT EXISTS public.revisiones_administrativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id uuid NOT NULL UNIQUE REFERENCES public.revisiones_oferta(id) ON DELETE RESTRICT,
  administrador_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE RESTRICT,
  decision text NOT NULL CHECK (decision IN ('approved','rejected')),
  comentario text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (decision = 'approved' OR nullif(trim(coalesce(comentario,'')),'') IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.eventos_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.perfiles(id) ON DELETE RESTRICT,
  tipo_entidad text NOT NULL,
  entidad_id uuid NOT NULL,
  accion text NOT NULL,
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidad
  ON public.eventos_auditoria(tipo_entidad,entidad_id,created_at DESC);

-- updated_at automático (solo las entidades editables)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER perfiles_updated_at BEFORE UPDATE ON public.perfiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER organizaciones_updated_at BEFORE UPDATE ON public.organizaciones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER ofertas_updated_at BEFORE UPDATE ON public.ofertas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Defensa en profundidad: el MVP NO expone operaciones de negocio directamente
-- con supabase-js desde el navegador. DB se usa desde Express exclusivamente.
ALTER TABLE public.departamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carreras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estudiantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.miembros_organizacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permisos_organizacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revisiones_organizacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ofertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revisiones_oferta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revision_carreras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revisiones_administrativas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos_auditoria ENABLE ROW LEVEL SECURITY;

-- No hay políticas de cliente anon/authenticated. Refuerzo de privilegios;
-- la conexión privilegiada del servidor no debe compartirse con el navegador.
REVOKE ALL ON TABLE
  public.departamentos, public.carreras, public.perfiles, public.estudiantes,
  public.organizaciones, public.miembros_organizacion,
  public.permisos_organizacion, public.revisiones_organizacion,
  public.ofertas, public.revisiones_oferta, public.revision_carreras,
  public.revisiones_administrativas, public.eventos_auditoria
FROM anon, authenticated;

COMMIT;

-- REGLAS QUE EL API DEBE GARANTIZAR EN TRANSACCIONES:
-- 1. perfiles.rol coincide con la tabla auxiliar cuando corresponda.
-- 2. Admin verificado aprueba organ./revisión; actor autenticado en backend.
-- 3. Solo propietario/administrador edita y solo sobre estado 'draft'.
-- 4. 'selected' requiere >= 1 revision_carreras; 'all' no necesita filas.
-- 5. revision_publicada_id solo apunta a revisión 'approved'.
-- 6. Enviar solo con organización approved y permiso explícito de tipo.
-- 7. Revisiones aprobadas/rechazadas no mutables por clientes normales.
-- 8. Reapertura solo con fecha_limite vigente en America/Hermosillo.
-- 9. Decisiones con SELECT ... FOR UPDATE y transacción atómica.
