"use client";

import { useEffect, useState } from "react";
import { api, type PortalLinkDTO, type PortalLinkScope } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SCOPE_LABELS: Record<PortalLinkScope, string> = {
  balance: "Saldo de factura",
  checkout: "Pagar",
  receipts: "Recibos",
  service_plans: "Planes de mantenimiento",
};

const TTL_OPTIONS = [
  { value: "7", label: "7 días" },
  { value: "30", label: "30 días" },
  { value: "90", label: "90 días" },
  { value: "365", label: "1 año" },
  { value: "null", label: "Sin vencimiento" },
];

function linkState(link: PortalLinkDTO): { label: string; className: string } {
  if (link.revokedAt) return { label: "Revocado", className: "bg-red/10 text-red" };
  if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) return { label: "Vencido", className: "bg-red/10 text-red" };
  return { label: "Activo", className: "bg-green/10 text-green" };
}

export function CustomerPortalLinks({ customerId }: { customerId: string }) {
  const [links, setLinks] = useState<PortalLinkDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState<PortalLinkScope[]>(["balance", "checkout", "receipts", "service_plans"]);
  const [ttl, setTtl] = useState("30");
  const [creating, setCreating] = useState(false);

  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendNotice, setSendNotice] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setLinks(await api.portalLinks(customerId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los enlaces del portal");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  function toggleScope(scope: PortalLinkScope) {
    setSelectedScopes((current) =>
      current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope],
    );
  }

  async function createLink() {
    if (selectedScopes.length === 0) return;
    setCreating(true);
    setError(null);
    try {
      const result = await api.createPortalLink({
        customerId,
        scopes: selectedScopes,
        expiresInDays: ttl === "null" ? null : Number(ttl),
      });
      setNewToken(result.token);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el enlace del portal");
    } finally {
      setCreating(false);
    }
  }

  async function copyToken() {
    if (!newToken) return;
    const url = `${window.location.origin}/p/${newToken}`;
    await navigator.clipboard.writeText(url).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function revoke(id: string) {
    setRevokingId(id);
    try {
      await api.revokePortalLink(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo revocar el enlace del portal");
    } finally {
      setRevokingId(null);
    }
  }

  async function send(id: string) {
    setSendingId(id);
    setSendNotice(null);
    setError(null);
    try {
      const result = await api.sendPortalLink(id);
      setSendNotice(`Enlace del portal enviado a ${result.to}.`);
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo enviar el enlace del portal por correo";
      setError(message.replace(/^\d+:\s*/, ""));
    } finally {
      setSendingId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Enlaces del portal del cliente</CardTitle>
        <Button size="sm" onClick={() => { setNewToken(null); setDialogOpen(true); }}>
          Nuevo enlace
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-6 text-center text-sm text-fg-muted">Cargando enlaces del portal…</p>
        ) : error ? (
          <div className="rounded-lg border border-red/30 bg-red/5 p-3">
            <p className="text-sm font-medium text-red">Enlaces del portal no disponibles</p>
            <p className="mt-1 text-xs text-fg-muted">{error}</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {sendNotice ? (
              <div role="status" className="rounded-lg border border-green/40 bg-green/10 p-3">
                <p className="text-sm text-green">{sendNotice}</p>
              </div>
            ) : null}
            {links.length === 0 ? (
              <div className="rounded-xl border border-border bg-surface-200 p-4">
                <p className="text-sm font-medium text-fg">Aún no hay enlace del portal.</p>
                <p className="mt-1 text-xs text-fg-muted">
                  Crea un enlace seguro con vencimiento para compartir con el cliente su saldo, pagos, recibos y planes de mantenimiento. Puedes revocarlo en cualquier momento.
                </p>
              </div>
            ) : (
              links.map((link) => {
                const state = linkState(link);
                const active = state.label === "Activo";
                return (
                  <div key={link.id} className="rounded-xl border border-border bg-surface-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <code className="rounded bg-surface-300 px-2 py-0.5 text-xs font-semibold text-fg">{link.tokenPrefix}…</code>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${state.className}`}>
                          {state.label}
                        </span>
                      </div>
                    <div className="flex items-center gap-2">
                      {active ? (
                        <>
                          <Button size="sm" variant="secondary" disabled={sendingId === link.id} onClick={() => void send(link.id)}>
                            {sendingId === link.id ? "Enviando…" : "Enviar correo"}
                          </Button>
                          {revokingId === link.id ? (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => setRevokingId(null)}>Conservar</Button>
                              <Button size="sm" variant="danger" onClick={() => void revoke(link.id)}>Confirmar revocación</Button>
                            </>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => setRevokingId(link.id)}>Revocar</Button>
                          )}
                        </>
                      ) : null}
                    </div>
                    </div>
                    <p className="mt-2 text-xs text-fg-muted">
                      {link.scopes.map((scope) => SCOPE_LABELS[scope]).join(" · ")}
                    </p>
                    <p className="mt-1 text-xs text-fg-dim">
                      {link.expiresAt ? `Expires ${new Date(link.expiresAt).toLocaleDateString("es-PE")} · ` : "Sin vencimiento ·"}
                      {link.lastUsedAt ? `último uso ${new Date(link.lastUsedAt).toLocaleDateString("es-PE")} · ` : "sin usar ·"}
                      {link.sentCount > 0 ? `emailed ${link.sentCount}×${link.lastSentAt ? ` (${new Date(link.lastSentAt).toLocaleDateString("es-PE")})` : ""}` : "aún no enviado por correo"}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!creating) setDialogOpen(open); }}>
        <DialogHeader>
          <DialogTitle>Nuevo enlace del portal del cliente</DialogTitle>
          <DialogDescription>
            Elige qué vistas abre este enlace. El enlace vence automáticamente y se puede revocar en cualquier momento.
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-fg-dim">Vistas</legend>
            {Object.entries(SCOPE_LABELS).map(([scope, label]) => (
              <label key={scope} className="flex items-center gap-3 rounded-lg border border-border bg-surface-300 px-3 py-2 text-sm text-fg">
                <input
                  type="checkbox"
                  checked={selectedScopes.includes(scope as PortalLinkScope)}
                  onChange={() => toggleScope(scope as PortalLinkScope)}
                  className="h-4 w-4 accent-accent"
                />
                {label}
              </label>
            ))}
            {selectedScopes.length === 0 ? (
              <p className="text-xs text-red">Selecciona al menos una vista.</p>
            ) : null}
          </fieldset>

          <label className="mt-4 block text-sm text-fg">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-fg-dim">Vencimiento</span>
            <select value={ttl} onChange={(event) => setTtl(event.target.value)} className="h-10 w-full rounded-lg border border-border bg-surface-300 px-3 text-sm text-fg">
              {TTL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          {newToken ? (
            <div className="mt-4 rounded-xl border border-green/40 bg-green/10 p-4">
              <p className="text-sm font-semibold text-green">Enlace del portal creado</p>
              <p className="mt-1 text-xs text-fg-muted">
                Comparte este enlace con el cliente. Solo se muestra una vez: cópialo ahora.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-300 px-3 py-2 text-xs text-fg" data-testid="new-portal-link">
                  {window.location.origin}/p/{newToken}
                </code>
                <Button size="sm" variant="secondary" onClick={() => void copyToken()}>
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cerrar</Button>
          {newToken ? null : (
            <Button onClick={() => void createLink()} disabled={selectedScopes.length === 0 || creating}>
              {creating ? "Creando…" : "Crear enlace"}
            </Button>
          )}
        </DialogFooter>
      </Dialog>
    </Card>
  );
}
