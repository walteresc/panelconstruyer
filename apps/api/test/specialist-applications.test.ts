import assert from "node:assert/strict";
import test from "node:test";
import { requiredRolesForRequest } from "../src/operational-authorization.js";
import { buildApplicationAlertText, buildApplicationEmailText } from "../src/lead-alert.js";
import { affiliateBody } from "../src/routes/specialist-applications.js";

const valid = {
  applicantType: "cuadrilla",
  companyName: "Cuadrilla Los Andes",
  name: "Juan Pérez",
  phone: "987654321",
  specialties: ["Techos y coberturas", "Estructuras metálicas"],
  primarySpecialty: "Techos y coberturas",
  availability: "Tiempo completo (lunes a sábado)",
  districts: "Surco, La Molina",
  years: "8",
  mobility: "Moto",
  tools: "Soldadora, taladro",
  experience: "Coberturas ligeras y estructuras en viviendas.",
};

test("la postulación exige tipo, especialidad principal entre las elegidas y no pide documento", () => {
  assert.equal(affiliateBody.safeParse(valid).success, true);
  assert.equal(affiliateBody.safeParse({ ...valid, applicantType: "otro" }).success, false);
  assert.equal(affiliateBody.safeParse({ ...valid, primarySpecialty: "Pintura" }).success, false);
  assert.equal(affiliateBody.safeParse({ ...valid, specialties: [] }).success, false);
  assert.equal(affiliateBody.safeParse({ ...valid, availability: "" }).success, false);
  const { companyName: _company, tools: _tools, ...minimal } = valid;
  assert.equal(affiliateBody.safeParse(minimal).success, true);
  // un documento enviado en el formulario inicial se ignora: se registra en la validación posterior
  const parsed = affiliateBody.safeParse({ ...valid, document: "12345678" });
  assert.equal(parsed.success && "document" in parsed.data, false);
});

test("las postulaciones solo las ven y gestionan owner y dispatcher", () => {
  assert.deepEqual(requiredRolesForRequest("GET", "/api/specialist-applications"), ["owner", "dispatcher"]);
  assert.deepEqual(requiredRolesForRequest("GET", "/api/specialist-applications?status=new"), ["owner", "dispatcher"]);
  assert.deepEqual(requiredRolesForRequest("PATCH", "/api/specialist-applications/abc"), ["owner", "dispatcher"]);
  assert.equal(requiredRolesForRequest("POST", "/api/public/affiliates"), null);
});

test("el aviso de ntfy no lleva teléfono y el correo sí", () => {
  assert.doesNotMatch(buildApplicationAlertText(valid), /987654321/);
  assert.match(buildApplicationAlertText(valid), /Especialidad principal: Techos y coberturas/);
  assert.match(buildApplicationEmailText(valid, "https://app.construyer.com"), /Teléfono: 987654321/);
  assert.match(buildApplicationEmailText(valid, "https://app.construyer.com/"), /https:\/\/app\.construyer\.com\/applications$/);
});
