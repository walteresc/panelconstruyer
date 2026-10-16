import assert from "node:assert/strict";
import test from "node:test";
import { validateInvoiceCreation } from "../src/invoice-creation.js";

test("zero-value jobs cannot produce invoices", () => {
  assert.deepEqual(validateInvoiceCreation(0), {
    statusCode: 400,
    body: {
      error: "el trabajo no tiene un total facturable",
      hint: "Agrega al menos un concepto facturable antes de crear una factura.",
    },
  });
});

test("an active invoice blocks a duplicate", () => {
  assert.deepEqual(
    validateInvoiceCreation(25_000, { id: "inv-1", number: "INV-1001", status: "sent" }),
    {
      statusCode: 409,
      body: {
        error: "el trabajo ya tiene una factura activa",
        invoice: { id: "inv-1", number: "INV-1001", status: "sent" },
      },
    },
  );
});

test("a priced job without an active invoice is eligible", () => {
  assert.equal(validateInvoiceCreation(25_000), null);
});
