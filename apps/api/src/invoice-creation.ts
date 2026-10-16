export interface ExistingInvoiceSummary {
  id: string;
  number: string;
  status: string;
}

export type InvoiceCreationBlock =
  | {
      statusCode: 400;
      body: {
        error: "el trabajo no tiene un total facturable";
        hint: "Agrega al menos un concepto facturable antes de crear una factura.";
      };
    }
  | {
      statusCode: 409;
      body: {
        error: "el trabajo ya tiene una factura activa";
        invoice: ExistingInvoiceSummary;
      };
    };

export function validateInvoiceCreation(
  jobTotal: number,
  existingInvoice?: ExistingInvoiceSummary,
): InvoiceCreationBlock | null {
  if (jobTotal <= 0) {
    return {
      statusCode: 400,
      body: {
        error: "el trabajo no tiene un total facturable",
        hint: "Agrega al menos un concepto facturable antes de crear una factura.",
      },
    };
  }

  if (existingInvoice) {
    return {
      statusCode: 409,
      body: {
        error: "el trabajo ya tiene una factura activa",
        invoice: existingInvoice,
      },
    };
  }

  return null;
}
