"use client";

import { useState } from "react";
import { whatsappContactMessage, whatsappUrl, parseLeadDescription } from "@ofp/shared";
import { Button } from "@/components/ui/button";

interface Props {
  customerName: string;
  phone?: string | null;
  /** Descripción del trabajo; si viene de la web pública se extraen servicio, zona y detalle. */
  description?: string | null;
  /** Título del trabajo, usado como detalle cuando no hay descripción. */
  jobTitle?: string;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Contextos sin Clipboard API (http, navegadores antiguos): copia con un textarea temporal.
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  }
}

export function CustomerContact({ customerName, phone, description, jobTitle }: Props) {
  const parsed = parseLeadDescription(description);
  const [message, setMessage] = useState(() =>
    whatsappContactMessage({
      customerName,
      category: parsed.category,
      district: parsed.district,
      summary: parsed.summary ?? jobTitle,
    }),
  );
  const [copied, setCopied] = useState<"phone" | "message" | null>(null);

  async function copy(kind: "phone" | "message", text: string) {
    if (await copyText(text)) {
      setCopied(kind);
      window.setTimeout(() => setCopied((current) => (current === kind ? null : current)), 2000);
    }
  }

  if (!phone) return <p className="text-xs text-fg-dim">Este cliente no tiene teléfono registrado.</p>;
  const link = whatsappUrl(phone, message);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-fg">{phone}</span>
        <Button type="button" variant="secondary" size="sm" onClick={() => copy("phone", phone)}>
          {copied === "phone" ? "¡Copiado!" : "Copiar número"}
        </Button>
      </div>

      <div>
        <label htmlFor="contact-message" className="mb-1.5 block text-xs font-semibold text-fg-muted">
          Mensaje para el cliente (editable)
        </label>
        <textarea
          id="contact-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={9}
          className="w-full rounded-lg border border-border bg-surface-200 px-3 py-2 text-sm text-fg"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => copy("message", message)}>
          {copied === "message" ? "¡Copiado!" : "Copiar mensaje"}
        </Button>
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer" className="no-underline hover:no-underline">
            <Button type="button" size="sm">Abrir en WhatsApp</Button>
          </a>
        ) : (
          <span className="text-xs text-fg-dim">El número no parece válido para WhatsApp.</span>
        )}
      </div>
    </div>
  );
}
