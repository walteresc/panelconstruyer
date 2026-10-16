import { SourceLink } from "@/components/source-link";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatMoney } from "@ofp/shared";
import { Card } from "@/components/ui/card";
import { JobStatusBadge } from "@/components/status-badge";
import { SponsorSlot } from "@/components/sponsor-slot";
import { invoiceStatusLabel } from "@/lib/labels";
import { EstimateApprovalForm } from "./estimate-approval-form";

export default async function CustomerPortalPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const portalData = await Promise.all([
    api.customer(customerId),
    api.jobs(),
    api.invoices(),
    api.estimates(),
    api.org(),
  ]).catch(() => null);

  const [customer, jobs, invoices, estimates, org] = portalData ?? [null, [], [], [], null];

  const portalSettings = org?.businessSettings.portal;
  if (!customer || !org || portalSettings?.enabled === false) {
    return (
      <main className="min-h-screen bg-surface-100 px-4 py-16 text-fg">
        <Card className="mx-auto max-w-xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">Portal de Construyer</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight">Este enlace no está disponible</h1>
          <p className="mt-3 text-sm text-fg-muted">
            Pide a Construyer un enlace nuevo. No se mostró información de clientes ni de cobros.
          </p>
        </Card>
      </main>
    );
  }
  const customerJobs = jobs.filter((job) => job.customerId === customerId);
  const customerJobIds = new Set(customerJobs.map((job) => job.id));
  const customerInvoices = invoices.filter((invoice) => customerJobIds.has(invoice.jobId));
  const customerEstimateSummaries = estimates.filter((estimate) => customerJobIds.has(estimate.jobId));
  const customerEstimates = await Promise.all(customerEstimateSummaries.map((estimate) => api.estimate(estimate.id)));
  const pendingEstimates = customerEstimates.filter((estimate) => {
    const active = !estimate.expiresAt || new Date(estimate.expiresAt).getTime() >= Date.now();
    return estimate.status === "sent" && active;
  });
  const openInvoices = customerInvoices.filter((invoice) => invoice.status === "sent" || invoice.status === "draft");
  const paidInvoices = customerInvoices.filter((invoice) => invoice.status === "paid");

  return (
    <main className="min-h-screen bg-surface-100 text-fg">
      <header className="border-b border-border bg-surface-50">
        <div className="mx-auto flex h-16 w-[min(1080px,calc(100%-32px))] items-center justify-between">
          <Link href="/welcome" className="flex items-center gap-3 text-fg no-underline hover:no-underline">
            <span className="ofp-brand-mark h-9 w-9 text-xs">OF</span>
            <span className="font-bold tracking-tight">Portal de Construyer</span>
          </Link>
          <span className="text-xs text-fg-muted">Vista del cliente</span>
        </div>
      </header>

      <div className="mx-auto w-[min(1080px,calc(100%-32px))] py-8">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.22em] text-accent font-bold">Portal del cliente</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-fg">
            {customer?.name ?? "Portal del cliente"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-fg-muted">
            Revisa el historial de servicios, las facturas y las cotizaciones que Construyer compartió contigo.
          </p>
        </div>

        {portalSettings?.showSponsorSlot ? <SponsorSlot /> : null}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card>
            <p className="text-xs uppercase tracking-wide text-fg-dim">Facturas abiertas</p>
            <p className="mt-2 text-3xl font-black text-fg">{openInvoices.length}</p>
            <p className="mt-1 text-sm text-fg-muted">
              {formatMoney(openInvoices.reduce((sum, invoice) => sum + invoice.total, 0))} pendientes de pago
            </p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-fg-dim">Facturas pagadas</p>
            <p className="mt-2 text-3xl font-black text-fg">{paidInvoices.length}</p>
            <p className="mt-1 text-sm text-fg-muted">
              {formatMoney(paidInvoices.reduce((sum, invoice) => sum + invoice.total, 0))} collected
            </p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-fg-dim">Historial de servicios</p>
            <p className="mt-2 text-3xl font-black text-fg">{portalSettings?.allowServiceHistory === false ? "—" : customerJobs.length}</p>
            <p className="mt-1 text-sm text-fg-muted">{portalSettings?.allowServiceHistory === false ? "oculto por la configuración" : "trabajos de este cliente"}</p>
          </Card>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {portalSettings?.allowServiceHistory === false ? null : (
            <Card>
              <h2 className="mb-4 text-base font-semibold text-fg">Servicios recientes</h2>
              {customerJobs.length === 0 ? (
                <p className="py-8 text-center text-sm text-fg-muted">Aún no hay historial de servicios.</p>
              ) : (
                <div className="grid gap-2">
                  {customerJobs.slice(0, 6).map((job) => (
                    <div key={job.id} className="flex items-center justify-between rounded-lg bg-surface-200 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-fg">{job.title}</p>
                        <p className="text-xs text-fg-muted">{new Date(job.createdAt).toLocaleDateString("es-PE")}</p>
                      </div>
                      <JobStatusBadge status={job.status} />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          <Card>
            <h2 className="mb-4 text-base font-semibold text-fg">Facturas</h2>
            {customerInvoices.length === 0 ? (
              <p className="py-8 text-center text-sm text-fg-muted">Aún no hay facturas.</p>
            ) : (
              <div className="grid gap-2">
                {customerInvoices.slice(0, 6).map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between rounded-lg bg-surface-200 p-3">
                    <div>
                      <p className="text-sm font-medium text-fg">Factura {invoice.number}</p>
                      <p className="text-xs capitalize text-fg-muted">{invoiceStatusLabel(invoice.status)}</p>
                    </div>
                    <p className="text-sm font-semibold text-fg">{formatMoney(invoice.total)}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {portalSettings?.allowEstimateApproval ? (
          <Card className="mt-6">
            <h2 className="mb-4 text-base font-semibold text-fg">Cotizaciones por aprobar</h2>
            {pendingEstimates.length === 0 ? (
              <p className="py-8 text-center text-sm text-fg-muted">No hay cotizaciones por aprobar.</p>
            ) : (
              <div className="grid gap-3">
                {pendingEstimates.map((estimate) => {
                  const job = customerJobs.find((row) => row.id === estimate.jobId);
                  return (
                    <div key={estimate.id} className="grid gap-3 rounded-lg bg-surface-200 p-4 md:grid-cols-[1fr_auto] md:items-center">
                      <div>
                        <p className="text-sm font-semibold text-fg">Cotización {estimate.number}</p>
                        <p className="text-xs text-fg-muted">{job?.title ?? "Trabajo de servicio"}</p>
                        {estimate.expiresAt ? (
                          <p className="mt-1 text-xs text-fg-dim">Vence {new Date(estimate.expiresAt).toLocaleDateString("es-PE")}</p>
                        ) : null}
                        <div className="mt-3 grid gap-2">
                          {estimate.options.map((option) => (
                            <div key={option.id} className="rounded-lg border border-border bg-surface-100 p-3">
                              <div className="flex justify-between gap-3 text-sm"><strong>{option.label}</strong><strong>{formatMoney(option.total)}</strong></div>
                              <ul className="mt-2 grid gap-1 text-xs text-fg-muted">
                                {option.lineItems.map((line) => <li key={line.id}>{line.quantity} × {line.description}</li>)}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                      <EstimateApprovalForm
                        estimateId={estimate.id}
                        options={estimate.options.map((option) => ({ id: option.id, label: option.label, total: option.total }))}
                        customerName={customer?.name ?? undefined}
                        signatureRequired={org.businessSettings.estimate.signatureRequired}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        ) : null}

        <p className="mt-8 text-center"><SourceLink /></p>
      </div>
    </main>
  );
}
