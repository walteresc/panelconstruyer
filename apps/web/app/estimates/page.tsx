"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatMoney } from "@ofp/shared";
import type { JobDTO, CustomerDTO } from "@ofp/shared";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { estimateStatusLabel } from "@/lib/labels";
import { Table, TableHeader, TableHead, TableBody, TableRow } from "@/components/ui/table";

interface Estimate {
  id: string;
  orgId: string;
  jobId: string;
  number: string;
  total: number;
  accepted: boolean;
  expiresAt?: string | null;
  acceptedAt?: string | null;
  acceptedByName?: string | null;
  status: "draft" | "sent" | "approved" | "declined" | "expired";
  createdAt: string;
}

type StatusFilter = "all" | "pending" | "accepted";
type SortField = "job" | "total" | "status" | "date";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "pending", label: "Pendientes" },
  { value: "accepted", label: "Aceptadas" },
];

function SortHead({
  field,
  label,
  sort,
  dir,
  onSort,
  className,
}: {
  field: SortField;
  label: string;
  sort: SortField;
  dir: "asc" | "desc";
  onSort: (f: SortField) => void;
  className?: string;
}) {
  const active = sort === field;
  return (
    <TableHead
      onClick={() => onSort(field)}
      className={`cursor-pointer select-none hover:text-fg transition-colors ${className ?? ""}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="text-[10px] w-3 text-center">
          {active ? (dir === "asc" ? "↑" : "↓") : ""}
        </span>
      </span>
    </TableHead>
  );
}

export default function EstimatesPage() {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [jobs, setJobs] = useState<JobDTO[]>([]);
  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortField>("date");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // ── Create estimate modal ──
  const [showCreate, setShowCreate] = useState(false);
  const [createJobId, setCreateJobId] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Jobs that don't already have an estimate
  const estimatedJobIds = useMemo(() => new Set(estimates.map((e) => e.jobId)), [estimates]);
  const unestimatedJobs = useMemo(
    () => jobs.filter((j) => !estimatedJobIds.has(j.id) && j.status !== "canceled"),
    [jobs, estimatedJobIds],
  );

  const handleCreateEstimate = async () => {
    if (!createJobId) return;
    setCreateSubmitting(true);
    setCreateError(null);
    try {
      const est = await api.createEstimate({ jobId: createJobId });
      setEstimates((prev) => [est, ...prev]);
      setShowCreate(false);
      setCreateJobId("");
    } catch (e) {
      setCreateError(String(e));
    } finally {
      setCreateSubmitting(false);
    }
  };

  const openCreate = () => {
    setCreateJobId("");
    setCreateError(null);
    setShowCreate(true);
  };

  // Escape key handler for create modal
  useEffect(() => {
    if (!showCreate) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowCreate(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showCreate]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [est, jb, cust] = await Promise.all([
          api.estimates(),
          api.jobs(),
          api.customers(),
        ]);
        if (!cancelled) {
          setEstimates(est);
          setJobs(jb);
          setCustomers(cust);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const jobMap = useMemo(() => {
    const m = new Map<string, JobDTO>();
    for (const j of jobs) m.set(j.id, j);
    return m;
  }, [jobs]);

  const customerMap = useMemo(() => {
    const m = new Map<string, CustomerDTO>();
    for (const c of customers) m.set(c.id, c);
    return m;
  }, [customers]);

  const handleSort = (field: SortField) => {
    if (sort === field) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(field);
      setDir("desc");
    }
  };

  const filteredSorted = useMemo(() => {
    let list = [...estimates];

    // Status filter
    if (statusFilter === "pending") list = list.filter((e) => e.status === "draft" || e.status === "sent");
    if (statusFilter === "accepted") list = list.filter((e) => e.status === "approved");

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) => {
        const job = jobMap.get(e.jobId);
        const jobTitle = job?.title?.toLowerCase() ?? "";
        const custName = (job ? customerMap.get(job.customerId)?.name : "")?.toLowerCase() ?? "";
        return jobTitle.includes(q) || custName.includes(q);
      });
    }

    // Sort
    list.sort((a, b) => {
      const mult = dir === "asc" ? 1 : -1;
      switch (sort) {
        case "job": {
          const tA = jobMap.get(a.jobId)?.title ?? "";
          const tB = jobMap.get(b.jobId)?.title ?? "";
          return mult * tA.localeCompare(tB);
        }
        case "total":
          return mult * (a.total - b.total);
        case "status":
          return mult * (Number(a.accepted) - Number(b.accepted));
        case "date":
        default:
          return mult * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      }
    });

    return list;
  }, [estimates, search, sort, dir, statusFilter, jobMap, customerMap]);

  if (loading) {
    return (
      <div>
        <div className="flex items-end justify-between mb-8">
          <div>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-44" />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <Skeleton className="h-10 w-80 rounded-lg" />
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
        <div className="hidden md:block">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl mb-2" />
          ))}
        </div>
        <div className="md:hidden flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Cotizaciones"
        description={`${estimates.length} cotizaci${estimates.length !== 1 ? "ones" : "ón"} · ${estimates.filter((e) => e.accepted).length} aceptada${estimates.filter((e) => e.accepted).length !== 1 ? "s" : ""}`}
        actions={
          <Button onClick={openCreate} size="sm">
            ⊕ Crear cotización
          </Button>
        }
      />

      {/* ── Create Estimate modal ── */}
      {showCreate && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCreate(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
              <form
                onSubmit={(e) => { e.preventDefault(); handleCreateEstimate(); }}
                className="p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-fg">Crear cotización</h3>
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="text-fg-muted hover:text-fg transition-colors cursor-pointer bg-transparent border-none text-lg leading-none"
                  >
                    ✕
                  </button>
                </div>

                {createError && (
                  <p className="text-red text-xs mb-3 p-2 rounded bg-red/5">{createError}</p>
                )}

                <p className="text-xs text-fg-muted mb-3">
                  Genera una cotización con el total actual del trabajo.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-fg-muted mb-1.5">
                    Trabajo *
                  </label>
                  <select
                    value={createJobId}
                    onChange={(e) => setCreateJobId(e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-surface-200 px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer"
                  >
                    <option value="">Selecciona un trabajo...</option>
                    {unestimatedJobs.map((j) => {
                      const cust = customerMap.get(j.customerId);
                      return (
                        <option key={j.id} value={j.id}>
                          {j.title}{cust ? ` — ${cust.name}` : ""} · {formatMoney(j.total)}
                        </option>
                      );
                    })}
                  </select>
                  {unestimatedJobs.length === 0 && (
                    <p className="text-xs text-fg-dim mt-1">Todos los trabajos ya tienen cotización.</p>
                  )}
                </div>

                <div className="flex gap-2 mt-6">
                  <Button type="submit" disabled={!createJobId || createSubmitting}>
                    {createSubmitting ? "Creando..." : "Crear cotización"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </>
      )}

      {error && (
        <Card className="mb-6 border-red/30 bg-red/5">
          <p className="text-red text-sm">No se puede conectar con la API ({error}).</p>
        </Card>
      )}

      {estimates.length === 0 && !error ? (
        <Card>
          <EmptyState
            title="Aún no hay cotizaciones"
            description="Crea una cotización desde un trabajo para enviarla a tu cliente."
          />
        </Card>
      ) : (
        <>
          {/* Search + filter */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <Input
              type="search"
              placeholder="Buscar por título del trabajo o cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs flex-1"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="h-10 rounded-lg border border-border bg-surface-200 px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-3 py-2 text-left text-xs font-semibold text-fg-dim uppercase tracking-wider">
                    Cotización
                  </TableHead>
                  <SortHead field="job" label="Trabajo" sort={sort} dir={dir} onSort={handleSort} />
                  <TableHead className="px-3 py-2 text-left text-xs font-semibold text-fg-dim uppercase tracking-wider">
                    Cliente
                  </TableHead>
                  <SortHead field="total" label="Total" sort={sort} dir={dir} onSort={handleSort} className="text-right" />
                  <SortHead field="status" label="Estado" sort={sort} dir={dir} onSort={handleSort} />
                  <SortHead field="date" label="Creada" sort={sort} dir={dir} onSort={handleSort} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSorted.length === 0 ? (
                  <TableRow>
                    <td colSpan={6} className="text-center py-10">
                      <p className="text-sm text-fg-muted">Ninguna cotización coincide con los filtros</p>
                      <button
                        onClick={() => { setSearch(""); setStatusFilter("all"); }}
                        className="text-xs text-fg-link hover:text-fg mt-1 cursor-pointer bg-transparent border-none"
                      >
                        Limpiar filtros
                      </button>
                    </td>
                  </TableRow>
                ) : (
                  filteredSorted.map((e) => {
                    const job = jobMap.get(e.jobId);
                    const cust = job ? customerMap.get(job.customerId) : null;
                    const expired = e.expiresAt ? new Date(e.expiresAt).getTime() < Date.now() : false;
                    return (
                      <TableRow key={e.id}>
                        <td className="px-3 py-3">
                          <Link href={`/estimates/${e.id}`} className="text-sm font-medium text-fg-link hover:text-fg transition-colors no-underline">
                            {e.number}
                          </Link>
                          {e.expiresAt ? <p className="text-[11px] text-fg-dim">Vence {new Date(e.expiresAt).toLocaleDateString("es-PE")}</p> : null}
                        </td>
                        <td className="px-3 py-3">
                          <Link
                            href={`/jobs/${e.jobId}`}
                            className="text-sm font-medium text-fg-link hover:text-fg transition-colors no-underline"
                          >
                            {job?.title ?? e.jobId.slice(0, 8)}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-sm text-fg-muted">
                          {cust?.name ?? "—"}
                        </td>
                        <td className="px-3 py-3 text-sm text-fg text-right font-mono tabular-nums">
                          {formatMoney(e.total)}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                              e.accepted
                                ? "bg-green/15 text-green"
                                : expired
                                  ? "bg-red/15 text-red"
                                : "bg-yellow/15 text-yellow"
                            }`}
                          >
                            {e.status === "approved" ? "Aprobada" : expired ? "Vencido" : estimateStatusLabel(e.status)}
                          </span>
                          {e.acceptedByName ? <p className="mt-1 text-[11px] text-fg-dim">by {e.acceptedByName}</p> : null}
                        </td>
                        <td className="px-3 py-3 text-sm text-fg-muted">
                          {new Date(e.createdAt).toLocaleDateString("es-PE")}
                        </td>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden flex flex-col gap-3">
            {filteredSorted.length === 0 ? (
              <Card>
                <div className="text-center py-10">
                  <p className="text-sm text-fg-muted">Ninguna cotización coincide con los filtros</p>
                  <button
                    onClick={() => { setSearch(""); setStatusFilter("all"); }}
                    className="text-xs text-fg-link hover:text-fg mt-1 cursor-pointer bg-transparent border-none"
                  >
                    Limpiar filtros
                  </button>
                </div>
              </Card>
            ) : (
              filteredSorted.map((e) => {
                const job = jobMap.get(e.jobId);
                const cust = job ? customerMap.get(job.customerId) : null;
                const expired = e.expiresAt ? new Date(e.expiresAt).getTime() < Date.now() : false;
                return (
                  <Link
                    key={e.id}
                    href={`/jobs/${e.jobId}`}
                    className="block no-underline"
                  >
                    <Card className="hover:bg-surface-300 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-fg truncate">
                            {e.number} · {job?.title ?? e.jobId.slice(0, 8)}
                          </p>
                          {cust && (
                            <p className="text-xs text-fg-muted mt-0.5">{cust.name}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              e.accepted
                                ? "bg-green/15 text-green"
                                : expired
                                  ? "bg-red/15 text-red"
                                  : "bg-yellow/15 text-yellow"
                            }`}
                          >
                              {e.status === "approved" ? "Aprobada" : expired ? "Vencido" : estimateStatusLabel(e.status)}
                            </span>
                            <span className="text-xs text-fg-dim">
                              {new Date(e.createdAt).toLocaleDateString("es-PE")}
                            </span>
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-fg font-mono tabular-nums shrink-0">
                          {formatMoney(e.total)}
                        </span>
                      </div>
                    </Card>
                  </Link>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
