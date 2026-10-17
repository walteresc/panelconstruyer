import { sendEmail } from "./mailer.js";

// Aviso al dueño cuando entra una solicitud desde la web pública.
// Proveedores de WhatsApp (elegir con LEAD_ALERT_WHATSAPP_PROVIDER):
//   callmebot → servicio gratuito para un número personal (CALLMEBOT_APIKEY).
//   cloudapi  → WhatsApp Cloud API de Meta (WHATSAPP_CLOUD_TOKEN, WHATSAPP_CLOUD_PHONE_ID;
//               WHATSAPP_CLOUD_TEMPLATE si el aviso va fuera de la ventana de 24 h).
// Además publica en NTFY_URL si está definido. Es "dispara y olvida": nunca rompe la solicitud.
// Privacidad: por defecto el aviso de WhatsApp/ntfy NO incluye teléfono ni correo del cliente. Con
// LEAD_ALERT_INCLUDE_CONTACT=true agrega el teléfono (nunca el correo). El correo al dueño
// (LEAD_ALERT_EMAIL_TO, por tu propio SMTP) sí lleva todos los datos.

export interface LeadAlert {
  reference: string;
  jobId: string;
  title: string;
  customerName: string;
  when?: string;
  phone?: string;
  email?: string;
  /** Texto completo de la solicitud (solo va en el correo). */
  details?: string;
  photos?: number;
  /** Lo que el cliente escribió sobre su problema; se cita en el mensaje de WhatsApp. */
  summary?: string;
  category?: string;
  district?: string;
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** Primer mensaje para el cliente: cita su pedido en lugar de solo el código. */
export function whatsappMessage(alert: LeadAlert): string {
  const quote = (alert.summary ?? "").replace(/\s+/g, " ").trim();
  const short = quote.length > 160 ? `${quote.slice(0, 157).trimEnd()}…` : quote;
  const intro = `Hola ${alert.customerName}, te escribimos de *Construyer*.`;
  const closing = "¿Te parece si coordinamos los detalles?";
  if (!short) return `${intro}\n\nRecibimos tu solicitud ${alert.reference}.\n\n${closing}`;
  // Formato de WhatsApp: *negrita*, líneas separadas y viñetas para que se lea de un vistazo.
  const service = alert.category ? alert.category.charAt(0).toUpperCase() + alert.category.slice(1) : null;
  const items = [
    service ? `• *Servicio:* ${service}` : null,
    alert.district ? `• *Zona:* ${alert.district}` : null,
    `• *Detalle:* «${short}»`,
  ].filter((line): line is string => line !== null);
  const heading = service ? "Recibimos tu solicitud:" : "Recibimos tu mensaje:";
  return `${intro}\n\n${heading}\n${items.join("\n")}\n\n${closing}`;
}

/** Enlace wa.me para escribirle al cliente; acepta celulares peruanos de 9 dígitos o con código de país. */
export function whatsappLink(alert: LeadAlert): string | null {
  let digits = (alert.phone ?? "").replace(/\D/g, "");
  if (digits.length === 9 && digits.startsWith("9")) digits = `51${digits}`;
  if (digits.length < 10) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(whatsappMessage(alert))}`;
}

/** `hasButtons`: el canal (ntfy) ya trae botones para responder y abrir el panel, así que no se repiten los enlaces. */
export function buildLeadAlertText(alert: LeadAlert, panelUrl: string | undefined, includeContact = false, hasButtons = false): string {
  const lines = [
    `Nueva solicitud ${alert.reference}`,
    `${alert.title} — ${alert.customerName}`,
    alert.summary ? `Pidió: «${truncate(alert.summary, 220)}»` : null,
    alert.when ? `Cuándo: ${alert.when}` : null,
    includeContact && alert.phone ? `Tel: ${alert.phone}` : null,
    includeContact && !hasButtons && whatsappLink(alert) ? `Responder: ${whatsappLink(alert)}` : null,
    !hasButtons && panelUrl ? `Ver: ${panelUrl.replace(/\/$/, "")}/jobs/${alert.jobId}` : null,
  ];
  return lines.filter((line): line is string => line !== null).join("\n");
}

export function buildLeadEmailText(alert: LeadAlert, panelUrl: string | undefined): string {
  const lines = [
    `Nueva solicitud ${alert.reference}`,
    "",
    `Servicio: ${alert.title}`,
    `Cliente: ${alert.customerName}`,
    alert.phone ? `Teléfono: ${alert.phone}` : null,
    alert.email ? `Correo: ${alert.email}` : null,
    whatsappLink(alert) ? `Responder por WhatsApp: ${whatsappLink(alert)}` : null,
    alert.when ? `Cuándo: ${alert.when}` : null,
    alert.photos ? `Fotos adjuntas: ${alert.photos}` : null,
    "",
    alert.details ?? "",
    panelUrl ? `\nAbrir en el panel: ${panelUrl.replace(/\/$/, "")}/jobs/${alert.jobId}` : null,
  ];
  return lines.filter((line): line is string => line !== null).join("\n");
}

async function post(url: string, init: RequestInit): Promise<void> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`${new URL(url).host} respondió ${res.status}`);
}

export async function sendLeadAlert(alert: LeadAlert, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const text = buildLeadAlertText(alert, env.PUBLIC_WEB_URL, env.LEAD_ALERT_INCLUDE_CONTACT === "true");
  const to = env.LEAD_ALERT_WHATSAPP_TO?.replace(/\D/g, "");
  const tasks: Array<Promise<void>> = [];

  if (to && env.LEAD_ALERT_WHATSAPP_PROVIDER === "callmebot" && env.CALLMEBOT_APIKEY) {
    const query = new URLSearchParams({ phone: to, text, apikey: env.CALLMEBOT_APIKEY });
    tasks.push(post(`https://api.callmebot.com/whatsapp.php?${query}`, { method: "GET" }));
  }

  if (to && env.LEAD_ALERT_WHATSAPP_PROVIDER === "cloudapi" && env.WHATSAPP_CLOUD_TOKEN && env.WHATSAPP_CLOUD_PHONE_ID) {
    const template = env.WHATSAPP_CLOUD_TEMPLATE;
    const body = template
      ? {
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: template,
            language: { code: env.WHATSAPP_CLOUD_TEMPLATE_LANG || "es" },
            components: [{ type: "body", parameters: [{ type: "text", text: text.replace(/\n+/g, " · ") }] }],
          },
        }
      : { messaging_product: "whatsapp", to, type: "text", text: { body: text } };
    tasks.push(
      post(`https://graph.facebook.com/v21.0/${env.WHATSAPP_CLOUD_PHONE_ID}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.WHATSAPP_CLOUD_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  }

  if (env.NTFY_URL) {
    // Tocar el aviso abre el trabajo en el panel; además hay botones para abrirlo y (con el interruptor) para escribirle al cliente.
    const includeContact = env.LEAD_ALERT_INCLUDE_CONTACT === "true";
    const panel = env.PUBLIC_WEB_URL ? `${env.PUBLIC_WEB_URL.replace(/\/$/, "")}/jobs/${alert.jobId}` : null;
    const wa = includeContact ? whatsappLink(alert) : null;
    const headers: Record<string, string> = { Title: "Nueva solicitud" };
    const actions: string[] = [];
    if (panel) {
      headers.Click = panel;
      actions.push(`view, Abrir en el panel, ${panel}`);
    }
    if (wa) actions.push(`view, Responder por WhatsApp, ${wa}`);
    if (actions.length > 0) headers.Actions = actions.join("; ");
    const ntfyText = buildLeadAlertText(alert, env.PUBLIC_WEB_URL, includeContact, actions.length > 0);
    tasks.push(post(env.NTFY_URL, { method: "POST", headers, body: ntfyText }));
  }

  const emailTo = env.LEAD_ALERT_EMAIL_TO?.trim();
  if (emailTo) {
    tasks.push(
      sendEmail({
        to: emailTo,
        subject: `Nueva solicitud ${alert.reference} — ${alert.title}`,
        text: buildLeadEmailText(alert, env.PUBLIC_WEB_URL),
      }).then(() => undefined),
    );
  }

  const results = await Promise.allSettled(tasks);
  for (const r of results) {
    if (r.status === "rejected") console.error(`[lead-alert] ${(r.reason as Error).message}`);
  }
}
