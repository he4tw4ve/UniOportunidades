import type { Queryable } from "./pool.js";
import type { Role } from "../shared/types.js";
export const demoAccounts: {
  email: string;
  name: string;
  role: Role;
  expediente?: string;
}[] = [
  {
    email: "admin@demo.unioportunidades.test",
    name: "Administración FICTICIA",
    role: "admin",
  },
  {
    email: "alumno001@demo.unioportunidades.test",
    name: "Estudiante FICTICIO Uno",
    role: "student",
    expediente: "DEMO-001",
  },
  {
    email: "alumno002@demo.unioportunidades.test",
    name: "Estudiante FICTICIO Dos",
    role: "student",
    expediente: "DEMO-002",
  },
  {
    email: "alumno003@demo.unioportunidades.test",
    name: "Estudiante FICTICIO Tres",
    role: "student",
    expediente: "DEMO-003",
  },
  {
    email: "publicador1@demo.unioportunidades.test",
    name: "Publicador FICTICIO Uno",
    role: "publisher",
  },
  {
    email: "publicador2@demo.unioportunidades.test",
    name: "Publicador FICTICIO Dos",
    role: "publisher",
  },
  {
    email: "publicador3@demo.unioportunidades.test",
    name: "Publicador FICTICIO Tres",
    role: "publisher",
  },
];
export const seedId = (n: number) =>
  `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export async function seedDatabase(db: Queryable, users: Map<string, string>) {
  const admin = users.get(demoAccounts[0].email)!;
  for (let i = 0; i < 3; i++) {
    await db.query(
      "INSERT INTO public.departamentos(id,nombre) VALUES($1,$2) ON CONFLICT(id) DO NOTHING",
      [seedId(1 + i), `Departamento FICTICIO ${i + 1}`],
    );
    await db.query(
      "INSERT INTO public.carreras(id,departamento_id,nombre) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING",
      [
        seedId(11 + i),
        seedId(1 + i),
        ["Computación FICTICIA", "Artes FICTICIAS", "Administración FICTICIA"][
          i
        ],
      ],
    );
  }
  for (const account of demoAccounts) {
    const id = users.get(account.email);
    if (!id) throw new Error("Falta identidad ficticia.");
    await db.query(
      "INSERT INTO public.perfiles(id,nombre_completo,email,rol) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING",
      [id, account.name, account.email, account.role],
    );
    const existing = await db.query<{ rol: Role; email: string }>(
      "SELECT rol,email FROM public.perfiles WHERE id=$1",
      [id],
    );
    if (
      existing.rows[0].rol !== account.role ||
      existing.rows[0].email !== account.email
    )
      throw new Error(
        "El perfil existente no coincide con el seed; no se alteraron roles.",
      );
    if (account.expediente)
      await db.query(
        "INSERT INTO public.estudiantes(usuario_id,expediente,carrera_id) VALUES($1,$2,$3) ON CONFLICT(usuario_id) DO NOTHING",
        [
          id,
          account.expediente,
          seedId(10 + Number(account.expediente.slice(-1))),
        ],
      );
  }
  for (let i = 0; i < 3; i++) {
    const publisher = users.get(demoAccounts[4 + i].email)!;
    const state = i === 1 ? "pending" : "approved";
    await db.query(
      `INSERT INTO public.organizaciones(id,nombre,tipo,email_contacto,estado,revisada_por,revisada_at) VALUES($1,$2,'nonprofit',$3,$4,$5,CASE WHEN $4='approved' THEN now() ELSE NULL END) ON CONFLICT(id) DO NOTHING`,
      [
        seedId(21 + i),
        `Organización FICTICIA ${i + 1}`,
        demoAccounts[4 + i].email,
        state,
        i === 1 ? null : admin,
      ],
    );
    await db.query(
      "INSERT INTO public.miembros_organizacion(usuario_id,organizacion_id) VALUES($1,$2) ON CONFLICT(usuario_id) DO NOTHING",
      [publisher, seedId(21 + i)],
    );
    // Only initialize permissions with a newly seeded organization lifecycle; preserve later revocations.
    if (i !== 1) {
      const audit = await db.query(
        "SELECT id FROM public.eventos_auditoria WHERE id=$1",
        [seedId(31 + i)],
      );
      if (!audit.rowCount) {
        await db.query(
          "INSERT INTO public.permisos_organizacion(organizacion_id,tipo_oferta,concedido_por) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
          [seedId(21 + i), i === 0 ? "internship" : "social_service", admin],
        );
        await db.query(
          `INSERT INTO public.revisiones_organizacion(id,organizacion_id,administrador_id,decision,comentario) VALUES($1,$2,$3,'approved','Aprobación FICTICIA para demostración') ON CONFLICT DO NOTHING`,
          [seedId(41 + i), seedId(21 + i), admin],
        );
        await db.query(
          `INSERT INTO public.eventos_auditoria(id,actor_id,tipo_entidad,entidad_id,accion) VALUES($1,$2,'organizacion',$3,'seed_demo')`,
          [seedId(31 + i), admin, seedId(21 + i)],
        );
      }
    }
  }
  // Stable demo fixtures: reruns preserve decisions, edits and deadlines.
  for (let i = 0; i < 8; i++) {
    const org = i % 2 === 0 ? 0 : 2,
      owner = users.get(demoAccounts[4 + org].email)!;
    const inserted = await db.query(
      `INSERT INTO public.ofertas(id,organizacion_id,creado_por,tipo,estado_operativo) VALUES($1,$2,$3,$4,'open') ON CONFLICT(id) DO NOTHING RETURNING id`,
      [
        seedId(100 + i),
        seedId(21 + org),
        owner,
        org === 0 ? "internship" : "social_service",
      ],
    );
    if (!inserted.rowCount) continue; // Never reset edits, states or deadlines on a later seed.
    await db.query(
      `INSERT INTO public.revisiones_oferta(id,oferta_id,numero_version,estado_revision,titulo,descripcion,actividades,requisitos,modalidad,ciudad,estado_region,fecha_limite,alcance_carreras,contacto_nombre,contacto_email,contacto_instrucciones,created_by,submitted_at,decided_at)
   VALUES($1,$2,1,'approved',$3,'Oportunidad completamente FICTICIA. No es una vacante real.','Actividades FICTICIAS de aprendizaje','Requisitos FICTICIOS',$4,'Hermosillo','Sonora',(now() AT TIME ZONE 'America/Hermosillo')::date + 60,'all','Responsable FICTICIO',$5,'Ejemplo sin recepción real de solicitudes',$6,now(),now())`,
      [
        seedId(200 + i),
        seedId(100 + i),
        `Oportunidad FICTICIA ${i + 1}`,
        ["remote", "hybrid", "in_person"][i % 3],
        demoAccounts[4 + org].email,
        owner,
      ],
    );
    await db.query(
      `INSERT INTO public.revisiones_administrativas(id,revision_id,administrador_id,decision,comentario) VALUES($1,$2,$3,'approved','Decisión FICTICIA del seed')`,
      [seedId(300 + i), seedId(200 + i), admin],
    );
    await db.query(
      "UPDATE public.ofertas SET revision_publicada_id=$1 WHERE id=$2",
      [seedId(200 + i), seedId(100 + i)],
    );
    // Only newly inserted fixtures receive these scenarios; never rewrite existing data.
    if (i >= 2) {
      await db.query(
        "UPDATE public.revisiones_oferta SET alcance_carreras='selected' WHERE id=$1",
        [seedId(200 + i)],
      );
      await db.query(
        "INSERT INTO public.revision_carreras(revision_id,carrera_id) VALUES($1,$2)",
        [seedId(200 + i), seedId(11 + (i % 3))],
      );
    }
    if (i === 0)
      await db.query(
        "UPDATE public.revisiones_oferta SET fecha_limite=(now() AT TIME ZONE 'America/Hermosillo')::date + 5 WHERE id=$1",
        [seedId(200 + i)],
      );
    if (i < 2) {
      await db.query(
        `INSERT INTO public.revisiones_oferta(id,oferta_id,numero_version,estado_revision,titulo,descripcion,actividades,requisitos,modalidad,ciudad,estado_region,fecha_limite,alcance_carreras,contacto_nombre,contacto_email,contacto_instrucciones,created_by,submitted_at,decided_at)
   SELECT $1,oferta_id,2,$2,titulo||' · edición FICTICIA',descripcion,actividades,requisitos,modalidad,ciudad,estado_region,fecha_limite,alcance_carreras,contacto_nombre,contacto_email,contacto_instrucciones,created_by,now(),CASE WHEN $2='rejected' THEN now() ELSE NULL END FROM public.revisiones_oferta WHERE id=$3`,
        [seedId(400 + i), i === 0 ? "pending" : "rejected", seedId(200 + i)],
      );
      if (i === 1)
        await db.query(
          `INSERT INTO public.revisiones_administrativas(id,revision_id,administrador_id,decision,comentario) VALUES($1,$2,$3,'rejected','Motivo FICTICIO: completar actividades antes de reenviar')`,
          [seedId(500 + i), seedId(400 + i), admin],
        );
    }
  }
}
