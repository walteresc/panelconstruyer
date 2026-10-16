"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, type InvoiceDetail, type InvoiceLineItem, type OrgSettingsDTO } from "@/lib/api";
import { formatMoney } from "@ofp/shared";
import type { JobDTO, CustomerDTO } from "@ofp/shared";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { InvoiceStatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSendDialog } from "@/components/message-send-dialog";

interface Payment {
  id: string;
  orgId: string;
  invoiceId: string;
  amount: number;
  method: string;
  reference?: string | null;
  paidAt: string;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  manual: "Manual",
  card: "Tarjeta",
  cash: "Efectivo",
  check: "Cheque",
};

export default function InvoiceDetailPage() {
  const params = useParams();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [jobs, setJobs] = useState<JobDTO[]>([]);
  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [orgSettings, setOrgSettings] = useState<OrgSettingsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  // ── Action states ──
  const [actionError, setActionError] = useState<string | null>(null);
  const [submittingStatus, setSubmittingStatus] = useState<string | null>(null);

  // ── Confirm dialog ──
  const [confirmAction, setConfirmAction] = useState<"sent" | "paid" | "void" | null>(null);

  // ── Email send workflow ──
  const [emailOpen, setEmailOpen] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // ── Payment modal ──
  const [showPayment, setShowPayment] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("manual");
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // ── Line item editor (draft only) ──
  const [lineModal, setLineModal] = useState<{ mode: "add" } | { mode: "edit"; lineId: string } | null>(null);
  const [lineDescription, setLineDescription] = useState("");
  const [lineQuantity, setLineQuantity] = useState("1");
  const [linePrice, setLinePrice] = useState("");
  const [lineSubmitting, setLineSubmitting] = useState(false);
  const [lineError, setLineError] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── Escape key handler for dialogs ──
  useEffect(() => {
    if (!confirmAction && !showPayment && !lineModal && !emailOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setConfirmAction(null);
        setShowPayment(false);
        setLineModal(null);
        setEmailOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [confirmAction, showPayment, lineModal, emailOpen]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [inv, jb, cust, org] = await Promise.all([
          api.invoice(invoiceId),
          api.jobs().catch(() => [] as JobDTO[]),
          api.customers().catch(() => [] as CustomerDTO[]),
          api.org().catch(() => null as OrgSettingsDTO | null),
        ]);
        if (!cancelled) {
          setInvoice(inv);
          setJobs(jb);
          setCustomers(cust);
          setOrgSettings(org);
        }
      } catch {
        if (!cancelled) setLoadFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [invoiceId]);

  const job = useMemo(
    () => (invoice ? jobs.find((j) => j.id === invoice.jobId) : null),
    [invoice, jobs],
  );
  const customer = useMemo(
    () => (job ? customers.find((c) => c.id === job.customerId) : null),
    [job, customers],
  );

  const totalPaid = invoice
    ? invoice.payments.reduce((sum, p) => sum + p.amount, 0)
    : 0;
  const remaining = invoice ? invoice.total - totalPaid : 0;

  const paymentSettings = orgSettings?.businessSettings?.payments;
  const allowPartialPayments = paymentSettings?.allowPartialPayments !== false;
  const acceptedPaymentMethods = useMemo(() => {
    const methods: { value: string; label: string }[] = [{ value: "manual", label: "Manual" }];
    if (paymentSettings?.allowManualCash !== false) methods.push({ value: "cash", label: "Efectivo" });
    if (paymentSettings?.allowManualCheck !== false) methods.push({ value: "check", label: "Check" });
    if (paymentSettings?.allowManualCard !== false) methods.push({ value: "card", label: "Tarjeta" });
    return methods;
  }, [paymentSettings]);

  // ── Status actions ──
  async function downloadPdf() {
    setDownloadingPdf(true);
    setActionError(null);
    try {
      const { blob, filename } = await api.invoicePdf(invoiceId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "No se pudo descargar el PDF");
    } finally {
      setDownloadingPdf(false);
    }
  }

  const handleStatusChange = async (status: "sent" | "void") => {
    if (!invoice) return;
    setSubmittingStatus(status);
    setActionError(null);
    try {
      const result = await api.updateInvoiceStatus(invoice.id, status);
      setInvoice((prev) => prev ? { ...prev, status: result.status as InvoiceDetail["status"] } : prev);
      setConfirmAction(null);
    } catch (e) {
      setActionError(String(e));
    } finally {
      setSubmittingStatus(null);
    }
  };

  const handleMarkPaid = async () => {
    if (!invoice || remaining <= 0) return;
    setSubmittingStatus("paid");
    setActionError(null);
    try {
      await api.recordPayment(invoice.id, {
        amount: remaining,
        method: "manual",
      });
      const refreshed = await api.invoice(invoiceId);
      setInvoice(refreshed);
      setConfirmAction(null);
    } catch (e) {
      setActionError(String(e));
    } finally {
      setSubmittingStatus(null);
    }
  };

  // ── Record payment ──
  const openPayment = () => {
    setPayAmount(String(Math.max(0, remaining / 100)));
    setPayMethod("manual");
    setPayError(null);
    setShowPayment(true);
  };

  const handleRecordPayment = async () => {
    if (!invoice) return;
    const cents = Math.round(parseFloat(payAmount || "0") * 100);
    if (cents <= 0) return;
    if (cents > remaining) {
      setPayError(`El monto no puede superar el saldo pendiente de ${formatMoney(remaining)}.`);
      return;
    }
    setPaySubmitting(true);
    setPayError(null);
    try {
      await api.recordPayment(invoice.id, {
        amount: cents,
        method: payMethod,
      });
      // Refresh full invoice to get updated payments list
      const refreshed = await api.invoice(invoiceId);
      setInvoice(refreshed);
      setShowPayment(false);
      setPayAmount("");
    } catch (e) {
      setPayError(String(e));
    } finally {
      setPaySubmitting(false);
    }
  };

  // ── Line item editing (draft only) ──
  const openAddLine = () => {
    setLineDescription("");
    setLineQuantity("1");
    setLinePrice("");
    setLineError(null);
    setLineModal({ mode: "add" });
  };

  const openEditLine = (item: InvoiceLineItem) => {
    setLineDescription(item.description);
    setLineQuantity(String(item.quantity));
    setLinePrice((item.unitPrice / 100).toFixed(2));
    setLineError(null);
    setLineModal({ mode: "edit", lineId: item.id });
  };

  const handleSaveLine = async () => {
    if (!invoice || !lineModal) return;
    const description = lineDescription.trim();
    const quantity = Math.floor(Number(lineQuantity));
    const cents = Math.round(parseFloat(linePrice || "0") * 100);
    if (!description) {
      setLineError("La descripción es obligatoria.");
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      setLineError("La cantidad debe ser un número entero de al menos 1.");
      return;
    }
    if (!Number.isFinite(cents) || cents < 0) {
      setLineError("El precio unitario debe ser cero o mayor.");
      return;
    }
    setLineSubmitting(true);
    setLineError(null);
    try {
      if (lineModal.mode === "edit") {
        await api.updateInvoiceLine(invoice.id, lineModal.lineId, { description, quantity, unitPrice: cents });
      } else {
        await api.addInvoiceLine(invoice.id, { description, quantity, unitPrice: cents });
      }
      const refreshed = await api.invoice(invoiceId);
      setInvoice(refreshed);
      setLineModal(null);
    } catch (e) {
      setLineError(String(e));
    } finally {
      setLineSubmitting(false);
    }
  };

  const handleDeleteLine = async (lineId: string) => {
    if (!invoice) return;
    setDeleteError(null);
    try {
      await api.deleteInvoiceLine(invoice.id, lineId);
      setConfirmingDeleteId(null);
      const refreshed = await api.invoice(invoiceId);
      setInvoice(refreshed);
    } catch (e) {
      setDeleteError(String(e));
      setConfirmingDeleteId(null);
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <div>
        <div className="flex items-end justify-between mb-8">
          <div>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="flex flex-col gap-6">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
          <div className="flex flex-col gap-6">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Confirm dialog backdrop + modal */}
      {confirmAction && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirmAction(null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-sm">
              <div className="p-6">
                <h3 className="text-base font-semibold text-fg mb-2">
                  {confirmAction === "sent" ? "¿Marcar como enviada?" : confirmAction === "paid" ? "¿Marcar como pagada?" : "¿Anular esta factura?"}
                </h3>
                <p className="text-sm text-fg-muted mb-4">
                  {confirmAction === "sent"
                    ? `Se marcará la factura ${invoice?.number} como enviada al cliente.`
                    : confirmAction === "paid"
                    ? `Se registrará un pago de ${formatMoney(Math.max(0, remaining))} en la factura ${invoice?.number} y se marcará como pagada.`
                    : `Se anulará la factura ${invoice?.number}. Esta acción no se puede deshacer.`}
                </p>
                {actionError && (
                  <p className="text-red text-xs mb-3 p-2 rounded bg-red/5">{actionError}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    onClick={() => confirmAction === "paid" ? handleMarkPaid() : handleStatusChange(confirmAction as "sent" | "void")}
                    disabled={submittingStatus !== null}
                    variant={confirmAction === "void" ? "danger" : "default"}
                  >
                    {submittingStatus === confirmAction
                      ? (confirmAction === "void" ? "Anulando..." : confirmAction === "paid" ? "Registrando pago..." : "Enviando...")
                      : (confirmAction === "void" ? "Sí, anular" : confirmAction === "paid" ? "Sí, registrar pago" : "Sí, marcar como enviada")}
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmAction(null)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* Payment modal */}
      {showPayment && invoice && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowPayment(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-sm">
              <form
                onSubmit={(e) => { e.preventDefault(); handleRecordPayment(); }}
                className="p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-fg">Registrar pago</h3>
                  <button
                    type="button"
                    onClick={() => setShowPayment(false)}
                    className="text-fg-muted hover:text-fg transition-colors cursor-pointer bg-transparent border-none text-lg leading-none"
                  >
                    ✕
                  </button>
                </div>

                {payError && (
                  <p className="text-red text-xs mb-3 p-2 rounded bg-red/5">{payError}</p>
                )}

                <p className="text-xs text-fg-muted mb-3">
                  Factura {invoice.number} · {formatMoney(invoice.total)} total · {formatMoney(Math.max(0, remaining))} remaining
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-fg-muted mb-1.5">
                      Monto (S/) *
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={allowPartialPayments ? remaining / 100 : undefined}
                      required
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      disabled={!allowPartialPayments}
                      autoFocus
                    />
                    {!allowPartialPayments && (
                      <p className="text-xs text-fg-muted mt-1.5">
                        Los pagos parciales están desactivados: se debe pagar el saldo completo.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-fg-muted mb-1.5">
                      Método
                    </label>
                    <select
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value)}
                      className="h-10 w-full rounded-lg border border-border bg-surface-200 px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer"
                    >
                      {acceptedPaymentMethods.map((method) => (
                        <option key={method.value} value={method.value}>
                          {method.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 mt-6">
                  <Button type="submit" disabled={paySubmitting || !payAmount}>
                    {paySubmitting ? "Registrando..." : "Registrar pago"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setShowPayment(false)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </>
      )}

      {/* Line item editor modal */}
      {lineModal && invoice && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setLineModal(null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-sm">
              <form
                onSubmit={(e) => { e.preventDefault(); handleSaveLine(); }}
                className="p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-fg">
                    {lineModal.mode === "edit" ? "Editar concepto" : "Agregar concepto"}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setLineModal(null)}
                    className="text-fg-muted hover:text-fg transition-colors cursor-pointer bg-transparent border-none text-lg leading-none"
                  >
                    ✕
                  </button>
                </div>

                {lineError && (
                  <p className="text-red text-xs mb-3 p-2 rounded bg-red/5">{lineError}</p>
                )}

                <div className="space-y-4">
                  <div>
                    <label htmlFor="line-description" className="block text-xs font-semibold text-fg-muted mb-1.5">
                      Descripción *
                    </label>
                    <Input
                      id="line-description"
                      value={lineDescription}
                      onChange={(e) => setLineDescription(e.target.value)}
                      maxLength={500}
                      autoFocus
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="line-quantity" className="block text-xs font-semibold text-fg-muted mb-1.5">
                        Cantidad *
                      </label>
                      <Input
                        id="line-quantity"
                        type="number"
                        min={1}
                        step={1}
                        value={lineQuantity}
                        onChange={(e) => setLineQuantity(e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="line-price" className="block text-xs font-semibold text-fg-muted mb-1.5">
                        Precio unitario (S/) *
                      </label>
                      <Input
                        id="line-price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={linePrice}
                        onChange={(e) => setLinePrice(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-fg-muted">
                    Subtotal: {formatMoney(
                      Math.round(parseFloat(linePrice || "0") * 100) * (Math.max(0, Math.floor(Number(lineQuantity)) || 0)),
                    )}
                  </p>
                </div>

                <div className="flex gap-2 mt-6">
                  <Button type="submit" disabled={lineSubmitting || !lineDescription.trim() || !linePrice}>
                    {lineSubmitting ? "Guardando..." : lineModal.mode === "edit" ? "Guardar cambios" : "Agregar concepto"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setLineModal(null)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </>
      )}

      {/* ── Header ── */}
      {loadFailed ? (
        <PageHeader title="No se pudo cargar la factura" description={`ID: ${invoiceId}`} />
      ) : !invoice ? (
        <PageHeader title="Factura no encontrada" description={`No existe una factura con id ${invoiceId}.`} />
      ) : (
        <PageHeader
          title={invoice.number}
          description={
            <span className="inline-flex items-center gap-2">
              <InvoiceStatusBadge status={invoice.status} />
              {job && (
                <>
                  <span className="text-fg-dim">·</span>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="text-fg-link hover:text-fg transition-colors"
                  >
                    {job.title}
                  </Link>
                </>
              )}
              {customer && (
                <>
                  <span className="text-fg-dim">·</span>
                  <Link
                    href={`/customers/${customer.id}`}
                    className="text-fg-muted hover:text-fg transition-colors"
                  >
                    {customer.name}
                  </Link>
                </>
              )}
            </span>
          }
          actions={
            <div className="flex gap-2 flex-wrap">
              {(invoice.status === "draft" || invoice.status === "sent" || invoice.status === "paid") && (
                <Button size="sm" variant="secondary" disabled={downloadingPdf} onClick={() => void downloadPdf()}>
                  {downloadingPdf ? "Preparando…" : "Descargar PDF"}
                </Button>
              )}
              {(invoice.status === "draft" || invoice.status === "sent" || invoice.status === "paid") && (
                <Button size="sm" variant="secondary" onClick={() => setEmailOpen(true)}>
                  Enviar factura por correo
                </Button>
              )}
              {invoice.status === "draft" && (
                <Button size="sm" onClick={() => setConfirmAction("sent")}>
                  Marcar como enviada
                </Button>
              )}
              {(invoice.status === "draft" || invoice.status === "sent") && (
                <Button size="sm" variant="danger" onClick={() => setConfirmAction("void")}>
                  Anulada
                </Button>
              )}
              {(invoice.status === "draft" || invoice.status === "sent") && remaining > 0 && (
                <Button size="sm" onClick={() => setConfirmAction("paid")}>
                  Marcar como pagada
                </Button>
              )}
              {(invoice.status === "draft" || invoice.status === "sent" || (invoice.status === "paid" && remaining > 0)) && (
                <Button size="sm" variant="secondary" onClick={openPayment}>
                  Registrar pago
                </Button>
              )}
              {job && (
                <Link href={`/jobs/${job.id}`}>
                  <Button variant="secondary" size="sm">Ver trabajo</Button>
                </Link>
              )}
            </div>
          }
        />
      )}

      {!invoice ? (
        <Card>
          <EmptyState
            title="Sin datos de la factura"
            description="Verifica el identificador de la factura o la conexión con la API"
          />
        </Card>
      ) : (
        <>
          {/* Status action bar */}
          {actionError && !confirmAction && (
            <Card className="mb-4 border-red/30 bg-red/5">
              <div className="flex items-center justify-between p-3">
                <p className="text-red text-sm">{actionError}</p>
                <button
                  onClick={() => setActionError(null)}
                  className="text-fg-muted hover:text-fg cursor-pointer bg-transparent border-none"
                >
                  ✕
                </button>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left column */}
            <div className="flex flex-col gap-6">
              {/* Invoice details */}
              <Card>
                <CardHeader>
                  <CardTitle>Detalles de la factura</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-fg-muted">Estado</span>
                      <InvoiceStatusBadge status={invoice.status} />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-fg-muted">Subtotal</span>
                      <span className="text-sm text-fg tabular-nums">
                        {formatMoney(invoice.pricing?.subtotal ?? invoice.total)}
                      </span>
                    </div>
                    {invoice.pricing && invoice.pricing.discount > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-fg-muted">{invoice.pricing.discountLabel || "Descuento"}</span>
                        <span className="text-sm text-fg tabular-nums">-{formatMoney(invoice.pricing.discount)}</span>
                      </div>
                    )}
                    {invoice.pricing && invoice.pricing.tax > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-fg-muted">{invoice.pricing.taxLabel || "Impuesto"}</span>
                        <span className="text-sm text-fg tabular-nums">{formatMoney(invoice.pricing.tax)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-fg-muted">Total</span>
                      <span className="text-sm font-bold text-fg tabular-nums">
                        {formatMoney(invoice.total)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-fg-muted">Pagada</span>
                      <span className="text-sm font-semibold text-green tabular-nums">
                        {formatMoney(totalPaid)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-fg-muted">Pendiente</span>
                      <span
                        className={`text-sm font-semibold tabular-nums ${
                          remaining <= 0 ? "text-green" : "text-yellow"
                        }`}
                      >
                        {formatMoney(Math.max(0, remaining))}
                      </span>
                    </div>
                    {invoice.dueAt && (
                      <div className="flex justify-between items-center pt-3 border-t border-border">
                        <span className="text-xs text-fg-muted">Vencimiento</span>
                        <span className="text-sm text-fg">
                          {new Date(invoice.dueAt).toLocaleDateString("es-PE", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    )}
                    {invoice.createdAt && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-fg-muted">Creada</span>
                        <span className="text-sm text-fg">
                          {new Date(invoice.createdAt).toLocaleDateString("es-PE", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Job & customer links */}
              {(job || customer) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Relacionado</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {job && (
                        <div>
                          <p className="text-xs text-fg-muted mb-1">Trabajo</p>
                          <Link
                            href={`/jobs/${job.id}`}
                            className="text-sm font-medium text-fg-link hover:text-fg transition-colors"
                          >
                            {job.title}
                          </Link>
                        </div>
                      )}
                      {customer && (
                        <div className="pt-2 border-t border-border">
                          <p className="text-xs text-fg-muted mb-1">Cliente</p>
                          <Link
                            href={`/customers/${customer.id}`}
                            className="text-sm font-medium text-fg-link hover:text-fg transition-colors"
                          >
                            {customer.name}
                          </Link>
                          {customer.email && (
                            <p className="text-xs text-fg-dim mt-1">{customer.email}</p>
                          )}
                          {customer.phone && (
                            <p className="text-xs text-fg-dim">{customer.phone}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right column */}
            <div className="flex flex-col gap-6">
              {/* Line items */}
              <Card>
                <CardHeader>
                  <CardTitle>Conceptos</CardTitle>
                  <CardDescription>
                    {invoice.lineItems.length === 0
                      ? "Sin conceptos"
                      : `${invoice.lineItems.length} item${invoice.lineItems.length !== 1 ? "s" : ""}`}
                    {invoice.status === "draft" ? "· Editable mientras es borrador" : "· Se bloquea al enviarla"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {deleteError && (
                    <p className="text-red text-xs mb-3 p-2 rounded bg-red/5">{deleteError}</p>
                  )}
                  {invoice.lineItems.length === 0 ? (
                    <div className="py-4 text-center">
                      <p className="text-sm text-fg-muted">
                        {invoice.status === "draft"
                          ? "Aún no hay conceptos: agrégalos antes de enviar."
                          : "Esta factura no tiene conceptos."}
                      </p>
                      {invoice.status === "draft" && (
                        <Button size="sm" variant="secondary" className="mt-3" onClick={openAddLine}>
                          Agregar concepto
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {invoice.lineItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-200"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-fg truncate">{item.description}</p>
                            <p className="text-xs text-fg-dim mt-0.5">
                              {item.quantity} × {formatMoney(item.unitPrice)}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-fg tabular-nums shrink-0 ml-3">
                            {formatMoney(item.quantity * item.unitPrice)}
                          </span>
                          {invoice.status === "draft" && (
                            <span className="flex items-center gap-1 ml-3 shrink-0">
                              {confirmingDeleteId === item.id ? (
                                <>
                                  <Button size="sm" variant="danger" onClick={() => handleDeleteLine(item.id)}>
                                    Eliminar
                                  </Button>
                                  <Button size="sm" variant="secondary" onClick={() => setConfirmingDeleteId(null)}>
                                    Conservar
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button size="sm" variant="secondary" onClick={() => openEditLine(item)}>
                                    Editar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="danger"
                                    onClick={() => { setDeleteError(null); setConfirmingDeleteId(item.id); }}
                                  >
                                    Quitar
                                  </Button>
                                </>
                              )}
                            </span>
                          )}
                        </div>
                      ))}
                      <div className="flex items-center justify-between py-2 px-3 mt-1 rounded-lg bg-accent/5 border border-accent/20">
                        <span className="text-sm font-medium text-fg">Total</span>
                        <span className="text-sm font-bold text-fg tabular-nums">
                          {formatMoney(invoice.total)}
                        </span>
                      </div>
                      {invoice.status === "draft" && (
                        <Button size="sm" variant="secondary" className="self-start mt-2" onClick={openAddLine}>
                          Agregar concepto
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Payments */}
              <Card>
                <CardHeader>
                  <CardTitle>Pagos</CardTitle>
                  <CardDescription>
                    {invoice.payments.length === 0
                      ? "Aún no hay pagos"
                      : `${invoice.payments.length} payment${invoice.payments.length !== 1 ? "s" : ""}`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {invoice.payments.length === 0 ? (
                    <p className="text-sm text-fg-muted py-4 text-center">
                      No hay pagos registrados para esta factura.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {invoice.payments.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-surface-200"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-green tabular-nums">
                              +{formatMoney(p.amount)}
                            </span>
                            <span className="text-xs text-fg-muted capitalize">
                              {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                            </span>
                          </div>
                          <span className="text-xs text-fg-dim">
                            {new Date(p.paidAt).toLocaleDateString("es-PE", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {invoice && (
        <MessageSendDialog
          open={emailOpen}
          onOpenChange={setEmailOpen}
          kind="invoice"
          documentId={invoiceId}
          title={`Enviar factura ${invoice.number} por correo`}
          description="Envía al cliente una copia de la factura con tus plantillas de mensaje."
        />
      )}
    </div>
  );
}
