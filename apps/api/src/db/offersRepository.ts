import type { Pool } from "pg";
import { transaction, type Queryable } from "./pool.js";
import { AppError } from "../shared/errors.js";
import { assertPublication } from "../modules/organizations/policy.js";
import type {
  OfferType,
  OrganizationStatus,
} from "../modules/organizations/types.js";
import {
  revisionContentSchema,
  validateSubmission,
  hermosilloToday,
  type RevisionContent,
} from "../modules/offers/validation.js";
type Actor = { id: string; rol: "publisher" | "admin" };
type Offer = {
  id: string;
  organizacion_id: string;
  tipo: OfferType;
  estado_operativo: "open" | "closed" | "archived";
  revision_publicada_id: string | null;
  version: string;
};
type Revision = RevisionContent & {
  id: string;
  oferta_id: string;
  numero_version: number;
  estado_revision: "draft" | "pending" | "approved" | "rejected";
  version: string;
  created_at: string;
  submitted_at: string | null;
  decided_at: string | null;
};
const contentColumns = [
  "titulo",
  "descripcion",
  "actividades",
  "requisitos",
  "beneficios",
  "modalidad",
  "ciudad",
  "estado_region",
  "cupos",
  "fecha_limite",
  "duracion_info",
  "alcance_carreras",
  "contacto_nombre",
  "contacto_email",
  "contacto_url",
  "contacto_instrucciones",
] as const;
const revisionSelect = `SELECT r.*,r.fecha_limite::text AS fecha_limite,COALESCE(r.submitted_at::text,r.created_at::text)||':'||r.xmin::text AS version,COALESCE((SELECT json_agg(rc.carrera_id ORDER BY rc.carrera_id) FROM public.revision_carreras rc WHERE rc.revision_id=r.id),'[]'::json) AS carreras FROM public.revisiones_oferta r`;
const missing = () =>
  new AppError(
    404,
    "OFFER_NOT_FOUND",
    "No se encontró la oportunidad o no tienes acceso.",
  );
