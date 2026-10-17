import assert from "node:assert/strict";
import test from "node:test";
import { buildLeadAlertText, buildLeadEmailText, whatsappLink } from "../src/lead-alert.js";

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

test("el aviso puede omitir el enlace de respuesta (ntfy ya trae el botón)", () => {
  const alert = { reference: "C-1", jobId: "j", title: "t", customerName: "Ana", phone: "987654321" };
  const text = buildLeadAlertText(alert, undefined, true, false);
  assert.match(text, /Tel: 987654321/);
  assert.doesNotMatch(text, /wa\.me/);
});
