import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db, specialistApplications } from "@ofp/db";
import { resolveOrgId } from "./org.js";

export const APPLICANT_TYPES = ["independiente", "cuadrilla", "empresa"] as const;
export const APPLICATION_STATUSES = ["new", "review", "validated", "discarded"] as const;

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

/** Postulación enviada desde la web pública. No incluye documento: se pide en la validación posterior. */
export const affiliateBody = z
  .object({
    applicantType: z.enum(APPLICANT_TYPES),
    companyName: optionalText(150),
    name: z.string().trim().min(1).max(200),
    phone: z.string().trim().min(6).max(50),
    specialties: z.array(z.string().trim().min(1).max(80)).min(1).max(15),
    primarySpecialty: z.string().trim().min(1).max(80),
    availability: z.string().trim().min(1).max(80),
    districts: z.string().trim().min(2).max(300),
    years: z.string().trim().min(1).max(20),
    mobility: z.string().trim().min(1).max(60),
    tools: optionalText(500),
    experience: z.string().trim().min(10).max(1_500),
  })
  .refine((v) => v.specialties.includes(v.primarySpecialty), {
    path: ["primarySpecialty"],
    message: "la especialidad principal debe estar entre las elegidas",
  });

const patchBody = z
  .object({
    status: z.enum(APPLICATION_STATUSES).optional(),
    notes: z.string().trim().max(2_000).optional(),
    /** DNI, CE o RUC verificado en la validación. */
    document: z.string().trim().max(20).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "no hay cambios" });

// Datos internos de especialistas (con teléfono): solo oficina (owner y dispatcher); ver operational-authorization.ts.
export async function specialistApplicationRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    const orgId = await resolveOrgId(req);
    const { status } = (req.query ?? {}) as { status?: string };
    const where = APPLICATION_STATUSES.includes(status as (typeof APPLICATION_STATUSES)[number])
      ? and(eq(specialistApplications.orgId, orgId), eq(specialistApplications.status, status as string))
      : eq(specialistApplications.orgId, orgId);
    const rows = await db.select().from(specialistApplications).where(where).orderBy(desc(specialistApplications.createdAt));
    return { applications: rows };
  });

  app.patch("/:id", async (req, reply) => {
    const orgId = await resolveOrgId(req);
    const { id } = req.params as { id: string };
    const parsed = patchBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const [row] = await db
      .update(specialistApplications)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(specialistApplications.orgId, orgId), eq(specialistApplications.id, id)))
      .returning();
    if (!row) return reply.code(404).send({ error: "postulación no encontrada" });
    return row;
  });
}
