// Aviso al dueño cuando entra una solicitud desde la web pública.
// Proveedores de WhatsApp (elegir con LEAD_ALERT_WHATSAPP_PROVIDER):
//   callmebot → servicio gratuito para un número personal (CALLMEBOT_APIKEY).
//   cloudapi  → WhatsApp Cloud API de Meta (WHATSAPP_CLOUD_TOKEN, WHATSAPP_CLOUD_PHONE_ID;
//               WHATSAPP_CLOUD_TEMPLATE si el aviso va fuera de la ventana de 24 h).
// Además publica en NTFY_URL si está definido. Es "dispara y olvida": nunca rompe la solicitud.
// Privacidad: el aviso NO incluye teléfono ni correo del cliente; solo referencia, servicio, distrito y enlace.

export interface LeadAlert {
  reference: string;
  jobId: string;
  title: string;
  customerName: string;
  when?: string;
}

export function buildLeadAlertText(alert: LeadAlert, panelUrl: string | undefined): string {
  const lines = [
    `Nueva solicitud ${alert.reference}`,
    `${alert.title} — ${alert.customerName}`,
    alert.when ? `Cuándo: ${alert.when}` : null,
    panelUrl ? `Ver: ${panelUrl.replace(/\/$/, "")}/jobs/${alert.jobId}` : null,
  ];
  return lines.filter((line): line is string => line !== null).join("\n");
}

async function post(url: string, init: RequestInit): Promise<void> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`${new URL(url).host} respondió ${res.status}`);
}

export async function sendLeadAlert(alert: LeadAlert, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const text = buildLeadAlertText(alert, env.PUBLIC_WEB_URL);
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
    tasks.push(post(env.NTFY_URL, { method: "POST", headers: { Title: "Nueva solicitud" }, body: text }));
  }

  const results = await Promise.allSettled(tasks);
  for (const r of results) {
    if (r.status === "rejected") console.error(`[lead-alert] ${(r.reason as Error).message}`);
  }
}
