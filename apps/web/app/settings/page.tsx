"use client";

import type React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type BusinessSettingsDTO, type OrgSettingsDTO } from "@/lib/api";
import { normalizeServiceAreas, validateBusinessHours } from "@/lib/business-settings-form";
import { estimateDocumentHtml, invoiceDocumentHtml } from "@/lib/document-data";
import { DocumentPreviewWorkbench, type DocumentPreviewItem } from "@/components/document-preview-workbench";
import { MessageTemplatesEditor } from "@/components/settings/message-templates-editor";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

type Tab = "company" | "hours" | "areas" | "invoice" | "estimate" | "payments" | "taxes" | "messages" | "numbering" | "portal" | "team";

const TABS: { id: Tab; label: string }[] = [
  { id: "company", label: "Empresa" },
  { id: "hours", label: "Horario de atención" },
  { id: "areas", label: "Zonas de servicio" },
  { id: "invoice", label: "Facturas" },
  { id: "estimate", label: "Cotizaciones" },
  { id: "payments", label: "Pagos" },
  { id: "taxes", label: "Impuestos y descuentos" },
  { id: "messages", label: "Mensajes" },
  { id: "numbering", label: "Numeración" },
  { id: "portal", label: "Portal" },
  { id: "team", label: "Equipo" },
];

const TAB_GROUPS: { label: string; tabs: Tab[] }[] = [
  { label: "Negocio", tabs: ["company", "hours", "areas", "team"] },
  { label: "Ventas y pagos", tabs: ["invoice", "estimate", "payments", "taxes"] },
  { label: "Experiencia del cliente", tabs: ["messages", "numbering", "portal"] },
];

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