export class OffersRepository {
  constructor(private pool: Pool) {}
  private async actor(db: Queryable, actor: Actor) {
    const result = await db.query(
      "SELECT id FROM public.perfiles WHERE id=$1 AND rol=$2 AND activo=true FOR SHARE",
      [actor.id, actor.rol],
    );
    if (!result.rowCount)
      throw new AppError(403, "FORBIDDEN", "La cuenta no está autorizada.");
  }
  private async lockOrganization(db: Queryable, id: string) {
    const result = await db.query<{ estado: OrganizationStatus }>(
      "SELECT estado FROM public.organizaciones WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (!result.rows[0]) throw missing();
    return result.rows[0];
  }
  private async eligible(
    db: Queryable,
    orgId: string,
    status: OrganizationStatus,
    type: OfferType,
  ) {
    const permissions = await db.query<{ tipo_oferta: OfferType }>(
      "SELECT tipo_oferta FROM public.permisos_organizacion WHERE organizacion_id=$1",
      [orgId],
    );
    assertPublication(
      status,
      permissions.rows.map((p) => p.tipo_oferta),
      type,
    );
  }
  private async lockedOffer(db: Queryable, actor: Actor, id: string) {
    await this.actor(db, actor);
    const found = await db.query<Offer>(
      `SELECT o.*,o.updated_at::text AS version FROM public.ofertas o WHERE o.id=$1 AND ($2::boolean OR EXISTS(SELECT 1 FROM public.miembros_organizacion m WHERE m.organizacion_id=o.organizacion_id AND m.usuario_id=$3))`,
      [id, actor.rol === "admin", actor.id],
    );
    if (!found.rows[0]) throw missing();
    // All organization mutations lock in this order: organization, then offer.
    const org = await this.lockOrganization(db, found.rows[0].organizacion_id);
    const offer = (
      await db.query<Offer>(
        "SELECT *,updated_at::text AS version FROM public.ofertas WHERE id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    return { offer, org };
  }
  private async revision(db: Queryable, id: string) {
    const result = await db.query<Revision>(revisionSelect + " WHERE r.id=$1", [
      id,
    ]);
    if (!result.rows[0]) throw missing();
    return result.rows[0];
  }
  private content(revision: Revision): RevisionContent {
    return revisionContentSchema.parse(
      Object.fromEntries([
        ...contentColumns.map((key) => [key, revision[key] ?? ""]),
        ["carreras", revision.carreras],
      ]),
    );
  }
  private checkVersion(current: string, version: string) {
    if (current !== version)
      throw new AppError(
        409,
        "STALE_OFFER",
        "La oportunidad cambió. Actualiza antes de guardar.",
      );
  }
  private editable(offer: Offer) {
    if (offer.estado_operativo === "archived")
      throw new AppError(
        409,
        "OFFER_ARCHIVED",
        "Una oportunidad archivada no admite cambios.",
      );
  }
  private async audit(
    db: Queryable,
    actor: string,
    id: string,
    action: string,
    data: object = {},
  ) {
    await db.query(
      `INSERT INTO public.eventos_auditoria(actor_id,tipo_entidad,entidad_id,accion,datos) VALUES($1,'oferta',$2,$3,$4::jsonb)`,
      [actor, id, action, JSON.stringify(data)],
    );
  }
  private async degrees(db: Queryable, content: RevisionContent) {
    if (!content.carreras.length) return;
    const result = await db.query(
      "SELECT id FROM public.carreras WHERE id=ANY($1::uuid[]) AND activa=true",
      [content.carreras],
    );
    if (result.rows.length !== content.carreras.length)
      throw new AppError(
        400,
        "INVALID_DEGREES",
        "Hay carreras inexistentes o inactivas.",
      );
  }
  private async insertRevision(
    db: Queryable,
    actor: string,
    offerId: string,
    number: number,
    content: RevisionContent,
  ) {
    await this.degrees(db, content);
    const values = [
      offerId,
      number,
      ...contentColumns.map((key) => content[key]),
      actor,
    ];
    const result = await db.query<{ id: string }>(
      `INSERT INTO public.revisiones_oferta(oferta_id,numero_version,${contentColumns.join(",")},created_by) VALUES(${values.map((_v, i) => "$" + (i + 1)).join(",")}) RETURNING id`,
      values,
    );
    const id = result.rows[0].id;
    for (const degree of content.carreras)
      await db.query(
        "INSERT INTO public.revision_carreras(revision_id,carrera_id) VALUES($1,$2)",
        [id, degree],
      );
    return id;
  }
  async create(actor: Actor, type: OfferType, contentInput: unknown) {
    const id = await transaction(this.pool, async (db) => {
      await this.actor(db, actor);
      const membership = await db.query<{ organizacion_id: string }>(
        "SELECT organizacion_id FROM public.miembros_organizacion WHERE usuario_id=$1",
        [actor.id],
      );
      if (!membership.rows[0])
        throw new AppError(
          403,
          "ORGANIZATION_REQUIRED",
          "Se requiere una organización asociada.",
        );
      const orgId = membership.rows[0].organizacion_id,
        org = await this.lockOrganization(db, orgId);
      await this.eligible(db, orgId, org.estado, type);
      const content = revisionContentSchema.parse(contentInput);
      const offer = (
        await db.query<{ id: string }>(
          "INSERT INTO public.ofertas(organizacion_id,creado_por,tipo) VALUES($1,$2,$3) RETURNING id",
          [orgId, actor.id, type],
        )
      ).rows[0];
      const revision = await this.insertRevision(
        db,
        actor.id,
        offer.id,
        1,
        content,
      );
      await this.audit(db, actor.id, offer.id, "borrador_creado", {
        revision_id: revision,
      });
      return offer.id;
    });
    return this.detail(actor, id);
  }
  async detail(actor: Actor, id: string) {
    return transaction(this.pool, async (db) => {
      await db.query(
        "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY",
      );
      const result = await db.query<Offer & { organizacion_nombre: string }>(
        `SELECT o.*,o.updated_at::text AS version,g.nombre AS organizacion_nombre FROM public.ofertas o JOIN public.organizaciones g ON g.id=o.organizacion_id WHERE o.id=$1 AND ($2::boolean OR EXISTS(SELECT 1 FROM public.miembros_organizacion m WHERE m.organizacion_id=o.organizacion_id AND m.usuario_id=$3))`,
        [id, actor.rol === "admin", actor.id],
      );
      if (!result.rows[0]) throw missing();
      const revisions = await db.query<Revision>(
        revisionSelect + " WHERE r.oferta_id=$1 ORDER BY r.numero_version DESC",
        [id],
      );
      const reviews = await db.query(
        `SELECT a.id,a.revision_id,a.decision,a.comentario,a.created_at,p.nombre_completo AS administrador FROM public.revisiones_administrativas a JOIN public.revisiones_oferta r ON r.id=a.revision_id JOIN public.perfiles p ON p.id=a.administrador_id WHERE r.oferta_id=$1 ORDER BY a.created_at DESC`,
        [id],
      );
      const audit = await db.query(
        `SELECT e.id,e.accion,e.datos,e.created_at,p.nombre_completo AS actor FROM public.eventos_auditoria e LEFT JOIN public.perfiles p ON p.id=e.actor_id WHERE e.tipo_entidad='oferta' AND e.entidad_id=$1 ORDER BY e.created_at DESC,e.id`,
        [id],
      );
      const offer = result.rows[0],
        published =
          revisions.rows.find((r) => r.id === offer.revision_publicada_id) ??
          null;
      return {
        ...offer,
        revisiones: revisions.rows,
        publicada: published,
        vigente: !!published && published.fecha_limite >= hermosilloToday(),
        decisiones: reviews.rows,
        auditoria: audit.rows,
      };
    });
  }
  async list(
    actor: Actor,
    filters: {
      tipo?: OfferType;
      estado?: string;
      q?: string;
      page: number;
      pageSize: number;
    },
    pendingOnly = false,
  ) {
    const values = [
      actor.rol === "admin",
      actor.id,
      filters.tipo ?? null,
      filters.estado ?? null,
      filters.q ? `%${filters.q}%` : null,
      pendingOnly,
    ];
    const where = ` WHERE ($1::boolean OR EXISTS(SELECT 1 FROM public.miembros_organizacion m WHERE m.usuario_id=$2 AND m.organizacion_id=o.organizacion_id)) AND ($3::text IS NULL OR o.tipo=$3) AND ($4::text IS NULL OR o.estado_operativo=$4 OR latest.estado_revision=$4) AND ($5::text IS NULL OR latest.titulo ILIKE $5 OR g.nombre ILIKE $5) AND (NOT $6::boolean OR latest.estado_revision='pending')`;
    const from = ` FROM public.ofertas o JOIN public.organizaciones g ON g.id=o.organizacion_id JOIN LATERAL (SELECT id,titulo,estado_revision,numero_version,fecha_limite FROM public.revisiones_oferta r WHERE r.oferta_id=o.id ORDER BY numero_version DESC LIMIT 1) latest ON true LEFT JOIN public.revisiones_oferta published ON published.id=o.revision_publicada_id`;
    const items = await this.pool.query(
      `SELECT o.id,o.tipo,o.estado_operativo,g.nombre AS organizacion_nombre,latest.id AS revision_id,latest.titulo,latest.estado_revision,latest.numero_version,published.titulo AS titulo_publicado,published.numero_version AS version_publicada,published.fecha_limite::text AS fecha_publicada,COALESCE(published.fecha_limite >= $9::date,false) AS vigente` +
        from +
        where +
        " ORDER BY o.updated_at DESC,o.id LIMIT $7 OFFSET $8",
      [
        ...values,
        filters.pageSize,
        (filters.page - 1) * filters.pageSize,
        hermosilloToday(),
      ],
    );
    const total = await this.pool.query<{ total: number }>(
      "SELECT count(*)::int AS total" + from + where,
      values,
    );
    return {
      items: items.rows,
      total: total.rows[0].total,
      page: filters.page,
      pageSize: filters.pageSize,
    };
  }
  async clone(actor: Actor, id: string, version: string) {
    await transaction(this.pool, async (db) => {
      const { offer, org } = await this.lockedOffer(db, actor, id);
      this.editable(offer);
      this.checkVersion(offer.version, version);
      await this.eligible(db, offer.organizacion_id, org.estado, offer.tipo);
      const revisions = (
        await db.query<Revision>(
          revisionSelect +
            " WHERE r.oferta_id=$1 ORDER BY r.numero_version DESC",
          [id],
        )
      ).rows;
      if (
        revisions.some(
          (r) =>
            r.estado_revision === "draft" || r.estado_revision === "pending",
        )
      )
        throw new AppError(
          409,
          "OPEN_REVISION",
          "Ya existe un borrador o una revisión pendiente.",
        );
      const source =
        revisions[0]?.estado_revision === "rejected"
          ? revisions[0]
          : revisions.find((r) => r.id === offer.revision_publicada_id);
      if (!source)
        throw new AppError(
          409,
          "NO_REVISION_SOURCE",
          "No hay una revisión para clonar.",
        );
      const revision = await this.insertRevision(
        db,
        actor.id,
        id,
        revisions[0].numero_version + 1,
        this.content(source),
      );
      await db.query("UPDATE public.ofertas SET updated_at=now() WHERE id=$1", [
        id,
      ]);
      await this.audit(db, actor.id, id, "nueva_revision", {
        revision_id: revision,
        origen: source.id,
      });
    });
    return this.detail(actor, id);
  }
  private async offerForRevision(id: string) {
    const result = await this.pool.query<{ oferta_id: string }>(
      "SELECT oferta_id FROM public.revisiones_oferta WHERE id=$1",
      [id],
    );
    if (!result.rows[0]) throw missing();
    return result.rows[0].oferta_id;
  }
  async revisionDetail(actor: Actor, id: string) {
    return this.detail(actor, await this.offerForRevision(id));
  }
  async update(
    actor: Actor,
    revisionId: string,
    version: string,
    content: RevisionContent,
  ) {
    const id = await this.offerForRevision(revisionId);
    await transaction(this.pool, async (db) => {
      const { offer, org } = await this.lockedOffer(db, actor, id);
      this.editable(offer);
      await this.eligible(db, offer.organizacion_id, org.estado, offer.tipo);
      const revision = await this.revision(db, revisionId);
      this.checkVersion(revision.version, version);
      if (revision.estado_revision !== "draft")
        throw new AppError(
          409,
          "REVISION_FROZEN",
          "Solo se pueden editar borradores.",
        );
      await this.degrees(db, content);
      await db.query(
        `UPDATE public.revisiones_oferta SET ${contentColumns.map((key, i) => `${key}=$${i + 1}`).join(",")} WHERE id=$${contentColumns.length + 1}`,
        [...contentColumns.map((key) => content[key]), revisionId],
      );
      await db.query(
        "DELETE FROM public.revision_carreras WHERE revision_id=$1",
        [revisionId],
      );
      for (const degree of content.carreras)
        await db.query(
          "INSERT INTO public.revision_carreras(revision_id,carrera_id) VALUES($1,$2)",
          [revisionId, degree],
        );
      await db.query("UPDATE public.ofertas SET updated_at=now() WHERE id=$1", [
        id,
      ]);
      await this.audit(db, actor.id, id, "borrador_actualizado", {
        revision_id: revisionId,
      });
    });
    return this.detail(actor, id);
  }
  async submit(actor: Actor, revisionId: string, version: string) {
    const id = await this.offerForRevision(revisionId);
    await transaction(this.pool, async (db) => {
      const { offer, org } = await this.lockedOffer(db, actor, id);
      this.editable(offer);
      await this.eligible(db, offer.organizacion_id, org.estado, offer.tipo);
      const revision = await this.revision(db, revisionId);
      this.checkVersion(revision.version, version);
      if (revision.estado_revision !== "draft")
        throw new AppError(
          409,
          "REVISION_FROZEN",
          "Solo se puede enviar un borrador.",
        );
      const content = this.content(revision);
      validateSubmission(content);
      await this.degrees(db, content);
      await db.query(
        "UPDATE public.revisiones_oferta SET estado_revision='pending',submitted_at=now() WHERE id=$1",
        [revisionId],
      );
      await db.query("UPDATE public.ofertas SET updated_at=now() WHERE id=$1", [
        id,
      ]);
      await this.audit(db, actor.id, id, "revision_enviada", {
        revision_id: revisionId,
      });
    });
    return this.detail(actor, id);
  }
  private async decideLocked(
    db: Queryable,
    actor: Actor,
    offer: Offer,
    org: { estado: OrganizationStatus },
    revision: Revision,
    decision: "approved" | "rejected",
    comment: string,
  ) {
    if (actor.rol !== "admin")
      throw new AppError(
        403,
        "FORBIDDEN",
        "Solo administración puede decidir una revisión.",
      );
    if (revision.estado_revision !== "pending")
      throw new AppError(
        409,
        "ALREADY_DECIDED",
        "La revisión ya fue decidida o no está pendiente.",
      );
    if (decision === "rejected" && !comment.trim())
      throw new AppError(
        400,
        "REASON_REQUIRED",
        "Escribe el motivo del rechazo.",
      );
    if (decision === "approved") {
      this.editable(offer);
      await this.eligible(db, offer.organizacion_id, org.estado, offer.tipo);
      const content = this.content(revision);
      validateSubmission(content);
      await this.degrees(db, content);
    }
    await db.query(
      "INSERT INTO public.revisiones_administrativas(revision_id,administrador_id,decision,comentario) VALUES($1,$2,$3,$4)",
      [revision.id, actor.id, decision, comment.trim() || null],
    );
    await db.query(
      "UPDATE public.revisiones_oferta SET estado_revision=$1,decided_at=now() WHERE id=$2",
      [decision, revision.id],
    );
    if (decision === "approved")
      await db.query(
        "UPDATE public.ofertas SET revision_publicada_id=$1,estado_operativo=CASE WHEN revision_publicada_id IS NULL THEN 'open' ELSE estado_operativo END WHERE id=$2",
        [revision.id, offer.id],
      );
    else
      await db.query("UPDATE public.ofertas SET updated_at=now() WHERE id=$1", [
        offer.id,
      ]);
    await this.audit(db, actor.id, offer.id, "revision_decidida", {
      revision_id: revision.id,
      decision,
      comentario: comment.trim() || null,
    });
  }
  async decide(
    actor: Actor,
    revisionId: string,
    version: string,
    decision: "approved" | "rejected",
    comment = "",
  ) {
    const id = await this.offerForRevision(revisionId);
    await transaction(this.pool, async (db) => {
      const { offer, org } = await this.lockedOffer(db, actor, id);
      const revision = await this.revision(db, revisionId);
      this.checkVersion(revision.version, version);
      await this.decideLocked(
        db,
        actor,
        offer,
        org,
        revision,
        decision,
        comment,
      );
    });
    return this.detail(actor, id);
  }
  async state(
    actor: Actor,
    id: string,
    version: string,
    state: "open" | "closed" | "archived",
  ) {
    await transaction(this.pool, async (db) => {
      const { offer, org } = await this.lockedOffer(db, actor, id);
      this.checkVersion(offer.version, version);
      this.editable(offer);
      if (state === "archived" && actor.rol !== "admin")
        throw new AppError(
          403,
          "FORBIDDEN",
          "Solo administración puede archivar.",
        );
      if (state === offer.estado_operativo)
        throw new AppError(
          409,
          "INVALID_STATE",
          "La oportunidad ya tiene ese estado.",
        );
      if (state === "open") {
        if (!offer.revision_publicada_id)
          throw new AppError(
            409,
            "NO_PUBLICATION",
            "No hay una versión aprobada para reabrir.",
          );
        const published = await this.revision(db, offer.revision_publicada_id);
        if (
          published.estado_revision !== "approved" ||
          published.fecha_limite < hermosilloToday()
        )
          throw new AppError(
            409,
            "EXPIRED_REVISION",
            "La versión publicada no está vigente.",
          );
        await this.eligible(db, offer.organizacion_id, org.estado, offer.tipo);
      }
      await db.query(
        "UPDATE public.ofertas SET estado_operativo=$1 WHERE id=$2",
        [state, id],
      );
      await this.audit(db, actor.id, id, "estado_actualizado", {
        anterior: offer.estado_operativo,
        nuevo: state,
      });
    });
    return this.detail(actor, id);
  }
  async correct(
    actor: Actor,
    id: string,
    version: string,
    content: RevisionContent,
    comment: string,
  ) {
    await transaction(this.pool, async (db) => {
      const { offer, org } = await this.lockedOffer(db, actor, id);
      if (actor.rol !== "admin")
        throw new AppError(
          403,
          "FORBIDDEN",
          "Solo administración puede corregir.",
        );
      this.checkVersion(offer.version, version);
      this.editable(offer);
      validateSubmission(content);
      const rows = (
        await db.query<{ numero_version: number; estado_revision: string }>(
          "SELECT numero_version,estado_revision FROM public.revisiones_oferta WHERE oferta_id=$1 ORDER BY numero_version DESC",
          [id],
        )
      ).rows;
      if (rows.some((r) => ["draft", "pending"].includes(r.estado_revision)))
        throw new AppError(
          409,
          "OPEN_REVISION",
          "Resuelve el borrador o la revisión pendiente antes de corregir.",
        );
      const revisionId = await this.insertRevision(
        db,
        actor.id,
        id,
        (rows[0]?.numero_version ?? 0) + 1,
        content,
      );
      await db.query(
        "UPDATE public.revisiones_oferta SET estado_revision='pending',submitted_at=now() WHERE id=$1",
        [revisionId],
      );
      await this.decideLocked(
        db,
        actor,
        offer,
        org,
        await this.revision(db, revisionId),
        "approved",
        comment,
      );
      await this.audit(db, actor.id, id, "correccion_administrativa", {
        revision_id: revisionId,
        motivo: comment,
      });
    });
    return this.detail(actor, id);
  }
  async published(id: string) {
    const result = await this.pool.query(
      `SELECT r.id,r.oferta_id,r.numero_version,${contentColumns.map((key) => "r." + key).join(",")},r.fecha_limite::text AS fecha_limite,o.tipo,g.nombre AS organizacion_nombre,COALESCE((SELECT json_agg(carrera_id) FROM public.revision_carreras WHERE revision_id=r.id),'[]'::json) AS carreras FROM public.ofertas o JOIN public.organizaciones g ON g.id=o.organizacion_id JOIN public.revisiones_oferta r ON r.id=o.revision_publicada_id AND r.oferta_id=o.id WHERE o.id=$1 AND o.estado_operativo='open' AND g.estado='approved' AND r.estado_revision='approved' AND r.fecha_limite >= $2::date`,
      [id, hermosilloToday()],
    );
    if (!result.rows[0]) throw missing();
    return result.rows[0];
  }
  async degreesList() {
    return (
      await this.pool.query(
        "SELECT c.id,c.nombre,c.departamento_id,d.nombre AS departamento FROM public.carreras c JOIN public.departamentos d ON d.id=c.departamento_id WHERE c.activa=true ORDER BY d.nombre,c.nombre",
      )
    ).rows;
  }
}
