import type { FastifyInstance, FastifyRequest } from "fastify";
import multipart from "@fastify/multipart";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db, orgs, customers, jobs, properties } from "@ofp/db";
import { createFixedWindowRateLimit, requestIpKey } from "../rate-limit.js";
import { getOrgLogo, savePhoto } from "../uploads.js";
import { sendLeadAlert, type LeadAlert } from "../lead-alert.js";

const bookBody = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320).optional(),
  phone: z.string().trim().max(50).optional(),
  title: z.string().trim().min(1).max(250),
  description: z.string().trim().max(5_000).optional(),
});

const bookingRateLimit = createFixedWindowRateLimit({
  max: 10,
  windowMs: 60 * 60 * 1000,
  key: (request: FastifyRequest) => {
    const orgId = (request.params as { orgId?: string } | undefined)?.orgId ?? "unknown";
    return `${requestIpKey(request)}:${orgId}`;
  },
});

// ── Formularios de la web pública (construyer.com) ───────────────────────────
// Instalación de una sola empresa: la solicitud entra en OFP_PUBLIC_ORG_ID o, si no
// está definido, en la primera organización creada.
const MAX_REQUEST_PHOTOS = 6;

const WHEN_LABELS: Record<string, string> = {
  asap: "Lo antes posible",
  today: "Hoy",
  tomorrow: "Mañana",
  week: "Esta semana",
  flexible: "Fecha flexible / aún no lo sabe",
};

const quoteRequestBody = z
  .object({
    category: z.string().trim().min(1).max(80),
    description: z.string().trim().min(1).max(5_000),
    district: z.string().trim().min(1).max(120),
    address: z.string().trim().max(300).optional().default(""),
    when: z.enum(["asap", "today", "tomorrow", "week", "flexible", "date"]),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    name: z.string().trim().min(1).max(200),
    phone: z.string().trim().min(6).max(50),
    email: z.string().trim().email().max(320).optional().or(z.literal("")),
  })
  .refine((v) => v.when !== "date" || Boolean(v.date), { path: ["date"], message: "falta la fecha" });

const contactBody = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(6).max(50),
  email: z.string().trim().email().max(320).optional().or(z.literal("")),
  message: z.string().trim().min(1).max(5_000),
});

const publicFormRateLimit = createFixedWindowRateLimit({
  max: 10,
  windowMs: 60 * 60 * 1000,
  key: (request: FastifyRequest) => `form:${requestIpKey(request)}`,
});

async function resolvePublicOrgId(): Promise<string | null> {
  const configured = process.env.OFP_PUBLIC_ORG_ID?.trim();
  if (configured) return configured;
  const [first] = await db.select({ id: orgs.id }).from(orgs).orderBy(asc(orgs.createdAt)).limit(1);
  return first?.id ?? null;
}

/** Reutiliza al cliente que ya escribió con el mismo teléfono; si no existe, lo crea. */
async function upsertLeadCustomer(
  orgId: string,
  data: { name: string; phone: string; email?: string },
) {
  const email = data.email ? data.email.toLowerCase() : undefined;
  const [existing] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.orgId, orgId), eq(customers.phone, data.phone)))
    .limit(1);
  if (existing) return existing;
  const [created] = await db.insert(customers).values({ orgId, name: data.name, phone: data.phone, email }).returning();
  return created;
}

const referenceOf = (jobId: string) => `C-${jobId.slice(0, 8).toUpperCase()}`;

