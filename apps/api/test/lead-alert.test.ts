import assert from "node:assert/strict";
import test from "node:test";
import { buildLeadAlertMarkdown, buildLeadAlertText, buildLeadEmailText, whatsappLink, whatsappMessage } from "../src/lead-alert.js";

test("el aviso incluye referencia, servicio y enlace, pero no datos de contacto", () => {
  const text = buildLeadAlertText(
    { reference: "C-ABC12345", jobId: "job-1", title: "gasfitería · Miraflores", customerName: "Ana", when: "Hoy" },
    "https://app.construyer.com/",
  );
  assert.match(text, /Nueva solicitud C-ABC12345/);
  assert.match(text, /gasfitería · Miraflores — Ana/);
  assert.match(text, /Cuándo: Hoy/);
  assert.match(text, /https:\/\/app\.construyer\.com\/jobs\/job-1$/);
  assert.doesNotMatch(text, /\d{9}/);
});

test("sin URL del panel no agrega enlace", () => {
  const text = buildLeadAlertText({ reference: "C-1", jobId: "j", title: "t", customerName: "n" }, undefined);
  assert.doesNotMatch(text, /Ver:/);
});

test("el teléfono solo va en el aviso si se activa el interruptor, y nunca el correo", () => {
  const alert = { reference: "C-1", jobId: "j", title: "t", customerName: "Ana", phone: "987654321", email: "ana@correo.com" };
  assert.doesNotMatch(buildLeadAlertText(alert, undefined, false), /987654321/);
  const withContact = buildLeadAlertText(alert, undefined, true);
  assert.match(withContact, /Tel: 987654321/);
  assert.doesNotMatch(withContact, /ana@correo\.com/);
});

test("el correo al dueño lleva todos los datos de la solicitud", () => {
  const text = buildLeadEmailText(
    { reference: "C-1", jobId: "j", title: "pintura · La Punta", customerName: "Ana", phone: "987654321", email: "ana@correo.com", details: "Pintar habitación", photos: 2 },
    "https://app.construyer.com",
  );
  for (const part of ["987654321", "ana@correo.com", "Pintar habitación", "Fotos adjuntas: 2", "/jobs/j"]) assert.ok(text.includes(part), part);
});

test("whatsappLink normaliza celulares peruanos y descarta números inválidos", () => {
  const base = { reference: "C-1", jobId: "j", title: "t", customerName: "Ana" };
  assert.match(whatsappLink({ ...base, phone: "987 654 321" })!, /^https:\/\/wa\.me\/51987654321\?text=/);
  assert.match(whatsappLink({ ...base, phone: "+51 987654321" })!, /^https:\/\/wa\.me\/51987654321\?text=/);
  assert.equal(whatsappLink({ ...base, phone: "123" }), null);
  assert.equal(whatsappLink(base), null);
});

test("el aviso trae el enlace de respuesta solo con el interruptor activo", () => {
  const alert = { reference: "C-1", jobId: "j", title: "t", customerName: "Ana", phone: "987654321" };
  assert.match(buildLeadAlertText(alert, undefined, true), /Responder: https:\/\/wa\.me\/51987654321/);
  assert.doesNotMatch(buildLeadAlertText(alert, undefined, false), /wa\.me/);
});

test("con botones (ntfy) el texto no repite los enlaces", () => {
  const alert = { reference: "C-1", jobId: "j", title: "t", customerName: "Ana", phone: "987654321" };
  const text = buildLeadAlertText(alert, "https://app.construyer.com", true, true);
  assert.match(text, /Tel: 987654321/);
  assert.doesNotMatch(text, /wa\.me|Ver:|Responder:/);
});

test("el mensaje de WhatsApp cita lo que escribió el cliente, sin depender del código", () => {
  const base = { reference: "C-1", jobId: "j", title: "t", customerName: "Ana", category: "pintura", district: "La Punta", summary: "Pintar\nhabitación   completa" };
  assert.equal(
    whatsappMessage(base),
    [
      "Hola Ana, te escribimos de *Construyer*.",
      "",
      "Recibimos tu solicitud:",
      "• *Servicio:* Pintura",
      "• *Zona:* La Punta",
      "• *Detalle:* «Pintar habitación completa»",
      "",
      "¿Te parece si coordinamos los detalles?",
    ].join("\n"),
  );
  assert.match(whatsappMessage({ ...base, summary: "x".repeat(300) }), /x{157}…»/);
  const contacto = whatsappMessage({ reference: "C-1", jobId: "j", title: "t", customerName: "Ana", summary: "Consulta" });
  assert.ok(contacto.includes("Recibimos tu mensaje:\n• *Detalle:* «Consulta»"));
  assert.ok(whatsappMessage({ reference: "C-9", jobId: "j", title: "t", customerName: "Ana" }).includes("Recibimos tu solicitud C-9."));
});

test("el aviso muestra lo que escribió el cliente, resumido", () => {
  const alert = { reference: "C-1", jobId: "j", title: "t", customerName: "Ana", summary: "Fuga de agua\nbajo el lavadero" };
  assert.match(buildLeadAlertText(alert, undefined), /Pidió: «Fuga de agua bajo el lavadero»/);
  assert.match(buildLeadAlertText({ ...alert, summary: "y".repeat(500) }, undefined), /Pidió: «y{219}…»/);
  assert.doesNotMatch(buildLeadAlertText({ ...alert, summary: undefined }, undefined), /Pidió/);
});

test("el aviso de ntfy usa Markdown: títulos en negrita, un dato por línea y texto del cliente escapado", () => {
  const md = buildLeadAlertMarkdown(
    { reference: "C-1", jobId: "j", title: "t", customerName: "Ana", category: "Pintura", district: "La Punta", summary: "Pintar *todo* [ya]", when: "Hoy", phone: "987654321" },
    true,
  );
  assert.equal(
    md,
    ["- **Servicio:** Pintura", "- **Zona:** La Punta", "- **Cliente:** Ana", "- **Pidió:** «Pintar \\*todo\\* \\[ya\\]»", "- **Cuándo:** Hoy", "- **Teléfono:** 987654321"].join("\n"),
  );
  assert.doesNotMatch(buildLeadAlertMarkdown({ reference: "C-1", jobId: "j", title: "t", customerName: "Ana", phone: "987654321" }, false), /Teléfono/);
});

test("las solicitudes del modo empresa muestran la empresa en el aviso y en el correo", () => {
  const alert = { reference: "C-1", jobId: "j", title: "t", customerName: "Ana", company: "Edificio Los Álamos", category: "Otro", district: "Surco" };
  assert.match(buildLeadAlertMarkdown(alert), /- \*\*Empresa:\*\* Edificio Los Álamos/);
  assert.match(buildLeadEmailText(alert, undefined), /Empresa: Edificio Los Álamos/);
  assert.doesNotMatch(buildLeadAlertMarkdown({ ...alert, company: undefined }), /Empresa/);
});
