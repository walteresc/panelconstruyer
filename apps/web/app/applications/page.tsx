"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type SpecialistApplication, type SpecialistApplicationStatus } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

const STATUS_LABEL: Record<SpecialistApplicationStatus, string> = {
  new: "Nuevas",
  review: "En evaluación",
  validated: "Validadas",
  discarded: "Descartadas",
};

const STATUS_VARIANT: Record<SpecialistApplicationStatus, "scheduled" | "in_progress" | "completed" | "canceled"> = {
  new: "scheduled",
  review: "in_progress",
  validated: "completed",
  discarded: "canceled",
};

const TYPE_LABEL: Record<string, string> = {
  independiente: "Independiente",
  cuadrilla: "Cuadrilla",
  empresa: "Empresa especializada",
};

/** Número peruano de 9 dígitos (o con código de país) para abrir WhatsApp; null si no parece un celular. */
function whatsappLink(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (/^9\d{8}$/.test(digits)) return `https://wa.me/51${digits}`;
  if (/^519\d{8}$/.test(digits)) return `https://wa.me/${digits}`;
  return null;
}

function ApplicationCard({ app, onSaved }: { app: SpecialistApplication; onSaved: (a: SpecialistApplication) => void }) {
  const [notes, setNotes] = useState(app.notes ?? "");
  const [document, setDocument] = useState(app.document ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wa = whatsappLink(app.phone);
  const dirty = notes !== (app.notes ?? "") || document !== (app.document ?? "");

  async function patch(body: { status?: SpecialistApplicationStatus; notes?: string; document?: string }) {
    setSaving(true);
    setError(null);
    try {
      onSaved(await api.patchSpecialistApplication(app.id, body));
    } catch {
      setError("No se pudo guardar. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-fg">{app.name}</h2>
            <p className="mt-0.5 text-xs text-fg-muted">
              {TYPE_LABEL[app.applicantType] ?? app.applicantType}
              {app.companyName ? ` · ${app.companyName}` : ""} · {new Date(app.createdAt).toLocaleDateString("es-PE")}
            </p>
          </div>
          <Badge variant={STATUS_VARIANT[app.status]} className="normal-case">{STATUS_LABEL[app.status]}</Badge>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="completed" className="normal-case">Principal: {app.primarySpecialty}</Badge>
          {app.specialties
            .filter((s) => s !== app.primarySpecialty)
            .map((s) => (
              <Badge key={s} className="normal-case">{s}</Badge>
            ))}
        </div>

        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-fg-dim">Teléfono</dt><dd className="text-fg">{app.phone}{wa && <> · <a href={wa} target="_blank" rel="noopener noreferrer" className="text-fg-link hover:underline">WhatsApp</a></>}</dd></div>
          <div><dt className="text-xs text-fg-dim">Disponibilidad</dt><dd className="text-fg">{app.availability}</dd></div>
          <div><dt className="text-xs text-fg-dim">Zonas</dt><dd className="text-fg">{app.districts}</dd></div>
          <div><dt className="text-xs text-fg-dim">Experiencia y movilidad</dt><dd className="text-fg">{app.years} años · {app.mobility}</dd></div>
          {app.tools && <div className="sm:col-span-2"><dt className="text-xs text-fg-dim">Herramientas</dt><dd className="text-fg">{app.tools}</dd></div>}
        </dl>
        <p className="whitespace-pre-line text-sm text-fg-muted">{app.experience}</p>

        <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
          <label className="block text-xs text-fg-dim">
            Documento verificado (DNI, CE o RUC)
            <Input value={document} onChange={(e) => setDocument(e.target.value)} maxLength={20} className="mt-1" placeholder="Se registra en la validación" />
          </label>
          <label className="block text-xs text-fg-dim">
            Notas internas
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} className="mt-1" placeholder="Referencias, llamada, próximos pasos…" />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(STATUS_LABEL) as SpecialistApplicationStatus[])
            .filter((s) => s !== app.status)
            .map((s) => (
              <Button key={s} size="sm" variant={s === "discarded" ? "danger" : "secondary"} disabled={saving} onClick={() => patch({ status: s })}>
                Pasar a {STATUS_LABEL[s].toLowerCase()}
              </Button>
            ))}
          {dirty && (
            <Button size="sm" disabled={saving} onClick={() => patch({ notes, document })}>
              Guardar notas y documento
            </Button>
          )}
          {error && <span role="alert" className="text-xs text-red">{error}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ApplicationsPage() {
  const [apps, setApps] = useState<SpecialistApplication[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SpecialistApplicationStatus | "all">("new");

  useEffect(() => {
    let cancelled = false;
    api
      .specialistApplications()
      .then((r) => !cancelled && setApps(r.applications))
      .catch(() => !cancelled && setError("No se pudieron cargar las postulaciones."));
    return () => {
      cancelled = true;
    };
  }, []);

  const replace = useCallback((updated: SpecialistApplication) => {
    setApps((list) => (list ? list.map((a) => (a.id === updated.id ? updated : a)) : list));
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: apps?.length ?? 0, new: 0, review: 0, validated: 0, discarded: 0 };
    for (const a of apps ?? []) c[a.status] = (c[a.status] ?? 0) + 1;
    return c;
  }, [apps]);

  const visible = useMemo(() => (apps ?? []).filter((a) => filter === "all" || a.status === filter), [apps, filter]);

  return (
    <div>
      <PageHeader
        title="Postulaciones"
        description="Especialistas que postularon desde Trabaja con nosotros. Son datos internos: no se publican. El documento se pide en la validación, no al postular."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {(["new", "review", "validated", "discarded", "all"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium ${
              filter === key ? "bg-accent text-white" : "bg-surface-300 text-fg-muted hover:text-fg"
            }`}
          >
            {key === "all" ? "Todas" : STATUS_LABEL[key]} ({counts[key] ?? 0})
          </button>
        ))}
      </div>

      {error && <p role="alert" className="text-sm text-red">{error}</p>}
      {!apps && !error && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      )}
      {apps && visible.length === 0 && (
        <EmptyState title="No hay postulaciones en esta vista" description="Cuando alguien postule desde la web, aparecerá aquí." />
      )}
      <div className="flex flex-col gap-3">
        {visible.map((a) => (
          <ApplicationCard key={a.id} app={a} onSaved={replace} />
        ))}
      </div>
    </div>
  );
}
