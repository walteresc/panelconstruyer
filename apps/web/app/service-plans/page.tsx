"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { formatMoney, type ServicePlanDTO } from "@ofp/shared";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) };
  const token = typeof window !== "undefined" ? localStorage.getItem("ofp_token") : null;
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...headers },
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

const defaultBenefits = ["Atención prioritaria", "Revisiones periódicas incluidas", "Recordatorios de renovación"];

export default function ServicePlansPage() {
  const [plans, setPlans] = useState<ServicePlanDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "Plan de mantenimiento del hogar",
    description: "Plan de mantenimiento periódico con visitas incluidas y atención prioritaria.",
    includedVisitsPerTerm: "2",
    termMonths: "12",
    price: "199",
    priorityScheduling: true,
    benefits: defaultBenefits.join("\n"),
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<ServicePlanDTO[]>("/api/service-plans");
      setPlans(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los planes de mantenimiento");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const activeCount = useMemo(() => plans.filter((p) => p.active).length, [plans]);

  async function createPlan() {
    const priceCents = Math.round(Number.parseFloat(form.price || "0") * 100);
    await apiRequest<ServicePlanDTO>("/api/service-plans", {
      method: "POST",
      body: JSON.stringify({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        includedVisitsPerTerm: Number.parseInt(form.includedVisitsPerTerm || "0", 10),
        termMonths: Number.parseInt(form.termMonths || "12", 10),
        priceCents,
        priorityScheduling: form.priorityScheduling,
        benefits: form.benefits
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean),
      }),
    });
    setShowForm(false);
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Planes de mantenimiento"
        description={`${activeCount} plan${activeCount !== 1 ? "es" : ""} activo${activeCount !== 1 ? "s" : ""} · membresías, visitas incluidas, renovaciones y atención prioritaria`}
        actions={
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            ⊕ Nuevo plan
          </Button>
        }
      />

      {showForm && (
        <Card className="mb-5 border-accent/30">
          <div className="grid gap-4">
            <div>
              <h3 className="text-base font-semibold text-fg">Crear plan de mantenimiento</h3>
              <p className="text-sm text-fg-muted mt-1">
                Mantenlo simple: visitas incluidas, recordatorios, renovaciones y beneficios de prioridad.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nombre del plan" />
              <Input value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} type="number" min="0" step="0.01" placeholder="Precio" />
              <Input value={form.includedVisitsPerTerm} onChange={(e) => setForm((f) => ({ ...f, includedVisitsPerTerm: e.target.value }))} type="number" min="0" placeholder="Visitas incluidas" />
              <Input value={form.termMonths} onChange={(e) => setForm((f) => ({ ...f, termMonths: e.target.value }))} type="number" min="1" placeholder="Duración (meses)" />
            </div>
            <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Descripción" />
            <textarea
              value={form.benefits}
              onChange={(e) => setForm((f) => ({ ...f, benefits: e.target.value }))}
              className="min-h-24 rounded-lg border border-border bg-surface-200 px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              placeholder="Un beneficio por línea"
            />
            <label className="flex items-center gap-2 text-sm text-fg-muted">
              <input
                type="checkbox"
                checked={form.priorityScheduling}
                onChange={(e) => setForm((f) => ({ ...f, priorityScheduling: e.target.checked }))}
              />
              Beneficio de atención prioritaria
            </label>
            <div className="flex gap-2">
              <Button onClick={createPlan} disabled={!form.name.trim()}>
                Crear plan
              </Button>
              <Button variant="secondary" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </Card>
      )}

      {error && (
        <Card className="mb-5 border-red/30 bg-red/5">
          <p className="text-sm text-red font-medium">API de planes no disponible</p>
          <p className="text-xs text-fg-muted mt-1">{error}</p>
        </Card>
      )}

      {loading ? (
        <Card>
          <p className="text-sm text-fg-muted">Cargando planes de mantenimiento...</p>
        </Card>
      ) : plans.length === 0 ? (
        <Card>
          <EmptyState title="Aún no hay planes de mantenimiento" description="Crea un plan para controlar las visitas incluidas, la renovación y los beneficios de prioridad." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {plans.map((plan) => (
            <Card key={plan.id} className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-fg">{plan.name}</h3>
                  {plan.description && <p className="text-sm text-fg-muted mt-1">{plan.description}</p>}
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${plan.active ? "bg-green/10 text-green" : "bg-surface-500 text-fg-muted"}`}>
                  {plan.active ? "Activo" : "Inactivo"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg bg-surface-200 p-3">
                  <p className="text-fg-dim text-xs uppercase tracking-wide">Precio</p>
                  <p className="font-semibold text-fg mt-1">{formatMoney(plan.priceCents)}</p>
                </div>
                <div className="rounded-lg bg-surface-200 p-3">
                  <p className="text-fg-dim text-xs uppercase tracking-wide">Visitas</p>
                  <p className="font-semibold text-fg mt-1">{plan.includedVisitsPerTerm}</p>
                </div>
                <div className="rounded-lg bg-surface-200 p-3">
                  <p className="text-fg-dim text-xs uppercase tracking-wide">Duración</p>
                  <p className="font-semibold text-fg mt-1">{plan.termMonths} meses</p>
                </div>
              </div>
              {plan.benefits?.length > 0 && (
                <ul className="grid gap-2 text-sm text-fg-muted">
                  {plan.benefits.map((benefit) => (
                    <li key={benefit} className="flex gap-2">
                      <span className="text-green">✓</span>
                      {benefit}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
