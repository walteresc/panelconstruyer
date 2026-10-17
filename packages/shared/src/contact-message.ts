// Contacto con el cliente por WhatsApp. Lo usan la API (avisos al dueño) y el panel
// (botón «Copiar mensaje»), para que ambos generen exactamente el mismo texto.

export interface ContactMessageInput {
  customerName: string;
  /** Servicio con nombre legible (ej. «Gasfitería»). */
  category?: string | null;
  district?: string | null;
  /** Lo que el cliente escribió sobre su problema. */
  summary?: string | null;
  reference?: string | null;
}

export interface ParsedLeadDescription {
  category?: string;
  district?: string;
  summary?: string;
}

/** Normaliza un celular peruano (9 dígitos que empiezan en 9) o con código de país; null si no es válido. */
export function whatsappDigits(phone: string | null | undefined): string | null {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 9 && digits.startsWith("9")) digits = `51${digits}`;
  return digits.length >= 10 ? digits : null;
}

export function whatsappUrl(phone: string | null | undefined, message: string): string | null {
  const digits = whatsappDigits(phone);
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null;
}

/** Primer mensaje para el cliente: ordenado, con negrita de WhatsApp, y citando su pedido. */
export function whatsappContactMessage(input: ContactMessageInput): string {
  const quote = (input.summary ?? "").replace(/\s+/g, " ").trim();
  const short = quote.length > 160 ? `${quote.slice(0, 157).trimEnd()}…` : quote;
  const intro = `Hola ${input.customerName}, te escribimos de *Construyer*.`;
  const closing = "¿Te parece si coordinamos los detalles?";
  if (!short) {
    return input.reference
      ? `${intro}\n\nRecibimos tu solicitud ${input.reference}.\n\n${closing}`
      : `${intro}\n\nRecibimos tu solicitud.\n\n${closing}`;
  }
  const category = input.category?.trim();
  const service = category ? category.charAt(0).toUpperCase() + category.slice(1) : null;
  const items = [
    service ? `• *Servicio:* ${service}` : null,
    input.district ? `• *Zona:* ${input.district}` : null,
    `• *Detalle:* «${short}»`,
  ].filter((line): line is string => line !== null);
  const heading = service ? "Recibimos tu solicitud:" : "Recibimos tu mensaje:";
  return `${intro}\n\n${heading}\n${items.join("\n")}\n\n${closing}`;
}

/**
 * Lee la descripción que la web pública guarda en el trabajo:
 *   Categoría: …\nDistrito: …\n[Dirección…]\nCuándo lo necesita: …\n\n<texto del cliente>\n\nOrigen: …
 * Si el trabajo se creó a mano (sin ese formato), todo el texto cuenta como detalle.
 */
export function parseLeadDescription(description: string | null | undefined): ParsedLeadDescription {
  const text = (description ?? "").trim();
  if (!text) return {};
  const category = /^Categoría:\s*(.+)$/m.exec(text)?.[1]?.trim();
  const district = /^Distrito:\s*(.+)$/m.exec(text)?.[1]?.trim();
  if (!category && !district) return { summary: text.replace(/\n+Origen:.*$/s, "").trim() || undefined };
  const blocks = text.split(/\n\s*\n/);
  const summary = blocks
    .filter((block) => !/^(Categoría|Distrito|Dirección|Cuándo)/.test(block.trim()) && !/^Origen:/.test(block.trim()))
    .join("\n\n")
    .trim();
  return { category, district, summary: summary || undefined };
}
