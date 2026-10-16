import Link from "next/link";
import { serverApi } from "@/lib/server-api";
import { formatMoney } from "@ofp/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { JobStatusBadge } from "@/components/status-badge";
import { SponsorSlot } from "@/components/sponsor-slot";


export default async function TodayPage() {
  const [jobsResult, appointmentsResult, invoicesResult, customersResult] =
    await Promise.allSettled([
      serverApi.jobs(),
      serverApi.appointments(),
      serverApi.invoices(),
      serverApi.customers(),
    ]);

  const jobs = jobsResult.status === "fulfilled" ? jobsResult.value : [];
  const appointments = appointmentsResult.status === "fulfilled" ? appointmentsResult.value : [];
  const invoices = invoicesResult.status === "fulfilled" ? invoicesResult.value : [];
  const customers = customersResult.status === "fulfilled" ? customersResult.value : [];

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const todayAppointments = appointments
    .filter((appointment) => {
      const starts = new Date(appointment.startsAt);
      return starts >= todayStart && starts < tomorrowStart;
    })
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const activeInvoiceJobIds = new Set(
    invoices.filter((invoice) => invoice.status !== "void").map((invoice) => invoice.jobId),
  );
  const unscheduledLeads = jobs.filter((job) => job.status === "lead");
  const inProgress = jobs.filter((job) => job.status === "in_progress");
  const readyToInvoice = jobs.filter(
    (job) => job.status === "completed" && job.total > 0 && !activeInvoiceJobIds.has(job.id),
  );
  const needsPricing = jobs.filter(
    (job) => job.status === "completed" && job.total === 0 && !activeInvoiceJobIds.has(job.id),
  );
  const closeoutAttention = [...inProgress, ...needsPricing, ...readyToInvoice];
  const outstanding = invoices
    .filter((invoice) => invoice.status === "draft" || invoice.status === "sent")
    .reduce((sum, invoice) => sum + invoice.total, 0);
  const completedRevenue = jobs
    .filter((job) => job.status === "completed")
    .reduce((sum, job) => sum + job.total, 0);
  const customerMap = new Map(customers.map((customer) => [customer.id, customer.name]));
  const apiDown = jobsResult.status === "rejected";

  return (
    <div>
      <PageHeader
        title="Hoy"
        description="Gestiona las visitas de hoy, despacha el trabajo pendiente, cierra los trabajos terminados y lleva lo aprobado a cobro."
        actions={
          <div className="flex gap-2">
            <Link href="/jobs/new">
              <Button variant="secondary" size="sm">Nuevo trabajo</Button>
            </Link>
            <Link href="/dispatch">
              <Button size="sm">Abrir despacho</Button>
            </Link>
          </div>
        }
      />

      {apiDown && (
        <Card className="mb-6 border-red/30 bg-red/5">
          <CardContent className="pt-5">
            <p className="text-sm font-semibold text-red">No se puede conectar con la API o la sesión venció</p>
            <p className="mt-1 text-xs text-fg-muted">Vuelve a iniciar sesión o verifica la API y la base de datos antes de usar el panel.</p>
          </CardContent>
        </Card>
      )}

      <SponsorSlot />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ["Visitas de hoy", todayAppointments.length, "text-blue"],
          ["Solicitudes sin programar", unscheduledLeads.length, unscheduledLeads.length ? "text-yellow" : "text-green"],
          ["En curso", inProgress.length, inProgress.length ? "text-yellow" : "text-green"],
          ["Listos para facturar", readyToInvoice.length, readyToInvoice.length ? "text-green" : "text-fg"],
          ["Por cobrar", formatMoney(outstanding), outstanding ? "text-yellow" : "text-green"],
        ].map(([label, value, tone]) => (
          <Card key={String(label)}>
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-dim">{label}</p>
              <p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Ruta de hoy</CardTitle>
              <p className="mt-1 text-xs text-fg-muted">Abre la orden de trabajo y revisa las notas de llegada.</p>
            </div>
            <Link href="/schedule" className="text-xs text-fg-link">Agenda completa →</Link>
          </CardHeader>
          <CardContent>
            {todayAppointments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <p className="font-semibold text-fg">No hay visitas hoy</p>
                <p className="mt-1 text-sm text-fg-muted">Los trabajos sin programar y las visitas de regreso siguen disponibles en el embudo.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayAppointments.map((appointment) => {
                  const job = jobs.find((item) => item.id === appointment.jobId);
                  const starts = new Date(appointment.startsAt);
                  const ends = new Date(appointment.endsAt);
                  return (
                    <div key={appointment.id} className="rounded-xl border border-border bg-surface-200 p-4">
                      <div className="flex items-start gap-4">
                        <div className="min-w-20 rounded-lg bg-surface-100 px-3 py-2 text-center">
                          <p className="text-sm font-bold text-fg">
                            {starts.toLocaleTimeString("es-PE", { hour: "numeric", minute: "2-digit" })}
                          </p>
                          <p className="text-[10px] text-fg-dim">
                            a {ends.toLocaleTimeString("es-PE", { hour: "numeric", minute: "2-digit" })}
                          </p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <Link href={`/jobs/${appointment.jobId}`} className="font-semibold text-fg-link">
                                {job?.title || "Trabajo de servicio"}
                              </Link>
                              {job && <div className="mt-1"><JobStatusBadge status={job.status} /></div>}
                            </div>
                          </div>
                          <p className="mt-3 text-xs text-fg-muted">
                            {job ? customerMap.get(job.customerId) || "Cliente no disponible" : "Detalles de la orden de trabajo no disponibles"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Cierres pendientes</CardTitle>
              <p className="mt-1 text-xs text-fg-muted">Trabajos activos y visitas terminadas que aún necesitan precio o factura.</p>
            </div>
            <Link href="/closeout" className="text-xs text-fg-link">Tablero de cierre →</Link>
          </CardHeader>
          <CardContent>
            {closeoutAttention.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-fg-muted">
                Ningún trabajo requiere cierre.
              </div>
            ) : (
              <div className="space-y-3">
                {closeoutAttention.slice(0, 7).map((job) => {
                  const label = job.status === "in_progress"
                    ? "En curso"
                    : job.total === 0
                      ? "Falta precio"
                      : "Listos para facturar";
                  const tone = job.total === 0 && job.status === "completed"
                    ? "border-red/25 bg-red/5 text-red"
                    : "border-border bg-surface-200 text-fg";
                  return (
                    <Link
                      key={job.id}
                      href="/closeout"
                      className={`block rounded-xl border p-4 no-underline hover:bg-surface-300 ${tone}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{job.title}</p>
                          <p className="mt-1 text-xs text-fg-muted">{customerMap.get(job.customerId) || "Cliente no disponible"}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wide">{label}</p>
                          <p className="mt-1 text-sm font-bold">{formatMoney(job.total)}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Resumen de operaciones</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-fg-muted">Clientes</span><span className="font-semibold text-fg">{customers.length}</span></div>
            <div className="flex justify-between"><span className="text-fg-muted">Ingresos de trabajos terminados</span><span className="font-semibold text-green">{formatMoney(completedRevenue)}</span></div>
            <div className="flex justify-between"><span className="text-fg-muted">Facturas por cobrar</span><span className="font-semibold text-yellow">{formatMoney(outstanding)}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Próxima acción de oficina</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-fg-muted">
              {needsPricing.length
                ? `${needsPricing.length} trabajo${needsPricing.length === 1 ? " terminado necesita" : "s terminados necesitan"} precio antes de facturar.`
                : readyToInvoice.length
                  ? `${readyToInvoice.length} trabajo${readyToInvoice.length === 1 ? " terminado está listo" : "s terminados están listos"} para facturar.`
                  : unscheduledLeads.length
                    ? `${unscheduledLeads.length} solicitud${unscheduledLeads.length === 1 ? " necesita" : "es necesitan"} programarse.`
                    : "No hay pendientes urgentes en la oficina."}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
