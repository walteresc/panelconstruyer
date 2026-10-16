import assert from "node:assert/strict";
import test from "node:test";
import { buildLeadAlertText } from "../src/lead-alert.js";

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
