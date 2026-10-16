import { SourceLink } from "@/components/source-link";
import Link from "next/link";
import { api, type PortalSessionDTO } from "@/lib/api";
import { formatMoney } from "@ofp/shared";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { SponsorSlot } from "@/components/sponsor-slot";
import { paymentMethodLabel, planStatusLabel } from "@/lib/labels";
import { PayButton } from "./pay-button";

const VIEW_LABELS: Record<string, string> = {
  balance: "Saldo",
  checkout: "Pagar",
  receipts: "Recibos",
  service_plans: "Planes de mantenimiento",
};

function UnavailableCard({ title, message }: { title: string; message: string }) {
  return (
    <main className="min-h-screen bg-surface-100 px-4 py-16 text-fg">
      <Card className="mx-auto max-w-xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">Portal de Construyer</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">{title}</h1>
        <p className="mt-3 text-sm text-fg-muted">{message}</p>
      </Card>
    </main>
  );
}

export default async function PortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { token } = await params;
  const { paid } = await searchParams;

  let session: PortalSessionDTO | null = null;
  let failure: { title: string; message: string } | null = null;
  try {
    session = await api.portalSession(token);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const status = /^4\d\d:/.test(message) ? Number(message.slice(0, 3)) : 0;
    if (status === 410) {
      const body = /revocad|revoked/i.test(message)
        ? "Este enlace fue revocado por Construyer. Comunícate con nosotros para recibir uno nuevo."
        : /desactiv|disabled/i.test(message)
          ? "Construyer desactivó el portal del cliente. Comunícate con nosotros para recibir ayuda."
          : "Este enlace venció. Comunícate con Construyer para recibir uno nuevo.";
      failure = { title: "Este enlace ya no está activo", message: body };
    } else {
      failure = {
        title: "Este enlace no está disponible",
        message: "Verifica que copiaste el enlace completo o pide a Construyer un enlace nuevo. No se mostró información de clientes ni de cobros.",
      };
    }
  }

  if (failure) return <UnavailableCard title={failure.title} message={failure.message} />;
  if (!session) {
    return (
      <UnavailableCard
        title="No se pudo cargar el portal"
        message="Ocurrió un problema al cargar tu portal. Inténtalo de nuevo en unos minutos."
      />
    );
  }

  const { org, customer, views, balance, checkout, receipts, servicePlans } = session;
  const showBalance = views.includes("balance");
  const showCheckout = views.includes("checkout");
  const showReceipts = views.includes("receipts");
  const showPlans = views.includes("service_plans");

  return (
    <main className="min-h-screen bg-surface-100 text-fg">
      <header className="border-b border-border bg-surface-50">
        <div className="mx-auto flex h-16 w-[min(1080px,calc(100%-32px))] items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="ofp-brand-mark h-9 w-9 text-xs">{org.name.slice(0, 2).toUpperCase()}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight">{org.name}</p>
              <p className="text-xs text-fg-muted">Portal del cliente</p>
            </div>
          </div>
          <span className="text-xs text-fg-muted">Ingresaste como {customer.name}</span>
        </div>
      </header>

      <div className="mx-auto w-[min(1080px,calc(100%-32px))] py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-black tracking-tight">Bienvenido(a), {customer.name.split(" ")[0]}</h1>
          <p className="mt-1 max-w-2xl text-sm text-fg-muted">
            Revisa lo que debes, paga tu saldo y consulta tu plan de mantenimiento desde un solo enlace seguro.
          </p>
        </div>

        {paid === "1" ? (
          <div role="status" className="mb-6 rounded-xl border border-green/40 bg-green/10 p-4 text-sm text-green">
            Gracias, recibimos tu pago. Tu recibo está disponible abajo.
          </div>
        ) : null}

        {org.sponsorEnabled ? <SponsorSlot /> : null}

        <nav aria-label="Secciones del portal" className="mb-6 flex flex-wrap gap-2">
          {views.map((view) => (
            <a
              key={view}
              href={`#${view}`}
              className="rounded-lg border border-border bg-surface-50 px-3 py-1.5 text-sm font-medium text-fg-link no-underline hover:bg-surface-200"
            >
              {VIEW_LABELS[view] ?? view}
            </a>
          ))}
        </nav>

        <div className="grid grid-cols-1 gap-6">
          {showBalance ? (
            <Card id="balance">
              <CardHeader>
                <CardTitle>Saldo de factura</CardTitle>
              </CardHeader>
              <CardContent>
                {balance.invoices.length === 0 ? (
                  <p className="py-6 text-center text-sm text-fg-muted">No tienes saldo pendiente. 🎉</p>
                ) : (
                  <div className="grid gap-3">
                    {balance.invoices.map((invoice) => (
                      <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-200 p-4">
                        <div>
                          <p className="text-sm font-semibold">Factura {invoice.number}</p>
                          <p className="text-xs text-fg-muted">
                            {formatMoney(invoice.total)} total · {formatMoney(invoice.paid)} paid
                            {invoice.dueAt ? ` · due ${new Date(invoice.dueAt).toLocaleDateString("es-PE")}` : ""}
                          </p>
                        </div>
                        <p className="text-base font-black">{formatMoney(invoice.remaining)} remaining</p>
                      </div>
                    ))}
                    <p className="text-right text-sm font-semibold">
                      Total pendiente: <span className="text-base font-black">{formatMoney(balance.totalRemaining)}</span>
                    </p>
                  </div>
                )}
                <p className="mt-4 text-xs text-fg-dim">{balance.paymentInstructions}</p>
              </CardContent>
            </Card>
          ) : null}

          {showCheckout ? (
            <Card id="checkout">
              <CardHeader>
                <CardTitle>Pagar</CardTitle>
              </CardHeader>
              <CardContent>
                {balance.invoices.length === 0 ? (
                  <p className="py-6 text-center text-sm text-fg-muted">No tienes pagos pendientes por ahora.</p>
                ) : checkout.available ? (
                  <div className="grid gap-3">
                    {balance.invoices.map((invoice) => (
                      <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-200 p-4">
                        <div>
                          <p className="text-sm font-semibold">Factura {invoice.number}</p>
                          <p className="text-xs text-fg-muted">Paga el saldo pendiente {formatMoney(invoice.remaining)} en línea de forma segura.</p>
                        </div>
                        <PayButton token={token} invoiceId={invoice.id} number={invoice.number} remaining={invoice.remaining} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg bg-surface-200 p-4">
                    <p className="text-sm font-medium">El pago en línea no está habilitado.</p>
                    <p className="mt-1 text-xs text-fg-muted">{balance.paymentInstructions}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          {showReceipts ? (
            <Card id="receipts">
              <CardHeader>
                <CardTitle>Recibos</CardTitle>
              </CardHeader>
              <CardContent>
                {receipts.length === 0 ? (
                  <p className="py-6 text-center text-sm text-fg-muted">Aún no hay facturas pagadas.</p>
                ) : (
                  <div className="grid gap-3">
                    {receipts.map((receipt) => (
                      <div key={receipt.id} className="rounded-lg bg-surface-200 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold">Factura {receipt.number}</p>
                          <p className="text-sm font-black text-green">{formatMoney(receipt.total)} paid</p>
                        </div>
                        <ul className="mt-2 grid gap-1">
                          {receipt.payments.map((payment, index) => (
                            <li key={index} className="flex justify-between text-xs text-fg-muted">
                              <span className="capitalize">{paymentMethodLabel(payment.method)} pago · {new Date(payment.paidAt).toLocaleDateString("es-PE")}</span>
                              <span>{formatMoney(payment.amount)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          {showPlans ? (
            <Card id="service_plans">
              <CardHeader>
                <CardTitle>Planes de mantenimiento</CardTitle>
              </CardHeader>
              <CardContent>
                {servicePlans.length === 0 ? (
                  <p className="py-6 text-center text-sm text-fg-muted">No tienes un plan de mantenimiento activo.</p>
                ) : (
                  <div className="grid gap-3">
                    {servicePlans.map((plan) => (
                      <div key={plan.id} className="rounded-lg bg-surface-200 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{plan.planName}</p>
                          <span className="rounded-full bg-accent-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                            {planStatusLabel(plan.status)}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-fg-muted">
                          {plan.visitsCompleted} of {plan.visitsIncluded} visitas usadas
                          {plan.renewsAt ? ` · renews ${new Date(plan.renewsAt).toLocaleDateString("es-PE")}` : ""}
                        </p>
                        {plan.nextVisit ? (
                          <p className="mt-1 text-xs text-fg-dim">
                            Próxima visita: {plan.nextVisit.title}
                            {plan.nextVisit.dueAt ? ` · ${new Date(plan.nextVisit.dueAt).toLocaleDateString("es-PE")}` : ""}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <footer className="mt-10 border-t border-border pt-4 text-center text-xs text-fg-dim">
          ¿Dudas? Escríbenos: {org.name}
          {org.publicPhone ? ` · ${org.publicPhone}` : ""}
          {org.publicEmail ? ` · ${org.publicEmail}` : ""}.
          <span className="mt-1 block"><SourceLink /></span>
        </footer>
      </div>
    </main>
  );
}