export async function publicRoutes(app: FastifyInstance) {
  await app.register(multipart, {
    limits: { files: MAX_REQUEST_PHOTOS, fields: 4, fileSize: 10 * 1024 * 1024 },
  });

  app.get("/:orgId/logo", async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const logo = await getOrgLogo(orgId);
    if (!logo) return reply.code(404).send({ error: "logo no encontrado" });
    reply.header("Cache-Control", "public, max-age=300, immutable");
    return reply.type(logo.contentType).send(logo.buffer);
  });

  app.get("/:orgId", async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const [org] = await db.select({ id: orgs.id, name: orgs.name }).from(orgs).where(eq(orgs.id, orgId));
    if (!org) return reply.code(404).send({ error: "empresa no encontrada" });
    return { org };
  });

  app.post("/:orgId/book", { preHandler: bookingRateLimit }, async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const parsed = bookBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const [org] = await db.select({ id: orgs.id }).from(orgs).where(eq(orgs.id, orgId));
    if (!org) return reply.code(404).send({ error: "empresa no encontrada" });

    const { name, phone, title, description } = parsed.data;
    const email = parsed.data.email?.toLowerCase();
    const job = await db.transaction(async (tx) => {
      const [customer] = await tx.insert(customers).values({ orgId, name, email, phone }).returning();
      const [createdJob] = await tx
        .insert(jobs)
        .values({ orgId, customerId: customer.id, title, description, status: "lead" })
        .returning();
      return createdJob;
    });

    return reply.code(201).send({ ok: true, requestId: job.id });
  });

  // Cotizador de la web: multipart con el campo `payload` (JSON, debe ir primero) y hasta 6 `photos`.
  app.post("/requests", { preHandler: publicFormRateLimit }, async (req, reply) => {
    if (!req.isMultipart()) return reply.code(400).send({ error: "se esperaba multipart/form-data" });
    const orgId = await resolvePublicOrgId();
    if (!orgId) return reply.code(503).send({ error: "el sistema aún no está configurado" });

    let jobId: string | null = null;
    let reference = "";
    let saved = 0;
    let alertData: LeadAlert | null = null;
    try {
      for await (const part of req.parts()) {
        if (part.type === "field") {
          if (part.fieldname !== "payload" || jobId) continue;
          let raw: unknown;
          try {
            raw = JSON.parse(String(part.value));
          } catch {
            return reply.code(400).send({ error: "payload inválido" });
          }
          const parsed = quoteRequestBody.safeParse(raw);
          if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
          const q = parsed.data;

          const when = q.when === "date" ? `Fecha elegida: ${q.date}` : WHEN_LABELS[q.when];
          const description = [
            `Categoría: ${q.category}`,
            `Distrito: ${q.district}`,
            q.address ? `Dirección o referencia: ${q.address}` : null,
            `Cuándo lo necesita: ${when}`,
            "",
            q.description,
            "",
            "Origen: formulario de cotización de construyer.com",
          ]
            .filter((line) => line !== null)
            .join("\n");

          const customer = await upsertLeadCustomer(orgId, { name: q.name, phone: q.phone, email: q.email || undefined });
          const created = await db.transaction(async (tx) => {
            let propertyId: string | undefined;
            if (q.address) {
              const [property] = await tx
                .insert(properties)
                .values({ orgId, customerId: customer.id, address: `${q.address}, ${q.district}` })
                .returning({ id: properties.id });
              propertyId = property.id;
            }
            const [job] = await tx
              .insert(jobs)
              .values({
                orgId,
                customerId: customer.id,
                propertyId,
                title: `${q.category} · ${q.district}`.slice(0, 250),
                description,
                status: "lead",
              })
              .returning({ id: jobs.id });
            return job;
          });
          jobId = created.id;
          reference = referenceOf(created.id);
          alertData = {
            reference,
            jobId: created.id,
            title: `${q.category} · ${q.district}`,
            customerName: q.name,
            when: q.when === "date" ? q.date : WHEN_LABELS[q.when],
            phone: q.phone,
            email: q.email || undefined,
            details: description,
            category: q.category,
            district: q.district,
            summary: q.description,
          };
        } else if (part.type === "file") {
          if (!jobId) {
            part.file.resume();
            return reply.code(400).send({ error: "el campo payload debe enviarse antes que las fotos" });
          }
          try {
            await savePhoto(orgId, jobId, { stream: part.file, filenameHint: part.filename ?? null });
            saved += 1;
          } catch (err) {
            // Una foto inválida o demasiado grande no descarta la solicitud.
            req.log.warn({ err }, "foto de solicitud pública omitida");
            part.file.resume();
          }
        }
      }
    } catch (err) {
      req.log.error({ err }, "solicitud pública falló");
      if (!jobId) return reply.code(400).send({ error: "no se pudo leer la solicitud" });
    }

    if (!jobId) return reply.code(400).send({ error: "falta el campo payload" });
    if (alertData) void sendLeadAlert({ ...alertData, photos: saved });
    return reply.code(201).send({ reference, photos: saved });
  });

  app.post("/contact", { preHandler: publicFormRateLimit }, async (req, reply) => {
    const parsed = contactBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const orgId = await resolvePublicOrgId();
    if (!orgId) return reply.code(503).send({ error: "el sistema aún no está configurado" });

    const m = parsed.data;
    const customer = await upsertLeadCustomer(orgId, { name: m.name, phone: m.phone, email: m.email || undefined });
    const [job] = await db
      .insert(jobs)
      .values({
        orgId,
        customerId: customer.id,
        title: "Mensaje de contacto (web)",
        description: `${m.message}\n\nOrigen: formulario de contacto de construyer.com`,
        status: "lead",
      })
      .returning({ id: jobs.id });
    const reference = referenceOf(job.id);
    void sendLeadAlert({
      reference,
      jobId: job.id,
      title: "Mensaje de contacto (web)",
      customerName: m.name,
      phone: m.phone,
      email: m.email || undefined,
      details: m.message,
      summary: m.message,
    });
    return reply.code(201).send({ ok: true, reference });
  });
}
