// Runnable check (no DB needed):  node --import tsx --test test/notify-transform.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isNotifyTransform,
  formatNotification,
  toNotificationDelivery,
} from "../src/plugins/notify-transform.ts";

test("isNotifyTransform recognizes native targets only", () => {
  for (const t of ["slack", "discord", "ntfy"]) assert.equal(isNotifyTransform(t), true);
  for (const t of ["generic", "", "webhook"]) assert.equal(isNotifyTransform(t), false);
});

test("formatNotification renders money in dollars and includes key fields", () => {
  assert.match(formatNotification("job.created", { title: "AC tune-up" }), /AC tune-up/);
  assert.equal(
    formatNotification("invoice.paid", { number: "INV-1001", total: 18900 }),
    "✅ Factura INV-1001 pagada — S/\u00A0189.00",
  );
  assert.equal(
    formatNotification("payment.received", { number: "INV-1001", amount: 5000, method: "card" }),
    "💵 Pago S/\u00A050.00 (card) en INV-1001",
  );
});

test("formatNotification tolerates missing fields", () => {
  assert.equal(formatNotification("invoice.created", {}), "🧾 Factura  creada — S/\u00A00.00");
  assert.equal(formatNotification("unknown.event", {}), "Construyer: unknown.event");
});

test("toNotificationDelivery shapes Slack payload", () => {
  const d = toNotificationDelivery("slack", "job.created", { title: "Fix furnace" });
  assert.equal(d.headers["content-type"], "application/json");
  assert.deepEqual(JSON.parse(d.body), { text: "🆕 Nuevo trabajo: Fix furnace" });
});

test("toNotificationDelivery shapes Discord payload", () => {
  const d = toNotificationDelivery("discord", "job.created", { title: "Fix furnace" });
  assert.deepEqual(JSON.parse(d.body), { content: "🆕 Nuevo trabajo: Fix furnace" });
});

test("toNotificationDelivery shapes ntfy as plain text with a title header", () => {
  const d = toNotificationDelivery("ntfy", "invoice.paid", { number: "INV-2", total: 1000 });
  assert.equal(d.headers["content-type"], "text/plain");
  assert.equal(d.headers.Title, "Construyer · invoice.paid");
  assert.equal(d.body, "✅ Factura INV-2 pagada — S/\u00A010.00");
});
