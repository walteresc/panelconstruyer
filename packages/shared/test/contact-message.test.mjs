import assert from "node:assert/strict";
import test from "node:test";
import { parseLeadDescription, whatsappContactMessage, whatsappDigits, whatsappUrl } from "../src/contact-message.ts";

test("normaliza celulares peruanos para WhatsApp", () => {
  assert.equal(whatsappDigits("987 654 321"), "51987654321");
  assert.equal(whatsappDigits("+51 987654321"), "51987654321");
  assert.equal(whatsappDigits("123"), null);
  assert.equal(whatsappDigits(null), null);
  assert.match(whatsappUrl("987654321", "Hola ¿qué tal?"), /^https:\/\/wa\.me\/51987654321\?text=Hola%20%C2%BFqu%C3%A9%20tal%3F$/);
});

test("lee la descripción que guarda la web pública", () => {
  const description = [
    "Categoría: Gasfitería",
    "Distrito: Jesús María",
    "Dirección o referencia: Av. Test 123",
    "Cuándo lo necesita: Esta semana",
    "",
    "Fuga de agua bajo el lavadero",
    "",
    "Origen: formulario de cotización de construyer.com",
  ].join("\n");
  assert.deepEqual(parseLeadDescription(description), {
    category: "Gasfitería",
    district: "Jesús María",
    summary: "Fuga de agua bajo el lavadero",
  });
  assert.deepEqual(parseLeadDescription("Cambiar grifería del baño"), { summary: "Cambiar grifería del baño" });
  assert.deepEqual(parseLeadDescription(null), {});
});

test("mensaje de contacto ordenado y citando el pedido", () => {
  const text = whatsappContactMessage({ customerName: "Ana", category: "pintura", district: "La Punta", summary: "Pintar la sala" });
  assert.equal(
    text,
    [
      "Hola Ana, te escribimos de *Construyer*.",
      "",
      "Recibimos tu solicitud:",
      "• *Servicio:* Pintura",
      "• *Zona:* La Punta",
      "• *Detalle:* «Pintar la sala»",
      "",
      "¿Te parece si coordinamos los detalles?",
    ].join("\n"),
  );
  assert.ok(whatsappContactMessage({ customerName: "Ana" }).includes("Recibimos tu solicitud."));
});