const DUE_TERM_LABELS: Record<string, string> = {
  on_receipt: "al recibir",
  work_start: "al iniciar el trabajo",
  work_completion: "al terminar el trabajo",
};

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("company");

  useEffect(() => {
    const section = new URLSearchParams(window.location.search).get("section") as Tab | null;
    if (TABS.some((item) => item.id === section)) setTab(section!);
  }, []);
  const [dirty, setDirty] = useState(false);

  const selectTab = (next: Tab) => {
    if (next === "team" && dirty && !window.confirm("¿Descartar los cambios sin guardar?")) return;
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("section", next);
    window.history.replaceState({}, "", url);
  };

  return (
    <div>
      <PageHeader
        title="Configuración"
        description="Configura las reglas que rigen las facturas, cotizaciones, pagos, documentos, el portal del cliente y el acceso del equipo."
      />

      <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-border bg-surface-200 p-2">
          <nav aria-label="Configuración del negocio" className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
            {TAB_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="px-2 py-1 text-xs font-bold uppercase tracking-wide text-fg-dim">{group.label}</p>
                <div className="grid gap-1">
                  {group.tabs.map((id) => {
                    const item = TABS.find((candidate) => candidate.id === id)!;
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-current={tab === id ? "page" : undefined}
                        onClick={() => selectTab(id)}
                        className={`min-h-10 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                          tab === id ? "bg-accent text-surface-100" : "text-fg-muted hover:bg-surface-300 hover:text-fg"
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div>
              <p className="px-2 py-1 text-xs font-bold uppercase tracking-wide text-fg-dim">Conexiones</p>
              <Link className="block min-h-10 rounded-lg px-3 py-2 text-sm font-medium text-fg-muted hover:bg-surface-300 hover:text-fg" href="/integrations">
                Integraciones
              </Link>
            </div>
          </nav>
        </aside>

        {tab === "team" ? <TeamTab /> : <BusinessSettingsTab tab={tab} onDirtyChange={setDirty} />}
      </div>
    </div>
  );
}

function BusinessSettingsTab({ tab, onDirtyChange }: { tab: Exclude<Tab, "team">; onDirtyChange: (dirty: boolean) => void }) {
  const [org, setOrg] = useState<OrgSettingsDTO | null>(null);
  const [form, setForm] = useState<OrgSettingsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ReturnType<typeof validateBusinessHours>>({});

  useEffect(() => {
    let cancelled = false;
    api.org()
      .then((row) => {
        if (cancelled) return;
        setOrg(row);
        setForm(row);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo cargar la configuración de la empresa");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const dirty = Boolean(org && form && JSON.stringify(org) !== JSON.stringify(form));

  useEffect(() => {
    onDirtyChange(dirty);
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      onDirtyChange(false);
    };
  }, [dirty, onDirtyChange]);

  const updateOrg = <K extends keyof OrgSettingsDTO>(key: K, value: OrgSettingsDTO[K]) => {
    setForm((prev) => prev ? { ...prev, [key]: value } : prev);
  };

  const updateSettings = (next: BusinessSettingsDTO) => {
    setForm((prev) => prev ? { ...prev, businessSettings: next } : prev);
  };

  const uploadLogo = async (file: File) => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Elige un logo en formato PNG, JPEG o WebP.");
      return false;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Elige un logo menor a 2 MB.");
      return false;
    }
    setLogoBusy(true);
    setError(null);
    setMessage(null);
    try {
      const row = await api.uploadOrgLogo(file);
      setOrg((current) => current ? { ...current, logoUrl: row.logoUrl } : row);
      setForm((current) => current ? { ...current, logoUrl: row.logoUrl } : row);
      setMessage("Logo cargado y agregado a los documentos del cliente.");
      return true;
    } catch {
      setError("No se pudo cargar el logo. Revisa la imagen e inténtalo de nuevo.");
      return false;
    } finally {
      setLogoBusy(false);
    }
  };

  const removeLogo = async () => {
    setLogoBusy(true);
    setError(null);
    setMessage(null);
    try {
      const row = await api.deleteOrgLogo();
      setOrg((current) => current ? { ...current, logoUrl: null } : row);
      setForm((current) => current ? { ...current, logoUrl: null } : row);
      setMessage("Logo eliminado. Los documentos usarán las iniciales de la empresa.");
    } catch {
      setError("No se pudo eliminar el logo. Inténtalo de nuevo.");
    } finally {
      setLogoBusy(false);
    }
  };

  const save = async () => {
    if (!form) return;
    const nextFieldErrors = validateBusinessHours(form.businessSettings.businessHours);
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) {
      setError("Corrige los horarios marcados antes de guardar.");
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const row = await api.patchOrg({
        name: form.name,
        timezone: form.timezone,
        logoUrl: form.logoUrl || null,
        brandColor: form.brandColor || "#22C55E",
        documentFooter: form.documentFooter || null,
        publicEmail: form.publicEmail || null,
        publicPhone: form.publicPhone || null,
        publicAddress: form.publicAddress || null,
        removeOpenFieldProAttribution: form.removeOpenFieldProAttribution,
        businessSettings: form.businessSettings,
      });
      setOrg(row);
      setForm(row);
      setMessage("Configuración guardada.");
    } catch (err) {
      setError("No se pudo guardar. Tus cambios siguen aquí; revisa los campos e inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle>Cargando configuración</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-6 w-64" /></CardContent>
      </Card>
    );
  }

  if (!org || !form) {
    return (
      <Card className="border-red/30 bg-red/5">
        <CardContent className="p-4"><p className="text-sm text-red">{error ?? "No se pudo cargar la configuración de la empresa."}</p></CardContent>
      </Card>
    );
  }

  const settings = form.businessSettings;

  return (
    <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_480px]">
      <Card>
        <CardHeader>
          <CardTitle>{TABS.find((item) => item.id === tab)?.label}</CardTitle>
        </CardHeader>
        <CardContent>
          {tab === "company" && <CompanySection form={form} updateOrg={updateOrg} updateSettings={updateSettings} logoBusy={logoBusy} onUploadLogo={uploadLogo} onRemoveLogo={removeLogo} />}
          {tab === "hours" && <BusinessHoursSection settings={settings} updateSettings={updateSettings} errors={fieldErrors} />}
          {tab === "areas" && <ServiceAreasSection settings={settings} updateSettings={updateSettings} />}
          {tab === "invoice" && <InvoiceSection settings={settings} updateSettings={updateSettings} />}
          {tab === "estimate" && <EstimateSection settings={settings} updateSettings={updateSettings} />}
          {tab === "payments" && <PaymentsSection settings={settings} updateSettings={updateSettings} />}
          {tab === "taxes" && <TaxesSection settings={settings} updateSettings={updateSettings} />}
          {tab === "messages" && <MessageTemplatesEditor settings={settings} updateSettings={updateSettings} companyName={org.name} />}
          {tab === "numbering" && <NumberingSection settings={settings} updateSettings={updateSettings} />}
          {tab === "portal" && <PortalSection settings={settings} updateSettings={updateSettings} />}

          {(message || error) && <p aria-live="polite" role={error ? "alert" : "status"} className={`mt-4 text-sm ${error ? "text-red" : "text-green"}`}>{error ?? message}</p>}

          <div className="mt-6 flex gap-2">
            <Button onClick={save} disabled={saving || !dirty}>{saving ? "Guardando…" : "Guardar configuración"}</Button>
            <Button variant="secondary" onClick={() => { setForm(org); setError(null); setMessage(null); setFieldErrors({}); }} disabled={saving || !dirty}>Restablecer</Button>
          </div>
        </CardContent>
      </Card>

      <SettingsPreview form={form} tab={tab} />
    </div>
  );
}

function CompanySection({ form, updateOrg, updateSettings, logoBusy, onUploadLogo, onRemoveLogo }: {
  form: OrgSettingsDTO;
  updateOrg: <K extends keyof OrgSettingsDTO>(key: K, value: OrgSettingsDTO[K]) => void;
  updateSettings: (settings: BusinessSettingsDTO) => void;
  logoBusy: boolean;
  onUploadLogo: (file: File) => Promise<boolean>;
  onRemoveLogo: () => Promise<void>;
}) {
  const settings = form.businessSettings;
  const [localLogo, setLocalLogo] = useState<string | null>(null);

  useEffect(() => () => {
    if (localLogo) URL.revokeObjectURL(localLogo);
  }, [localLogo]);

  const chooseLogo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setLocalLogo(previewUrl);
    const uploaded = await onUploadLogo(file);
    if (uploaded) setLocalLogo(null);
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface-200 p-4 md:col-span-2">
        {localLogo || form.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={localLogo ?? form.logoUrl ?? ""} alt={`Vista previa del logo de ${form.name}`} className="h-20 w-20 rounded-xl border border-border bg-white object-contain p-2" />
        ) : (
          <div className="grid h-20 w-20 place-items-center rounded-xl text-xl font-black text-white" style={{ backgroundColor: form.brandColor }}>{form.name.slice(0, 2).toUpperCase()}</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-fg">Logo de la empresa</p>
          <p className="mt-1 text-xs text-fg-muted">PNG, JPEG o WebP de hasta 2 MB. Aparece automáticamente en facturas y cotizaciones.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <label className="inline-flex min-h-9 cursor-pointer items-center rounded-lg bg-accent px-3 text-sm font-semibold text-white hover:opacity-90">
              {logoBusy ? "Cargando…" : form.logoUrl ? "Reemplazar logo" : "Cargar logo"}
              <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseLogo} disabled={logoBusy} />
            </label>
            {form.logoUrl ? <Button type="button" size="sm" variant="secondary" onClick={onRemoveLogo} disabled={logoBusy}>Quitar logo</Button> : null}
          </div>
        </div>
      </div>
      <TextField label="Nombre de la empresa" name="organization" autoComplete="organization" value={form.name} onChange={(value) => updateOrg("name", value)} />
      <TextField label="Zona horaria" name="timezone" value={form.timezone} onChange={(value) => {
        updateOrg("timezone", value);
        updateSettings({ ...settings, businessHours: { ...settings.businessHours, timezone: value } });
      }} />
      <label className="grid gap-1.5 text-sm text-fg-muted">
        Color de marca
        <div className="flex gap-2">
          <Input name="brandColor" value={form.brandColor} onChange={(event) => updateOrg("brandColor", event.target.value)} />
          <input
            aria-label="Selector del color de marca"
            type="color"
            value={form.brandColor}
            onChange={(event) => updateOrg("brandColor", event.target.value)}
            className="h-10 w-14 rounded-lg border border-border bg-surface-200 p-1"
          />
        </div>
      </label>
      <div>
        <TextField label="URL del logo (opcional)" name="logoUrl" type="url" autoComplete="url" value={form.logoUrl ?? ""} onChange={(value) => updateOrg("logoUrl", value || null)} placeholder="https://example.com/logo.png" />
        <p className="mt-1 text-xs text-fg-dim">Puedes pegar la dirección de una imagen existente en lugar de cargar un archivo.</p>
      </div>
      <TextField label="Correo público" name="email" type="email" autoComplete="email" value={form.publicEmail ?? ""} onChange={(value) => updateOrg("publicEmail", value || null)} />
      <TextField label="Teléfono público" name="tel" type="tel" autoComplete="tel" value={form.publicPhone ?? ""} onChange={(value) => updateOrg("publicPhone", value || null)} />
      <div className="md:col-span-2">
        <TextField label="Dirección pública" name="street-address" autoComplete="street-address" value={form.publicAddress ?? ""} onChange={(value) => updateOrg("publicAddress", value || null)} />
      </div>
      <label className="flex items-center gap-2 text-sm text-fg-muted md:col-span-2">
        <input
          type="checkbox"
          checked={form.removeOpenFieldProAttribution}
          onChange={(event) => updateOrg("removeOpenFieldProAttribution", event.target.checked)}
        />
        Quitar la marca «OpenFieldPro» de los documentos para el cliente
      </label>
    </div>
  );
}

const WORK_DAYS = [
  ["sun", "Dom"], ["mon", "Lun"], ["tue", "Mar"], ["wed", "Mié"],
  ["thu", "Jue"], ["fri", "Vie"], ["sat", "Sáb"],
] as const;

function BusinessHoursSection({ settings, updateSettings, errors }: SettingsProps & { errors: ReturnType<typeof validateBusinessHours> }) {
  const hours = settings.businessHours;
  const updateHours = (next: Partial<typeof hours>) => updateSettings({ ...settings, businessHours: { ...hours, ...next } });

  return (
    <div className="grid gap-6">
      <fieldset>
        <legend className="text-sm font-medium text-fg">Días laborables</legend>
        <p className="mt-1 text-sm text-fg-muted">Elige los días en los que los clientes pueden programar un servicio.</p>
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
          {WORK_DAYS.map(([value, label]) => (
            <label key={value} className={`grid min-h-11 cursor-pointer place-items-center rounded-lg border px-2 text-sm font-medium ${hours.workDays.includes(value) ? "border-accent bg-accent-muted text-accent" : "border-border bg-surface-200 text-fg-muted"}`}>
              <input
                className="sr-only"
                type="checkbox"
                checked={hours.workDays.includes(value)}
                onChange={(event) => updateHours({ workDays: event.target.checked ? [...hours.workDays, value] : hours.workDays.filter((day) => day !== value) })}
              />
              {label}
            </label>
          ))}
        </div>
        {errors.workDays && <p className="mt-2 text-sm text-red">{errors.workDays}</p>}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm text-fg-muted">
          Hora de apertura
          <Input name="openingTime" type="time" value={hours.startTime} onChange={(event) => updateHours({ startTime: event.target.value })} />
        </label>
        <label className="grid gap-1.5 text-sm text-fg-muted">
          Hora de cierre
          <Input aria-invalid={Boolean(errors.endTime)} aria-describedby={errors.endTime ? "closing-time-error" : undefined} name="closingTime" type="time" value={hours.endTime} onChange={(event) => updateHours({ endTime: event.target.value })} />
          {errors.endTime && <span id="closing-time-error" className="text-sm text-red">{errors.endTime}</span>}
        </label>
      </div>
      <p className="rounded-lg border border-border bg-surface-200 p-3 text-sm text-fg-muted">Las horas usan <strong className="text-fg">{hours.timezone}</strong>, sincronizada con la zona horaria de la empresa.</p>
    </div>
  );
}

function ServiceAreasSection({ settings, updateSettings }: SettingsProps) {
  const [draft, setDraft] = useState("");
  const addAreas = () => {
    const next = normalizeServiceAreas([...settings.serviceAreas, ...draft.split(",")]);
    updateSettings({ ...settings, serviceAreas: next });
    setDraft("");
  };

  return (
    <div>
      <p className="text-sm text-fg-muted">Agrega distritos o zonas. Separa varios con comas.</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Input
          aria-label="Zona de servicio"
          name="serviceArea"
          placeholder="Miraflores o San Isidro"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addAreas(); } }}
        />
        <Button type="button" variant="secondary" disabled={!draft.trim() || settings.serviceAreas.length >= 50} onClick={addAreas}>Agregar zona</Button>
      </div>
      {settings.serviceAreas.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-border p-6 text-center text-sm text-fg-muted">No hay zonas agregadas. Agrega los lugares que atiendes.</div>
      ) : (
        <ul className="mt-5 flex flex-wrap gap-2" aria-label="Zonas configuradas">
          {settings.serviceAreas.map((area) => (
            <li key={area} className="flex items-center gap-2 rounded-lg border border-border bg-surface-200 px-3 py-2 text-sm text-fg">
              <span className="break-words">{area}</span>
              <button
                type="button"
                aria-label={`Remove ${area}`}
                className="rounded text-fg-dim hover:text-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                onClick={() => updateSettings({ ...settings, serviceAreas: settings.serviceAreas.filter((item) => item !== area) })}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-fg-dim">{settings.serviceAreas.length} de 50 zonas</p>
    </div>
  );
}

function InvoiceSection({ settings, updateSettings }: SettingsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <p className="rounded-lg border border-border bg-surface-200 px-3 py-2 text-xs text-fg-muted md:col-span-2">El logo y el nombre de tu empresa siempre se incluyen. Cambia el logo en la configuración de la empresa.</p>
      <SelectField label="Plazo de pago" value={settings.invoice.dueTerm} onChange={(value) => updateSettings({ ...settings, invoice: { ...settings.invoice, dueTerm: value as BusinessSettingsDTO["invoice"]["dueTerm"] } })}>
        <option value="on_receipt">Al recibir</option>
        <option value="work_start">Al iniciar el trabajo</option>
        <option value="work_completion">Al terminar el trabajo</option>
        <option value="net_days">Días de plazo</option>
      </SelectField>
      <NumberField label="Días de plazo" value={settings.invoice.netDays} onChange={(value) => updateSettings({ ...settings, invoice: { ...settings.invoice, netDays: value } })} />
      <SelectField label="Formato para el cliente" value={settings.invoice.format} onChange={(value) => updateSettings({ ...settings, invoice: { ...settings.invoice, format: value as BusinessSettingsDTO["invoice"]["format"] } })}>
        <option value="email">Optimizado para correo</option>
        <option value="envelope">Optimizado para imprimir</option>
      </SelectField>
      <TextField label="Días de recordatorio" value={settings.invoice.reminderDays.join(", ")} onChange={(value) => updateSettings({ ...settings, invoice: { ...settings.invoice, reminderDays: splitCsv(value).map((item) => Number(item)).filter(Number.isFinite) } })} />
      <TextArea label="Mensaje predeterminado de la factura" value={settings.invoice.defaultMessage} onChange={(value) => updateSettings({ ...settings, invoice: { ...settings.invoice, defaultMessage: value } })} />
      <TextArea label="Instrucciones de pago" value={settings.invoice.paymentInstructions} onChange={(value) => updateSettings({ ...settings, invoice: { ...settings.invoice, paymentInstructions: value } })} />
      <VisibilityGroup
        title="Vista de la factura para el cliente"
        values={settings.invoice.visibility}
        labels={{
          showBusinessInfo: "Datos de contacto del negocio",
          showCustomerInfo: "Datos del cliente",
          showJobInfo: "Datos del trabajo",
          showLineItems: "Conceptos",
          showLineItemPrices: "Precios de los conceptos",
          showPayments: "Pagos",
          showBalance: "Saldo",
        }}
        onChange={(visibility) => updateSettings({ ...settings, invoice: { ...settings.invoice, visibility } })}
      />
    </div>
  );
}

function EstimateSection({ settings, updateSettings }: SettingsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <p className="rounded-lg border border-border bg-surface-200 px-3 py-2 text-xs text-fg-muted md:col-span-2">El logo y el nombre de tu empresa siempre se incluyen. Cambia el logo en la configuración de la empresa.</p>
      <NumberField label="Días de vigencia predeterminados" value={settings.estimate.expirationDays} onChange={(value) => updateSettings({ ...settings, estimate: { ...settings.estimate, expirationDays: value } })} />
      <SelectField label="Modo de aprobación" value={settings.estimate.approvalMode} onChange={(value) => updateSettings({ ...settings, estimate: { ...settings.estimate, approvalMode: value as BusinessSettingsDTO["estimate"]["approvalMode"] } })}>
        <option value="single_option">Aprobación de una sola opción</option>
        <option value="multiple_options">Aprobación de varias opciones</option>
      </SelectField>
      <SelectField label="Modo de adelanto" value={settings.estimate.depositMode} onChange={(value) => updateSettings({ ...settings, estimate: { ...settings.estimate, depositMode: value as BusinessSettingsDTO["estimate"]["depositMode"] } })}>
        <option value="none">Sin adelanto</option>
        <option value="fixed">Monto fijo</option>
        <option value="percent">Porcentaje</option>
      </SelectField>
      <NumberField label="Valor del adelanto" value={settings.estimate.depositValue} onChange={(value) => updateSettings({ ...settings, estimate: { ...settings.estimate, depositValue: value } })} />
      <TextField label="Nombres de las opciones" value={settings.estimate.optionLabels.join(", ")} onChange={(value) => {
        const labels = splitCsv(value);
        updateSettings({ ...settings, estimate: { ...settings.estimate, optionLabels: [labels[0] || "Básica", labels[1] || "Intermedia", labels[2] || "Completa"] } });
      }} />
      <label className="flex items-center gap-2 text-sm text-fg-muted">
        <input
          type="checkbox"
          checked={settings.estimate.signatureRequired}
          onChange={(event) => updateSettings({ ...settings, estimate: { ...settings.estimate, signatureRequired: event.target.checked } })}
        />
        Exigir firma del cliente
      </label>
      <TextArea label="Mensaje predeterminado de la cotización" value={settings.estimate.defaultMessage} onChange={(value) => updateSettings({ ...settings, estimate: { ...settings.estimate, defaultMessage: value } })} />
      <VisibilityGroup
        title="Vista de la cotización para el cliente"
        values={settings.estimate.visibility}
        labels={{
          showBusinessInfo: "Datos de contacto del negocio",
          showCustomerInfo: "Datos del cliente",
          showJobInfo: "Datos del trabajo",
          showLineItems: "Conceptos",
          showLineItemPrices: "Precios de los conceptos",
          showOptionSummary: "Resumen de opciones",
        }}
        onChange={(visibility) => updateSettings({ ...settings, estimate: { ...settings.estimate, visibility } })}
      />
    </div>
  );
}

function PaymentsSection({ settings, updateSettings }: SettingsProps) {
  const set = (key: keyof BusinessSettingsDTO["payments"], value: boolean) =>
    updateSettings({ ...settings, payments: { ...settings.payments, [key]: value } });
  const payments = settings.payments;
  const methodRows = [
    { id: "online" as const, label: "Pagar en línea", enabled: payments.onlinePaymentsEnabled },
    { id: "cash" as const, label: "Efectivo", enabled: payments.allowManualCash },
    { id: "check" as const, label: "Check", enabled: payments.allowManualCheck },
    { id: "card" as const, label: "Tarjeta", enabled: payments.allowManualCard },
  ];
  const enabledMethods = methodRows.filter((row) => row.enabled).map((row) => row.label);
  const noneEnabled = enabledMethods.length === 0;

  return (
    <div className="grid gap-6">
      <CheckboxGrid
        values={settings.payments}
        labels={{
          onlinePaymentsEnabled: "Pagos en línea habilitados",
          allowManualCash: "Pagos en efectivo",
          allowManualCheck: "Pagos con cheque",
          allowManualCard: "Pagos con tarjeta registrados manualmente",
          allowPartialPayments: "Pagos parciales",
          tipsEnabled: "Propinas",
        }}
        onChange={set}
      />

      <div
        role="status"
        aria-live="polite"
        className={`rounded-xl border p-4 ${noneEnabled ? "border-red/30 bg-red/5" : "border-border bg-surface-200"}`}
      >
        <p className="text-sm font-semibold text-fg">Métodos visibles para el cliente</p>
        <p className="mt-1 text-sm text-fg-muted">
          {noneEnabled
            ? "No hay métodos de pago habilitados para los clientes. Habilita los pagos en línea o al menos un método manual para poder cobrar las facturas."
            : `Los clientes pueden pagar con ${enabledMethods.join(", ")}.`}
        </p>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {methodRows.map((row) => (
            <li key={row.id} className="flex items-center justify-between rounded-lg border border-border bg-surface-300 px-3 py-2 text-sm">
              <span className="text-fg">{row.label}</span>
              <span className={`text-xs font-medium ${row.enabled ? "text-green" : "text-fg-dim"}`}>
                {row.enabled ? "shown" : "hidden"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {!payments.allowPartialPayments && (
        <div role="alert" className="rounded-xl border border-yellow/40 bg-yellow/10 p-4">
          <p className="text-sm font-semibold text-fg">Los pagos parciales están desactivados</p>
          <p className="mt-1 text-sm text-fg-muted">
            Los clientes deben pagar el saldo completo. Si cobras adelantos o pagos por avance, habilita los pagos parciales.
          </p>
        </div>
      )}
    </div>
  );
}

function TaxesSection({ settings, updateSettings }: SettingsProps) {
  const taxes = settings.taxes;
  const profiles = taxes.taxProfiles ?? [];
  const discounts = taxes.discounts ?? [];
  const setTaxes = (next: typeof taxes) => updateSettings({ ...settings, taxes: next });

  const addProfile = () => {
    const id = `tp-${Math.random().toString(36).slice(2, 10)}`;
    setTaxes({
      ...taxes,
      taxProfiles: [
        ...profiles,
        { id, name: "Nuevo perfil de impuesto", rateBps: 0, isDefault: profiles.length === 0 },
      ],
    });
  };
  const patchProfile = (id: string, patch: Partial<BusinessSettingsDTO["taxes"]["taxProfiles"][number]>) =>
    setTaxes({ ...taxes, taxProfiles: profiles.map((profile) => (profile.id === id ? { ...profile, ...patch } : profile)) });
  const removeProfile = (id: string) => {
    const remaining = profiles.filter((profile) => profile.id !== id);
    if (remaining.length > 0 && remaining.every((profile) => !profile.isDefault)) remaining[0] = { ...remaining[0], isDefault: true };
    setTaxes({ ...taxes, taxProfiles: remaining });
  };

  const addDiscount = () => {
    const id = `dc-${Math.random().toString(36).slice(2, 10)}`;
    setTaxes({ ...taxes, discounts: [...discounts, { id, name: "Nuevo descuento", type: "fixed", value: 0 }] });
  };
  const patchDiscount = (id: string, patch: Partial<BusinessSettingsDTO["taxes"]["discounts"][number]>) =>
    setTaxes({ ...taxes, discounts: discounts.map((discount) => (discount.id === id ? { ...discount, ...patch } : discount)) });
  const removeDiscount = (id: string) => setTaxes({ ...taxes, discounts: discounts.filter((discount) => discount.id !== id) });

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-fg-muted">
          <input checked={taxes.taxEnabled} onChange={(event) => setTaxes({ ...taxes, taxEnabled: event.target.checked })} type="checkbox" />
          Habilitar impuestos
        </label>
        <label className="flex items-center gap-2 text-sm text-fg-muted">
          <input checked={taxes.discountsEnabled} onChange={(event) => setTaxes({ ...taxes, discountsEnabled: event.target.checked })} type="checkbox" />
          Habilitar descuentos
        </label>
      </div>

      <section className="rounded-xl border border-border bg-surface-100 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-fg">Perfiles de impuestos</h3>
            <p className="text-xs text-fg-muted">Tasas con nombre que se aplican a cotizaciones y facturas. Se usa el perfil predeterminado cuando no eliges otro.</p>
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={addProfile}>Agregar perfil</Button>
        </div>
        {profiles.length === 0 ? (
          <p className="text-xs text-fg-muted">Aún no hay perfiles: agrega uno para cobrar impuestos. Si no existe ninguno, se usa la tasa única de abajo.</p>
        ) : (
          <div className="grid gap-2">
            {profiles.map((profile) => (
              <div key={profile.id} className="grid grid-cols-[auto_1fr_auto_auto] items-end gap-3 rounded-lg bg-surface-200 p-3">
                <label className="flex items-center gap-1.5 pb-2 text-xs text-fg-muted" title="Usar como perfil predeterminado">
                  <input
                    type="radio"
                    name="default-tax-profile"
                    checked={profile.isDefault}
                    onChange={() => setTaxes({ ...taxes, taxProfiles: profiles.map((p) => ({ ...p, isDefault: p.id === profile.id })) })}
                  />
                  Predeterminado
                </label>
                <TextField label="Nombre" value={profile.name} onChange={(value) => patchProfile(profile.id, { name: value })} />
                <NumberField label="Tasa %" value={Math.round((profile.rateBps / 100) * 100) / 100} onChange={(value) => patchProfile(profile.id, { rateBps: Math.max(0, Math.min(10_000, Math.round(value * 100))) })} />
                <Button type="button" size="sm" variant="danger" onClick={() => removeProfile(profile.id)}>Quitar</Button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField label="Nombre del impuesto por defecto" value={taxes.taxLabel} onChange={(value) => setTaxes({ ...taxes, taxLabel: value })} />
          <NumberField label="Tasa por defecto (puntos básicos)" value={taxes.defaultTaxRateBps} onChange={(value) => setTaxes({ ...taxes, defaultTaxRateBps: Math.max(0, Math.min(10_000, Math.round(value))) })} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface-100 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-fg">Descuentos guardados</h3>
            <p className="text-xs text-fg-muted">Descuentos fijos o porcentuales reutilizables en cotizaciones y facturas.</p>
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={addDiscount}>Agregar descuento</Button>
        </div>
        {discounts.length === 0 ? (
          <p className="text-xs text-fg-muted">Aún no hay descuentos guardados: agrega uno para ofrecerlo en las cotizaciones y facturas.</p>
        ) : (
          <div className="grid gap-2">
            {discounts.map((discount) => (
              <div key={discount.id} className="grid grid-cols-[1fr_auto_auto_auto] items-end gap-3 rounded-lg bg-surface-200 p-3">
                <TextField label="Nombre" value={discount.name} onChange={(value) => patchDiscount(discount.id, { name: value })} />
                <SelectField label="Tipo" value={discount.type} onChange={(value) => patchDiscount(discount.id, { type: value as "fixed" | "percent", value: 0 })}>
                  <option value="fixed">Monto fijo</option>
                  <option value="percent">Porcentaje de descuento</option>
                </SelectField>
                {discount.type === "fixed" ? (
                  <NumberField label="Monto S/" value={Math.round(discount.value) / 100} onChange={(value) => patchDiscount(discount.id, { value: Math.max(0, Math.round(value * 100)) })} />
                ) : (
                  <NumberField label="Porcentaje %" value={Math.round(discount.value) / 100} onChange={(value) => patchDiscount(discount.id, { value: Math.max(0, Math.min(10_000, Math.round(value * 100))) })} />
                )}
                <Button type="button" size="sm" variant="danger" onClick={() => removeDiscount(discount.id)}>Quitar</Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function NumberingSection({ settings, updateSettings }: SettingsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <TextField label="Prefijo de factura" value={settings.numbering.invoicePrefix} onChange={(value) => updateSettings({ ...settings, numbering: { ...settings.numbering, invoicePrefix: value } })} />
      <NumberField label="Siguiente número de factura" value={settings.numbering.invoiceNextNumber} onChange={(value) => updateSettings({ ...settings, numbering: { ...settings.numbering, invoiceNextNumber: value } })} />
      <TextField label="Prefijo de cotización" value={settings.numbering.estimatePrefix} onChange={(value) => updateSettings({ ...settings, numbering: { ...settings.numbering, estimatePrefix: value } })} />
      <NumberField label="Siguiente número de cotización" value={settings.numbering.estimateNextNumber} onChange={(value) => updateSettings({ ...settings, numbering: { ...settings.numbering, estimateNextNumber: value } })} />
    </div>
  );
}

function PortalSection({ settings, updateSettings }: SettingsProps) {
  const set = (key: keyof BusinessSettingsDTO["portal"], value: boolean) =>
    updateSettings({ ...settings, portal: { ...settings.portal, [key]: value } });
  return (
    <CheckboxGrid
      values={settings.portal}
      labels={{
        enabled: "Portal del cliente habilitado",
        showSponsorSlot: "Mostrar espacio de auspicio cuando esté permitido",
        allowEstimateApproval: "Permitir aprobar cotizaciones",
        allowInvoicePayment: "Permitir pagar facturas",
        allowServiceHistory: "Mostrar historial de servicios",
      }}
      onChange={set}
    />
  );
}

const ROLE_SUMMARY: { role: string; label: string; description: string }[] = [
  { role: "owner", label: "Propietario", description: "Acceso total: configuración, equipo, finanzas y todos los flujos." },
  { role: "dispatcher", label: "Coordinador", description: "Gestiona la agenda, el despacho, los trabajos y los clientes." },
  { role: "technician", label: "Especialista", description: "Ve y cierra los trabajos que tiene asignados." },
];

/** Pulls { error, hint } out of an ApiError body for inline display. */
function teamErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const colon = message.indexOf(": ");
  const body = colon >= 0 ? message.slice(colon + 2) : message;
  try {
    const parsed = JSON.parse(body) as { error?: string; hint?: string };
    return parsed.error ? (parsed.hint ? `${parsed.error} ${parsed.hint}` : parsed.error) : message;
  } catch {
    return body || message;
  }
}

function TeamTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [me, setMe] = useState<{ id: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.users(), api.me()])
      .then(([rows, self]) => {
        if (cancelled) return;
        setUsers(rows);
        setMe(self);
      })
      .catch(() => { if (!cancelled) setError("No se pudo cargar el equipo."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const isOwner = me?.role === "owner";
  const activeOwners = users.filter((u) => u.role === "owner");
  const isLastOwner = (u: User) => u.role === "owner" && activeOwners.length === 1;

  const roleDisabledReason = (u: User) => {
    if (u.id === me?.id) return "No puedes cambiar tu propio rol. Pídelo a otro propietario.";
    if (isLastOwner(u)) return "No se puede degradar al último propietario. Asigna ese rol a otra persona primero.";
    return undefined;
  };
  const deleteDisabledReason = (u: User) => {
    if (u.id === me?.id) return "No puedes eliminar tu propia cuenta. Debe hacerlo otro propietario.";
    if (isLastOwner(u)) return "No se puede eliminar al último propietario. Asigna ese rol a otra persona primero.";
    return undefined;
  };

  const handleRoleChange = async (id: string, role: string) => {
    setSavingId(id);
    setNotice(null);
    setError(null);
    try {
      await api.patchUser(id, { role });
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
    } catch (err) {
      setError(teamErrorMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmDelete(null);
    setNotice(null);
    setError(null);
    try {
      await api.deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      setError(teamErrorMessage(err));
    }
  };

  if (loading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>;
  if (error && users.length === 0) return <Card className="border-red/30 bg-red/5"><CardContent className="p-4"><p className="text-sm text-red">{error}</p></CardContent></Card>;

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Roles y permisos</CardTitle>
          <p className="text-sm text-fg-muted">Solo los propietarios pueden cambiar roles o quitar integrantes. El último propietario nunca puede ser degradado ni eliminado, y no puedes cambiar tu propio rol.</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {ROLE_SUMMARY.map((role) => (
            <div key={role.role} className="rounded-lg border border-border bg-surface-200 p-3">
              <p className="text-sm font-semibold text-fg">{role.label}</p>
              <p className="mt-1 text-xs text-fg-muted">{role.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Nombre</TableHead><TableHead>Correo</TableHead><TableHead>Rol</TableHead><TableHead className="w-24">Acciones</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const roleReason = roleDisabledReason(u);
              const deleteReason = deleteDisabledReason(u);
              const isSelf = u.id === me?.id;
              return (
                <TableRow key={u.id}>
                  <TableCell className="font-medium text-fg">
                    {u.name}
                    {isSelf ? <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">Tú</span> : null}
                  </TableCell>
                  <TableCell className="text-fg-muted">{u.email}</TableCell>
                  <TableCell>
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      disabled={savingId === u.id || Boolean(roleReason)}
                      title={roleReason}
                      aria-label={`Rol de ${u.name}`}
                      className="h-8 rounded-md border border-border bg-surface-300 px-2 text-xs text-fg disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="owner">Propietario</option>
                      <option value="dispatcher">Coordinador</option>
                      <option value="technician">Especialista</option>
                    </select>
                    {roleReason ? <p className="mt-1 max-w-56 text-xs text-fg-dim">{roleReason}</p> : null}
                  </TableCell>
                  <TableCell>
                    {confirmDelete === u.id ? (
                      <div className="flex gap-2">
                        <button onClick={() => handleDelete(u.id)} className="border-none bg-transparent text-xs text-red">Confirmar</button>
                        <button onClick={() => setConfirmDelete(null)} className="border-none bg-transparent text-xs text-fg-muted">Cancelar</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(u.id)}
                        disabled={Boolean(deleteReason)}
                        title={deleteReason}
                        className="border-none bg-transparent text-xs text-fg-muted hover:text-red disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Eliminar
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {(notice || error) && (
        <p aria-live="polite" role={error ? "alert" : "status"} className={`text-sm ${error ? "text-red" : "text-green"}`}>{error ?? notice}</p>
      )}
    </div>
  );
}

interface SettingsProps {
  settings: BusinessSettingsDTO;
  updateSettings: (settings: BusinessSettingsDTO) => void;
}

function SettingsPreview({ form, tab }: { form: OrgSettingsDTO; tab: Exclude<Tab, "team"> }) {
  if (tab === "invoice" || tab === "estimate") {
    const invoiceHtml = invoiceDocumentHtml({
      invoice: {
        number: `${form.businessSettings.numbering.invoicePrefix}-${form.businessSettings.numbering.invoiceNextNumber}`,
        status: "sent",
        total: 42_700,
        dueAt: new Date(Date.now() + form.businessSettings.invoice.netDays * 86_400_000).toISOString(),
        createdAt: new Date().toISOString(),
        payments: [{ amount: 10_000 }],
      },
      customer: { name: "Carlos Rojas", email: "taylor@example.test", phone: "(515) 555-0142" },
      job: { title: "Reparación de fuga de agua", description: "Se reparó la tubería dañada y se verificó que no hay filtraciones." },
      lineItems: [
        { description: "Visita de diagnóstico", quantity: 1, unitPrice: 12_900 },
        { description: "Tubería y accesorios", quantity: 1, unitPrice: 21_900 },
        { description: "Mano de obra", quantity: 1, unitPrice: 7_900 },
      ],
      org: form,
    });
    const optionLabels = form.businessSettings.estimate.optionLabels;
    const estimateOptions = [
      { id: "good", label: optionLabels[0] || "Básica", lineItems: [{ description: "Reparación de la tubería dañada", quantity: 1, unitPrice: 34_800 }] },
      { id: "better", label: optionLabels[1] || "Intermedia", lineItems: [{ description: "Reparación más mantenimiento", quantity: 1, unitPrice: 42_700 }] },
      { id: "best", label: optionLabels[2] || "Completa", lineItems: [{ description: "Reparación completa con acabados", quantity: 1, unitPrice: 58_900 }] },
    ];
    const estimateBase = {
      id: "settings-preview-estimate",
      number: `${form.businessSettings.numbering.estimatePrefix}-${form.businessSettings.numbering.estimateNextNumber}`,
      total: estimateOptions[0].lineItems[0].unitPrice,
      accepted: false,
      status: "sent",
      expiresAt: new Date(Date.now() + form.businessSettings.estimate.expirationDays * 86_400_000).toISOString(),
      createdAt: new Date().toISOString(),
      options: estimateOptions,
    };
    const estimateVariants = estimateOptions.map((option) => ({
      id: option.id,
      label: option.label,
      html: estimateDocumentHtml({
        estimate: { ...estimateBase, selectedOptionId: option.id },
        customer: { name: "Carlos Rojas", email: "taylor@example.test", phone: "(515) 555-0142" },
        job: { title: "Reparación de fuga de agua", description: "Elige el alcance que se ajusta a lo que necesita el cliente." },
        lineItems: estimateOptions[0].lineItems,
        org: form,
      }),
    }));
    const documents: DocumentPreviewItem[] = [
      { id: "invoice", label: "Factura", html: invoiceHtml },
      { id: "estimate", label: "Cotización", html: estimateVariants[0].html, variants: estimateVariants },
    ];
    return <DocumentPreviewWorkbench documents={documents} initialDocumentId={tab} compact fileName={`${tab}-preview.html`} />;
  }

  const workDays = WORK_DAYS.filter(([value]) => form.businessSettings.businessHours.workDays.includes(value)).map(([, label]) => label).join(", ");
  return (
    <Card>
      <CardHeader><CardTitle>{tab === "hours" || tab === "areas" ? "Resumen de operaciones" : "Vista previa para el cliente"}</CardTitle></CardHeader>
      <CardContent>
        <div className="rounded-2xl border border-border bg-surface-200 p-5">
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <div className="h-10 w-10 rounded-xl" style={{ background: form.brandColor }} />
            <div>
              <p className="text-sm font-bold text-fg">{form.name}</p>
              <p className="text-xs text-fg-muted">{form.publicPhone || "Sin teléfono"} · {form.publicEmail || "Sin correo"}</p>
            </div>
          </div>
          {tab === "hours" ? (
            <div className="mt-4 grid gap-2 text-sm text-fg-muted">
              <p><strong className="text-fg">Días laborables:</strong> {workDays || "Ninguno seleccionado"}</p>
              <p><strong className="text-fg">Horario:</strong> {form.businessSettings.businessHours.startTime}–{form.businessSettings.businessHours.endTime}</p>
              <p><strong className="text-fg">Zona horaria:</strong> {form.businessSettings.businessHours.timezone}</p>
            </div>
          ) : tab === "areas" ? (
            <div className="mt-4 text-sm text-fg-muted">
              <p><strong className="text-fg">{form.businessSettings.serviceAreas.length}</strong> zonas de servicio configuradas</p>
              <p className="mt-2 break-words">{form.businessSettings.serviceAreas.join(", ") || "Aún no hay zonas de servicio."}</p>
            </div>
          ) : tab === "payments" ? (
            <div className="mt-4 grid gap-2 text-sm text-fg-muted">
              <p><strong className="text-fg">Pagos en línea:</strong> {form.businessSettings.payments.onlinePaymentsEnabled ? "enabled" : "disabled"}</p>
              <p><strong className="text-fg">Métodos manuales:</strong> {[
                form.businessSettings.payments.allowManualCash ? "Efectivo" : null,
                form.businessSettings.payments.allowManualCheck ? "Check" : null,
                form.businessSettings.payments.allowManualCard ? "Tarjeta" : null,
              ].filter(Boolean).join(", ") || "ninguno habilitado"}</p>
              <p><strong className="text-fg">Pagos parciales:</strong> {form.businessSettings.payments.allowPartialPayments ? "allowed" : "bloqueados: se exige el saldo completo"}</p>
              <p><strong className="text-fg">Propinas:</strong> {form.businessSettings.payments.tipsEnabled ? "enabled" : "disabled"}</p>
            </div>
          ) : (
            <div className="mt-4 grid gap-2 text-xs text-fg-muted">
              <p>Plazo de la factura: {form.businessSettings.invoice.dueTerm === "net_days" ? `${form.businessSettings.invoice.netDays} días` : (DUE_TERM_LABELS[form.businessSettings.invoice.dueTerm] ?? form.businessSettings.invoice.dueTerm)}</p>
              <p>Número de factura: {form.businessSettings.numbering.invoicePrefix}-{form.businessSettings.numbering.invoiceNextNumber}</p>
              <p>Cotización: vence en {form.businessSettings.estimate.expirationDays} días · {(form.businessSettings.estimate.approvalMode === "single_option" ? "una sola opción" : "varias opciones")}</p>
              <p>Pagos: {form.businessSettings.payments.onlinePaymentsEnabled ? "en línea habilitados" : "solo manuales"} · parciales {form.businessSettings.payments.allowPartialPayments ? "allowed" : "blocked"}</p>
              <p>Impuesto: {form.businessSettings.taxes.taxEnabled ? `${form.businessSettings.taxes.taxLabel} ${form.businessSettings.taxes.defaultTaxRateBps / 100}%` : "disabled"}</p>
              <p>Portal: {form.businessSettings.portal.enabled ? "enabled" : "disabled"} · espacio de auspicio {form.businessSettings.portal.showSponsorSlot ? "allowed" : "hidden"}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TextField({ label, value, onChange, placeholder, ...inputProps }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
} & Pick<React.InputHTMLAttributes<HTMLInputElement>, "name" | "type" | "autoComplete">) {
  return (
    <label className="grid gap-1.5 text-sm text-fg-muted">
      {label}
      <Input {...inputProps} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="grid gap-1.5 text-sm text-fg-muted">
      {label}
      <Input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1.5 text-sm text-fg-muted md:col-span-2">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="rounded-lg border border-border bg-surface-200 px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      />
    </label>
  );
}

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm text-fg-muted">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-lg border border-border bg-surface-200 px-3 text-sm text-fg">
        {children}
      </select>
    </label>
  );
}

function CheckboxGrid<T extends object>({ values, labels, onChange }: { values: T; labels: { [K in keyof T]: string }; onChange: (key: keyof T, value: boolean) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {(Object.keys(labels) as (keyof T)[]).map((key) => (
        <label key={String(key)} className="flex items-center gap-2 rounded-lg border border-border bg-surface-200 p-3 text-sm text-fg-muted">
          <input type="checkbox" checked={Boolean(values[key])} onChange={(event) => onChange(key, event.target.checked)} />
          {labels[key]}
        </label>
      ))}
    </div>
  );
}

function VisibilityGroup<T extends object>({ title, values, labels, onChange }: { title: string; values: T; labels: { [K in keyof T]: string }; onChange: (values: T) => void }) {
  return (
    <div className="md:col-span-2">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-fg-dim">{title}</p>
      <CheckboxGrid values={values} labels={labels} onChange={(key, value) => onChange({ ...values, [key]: value })} />
    </div>
  );
}

function splitCsv(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
