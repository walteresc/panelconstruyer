// Etiquetas en español para los valores internos (que siguen en inglés en la API y la base de datos).

const JOB_STATUS: Record<string, string> = {
  lead: "Solicitud",
  scheduled: "Programado",
  in_progress: "En curso",
  completed: "Terminado",
  canceled: "Cancelado",
};

const INVOICE_STATUS: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviada",
  paid: "Pagada",
  void: "Anulada",
};

const ESTIMATE_STATUS: Record<string, string> = {
  draft: "Borrador",
  pending: "Pendiente",
  sent: "Enviada",
  accepted: "Aceptada",
  approved: "Aprobada",
  declined: "Rechazada",
  expired: "Vencida",
};

const PAYMENT_METHOD: Record<string, string> = {
  manual: "Manual",
  card: "Tarjeta",
  cash: "Efectivo",
  check: "Cheque",
};

const ROLE: Record<string, string> = {
  owner: "Propietario",
  dispatcher: "Coordinador",
  technician: "Especialista",
};

const PLAN_STATUS: Record<string, string> = {
  active: "Activo",
  expired: "Vencido",
  canceled: "Cancelado",
  paused: "Pausado",
};

const fallback = (value: string) => value.replaceAll("_", " ");

export const jobStatusLabel = (status: string) => JOB_STATUS[status] ?? fallback(status);
export const invoiceStatusLabel = (status: string) => INVOICE_STATUS[status] ?? fallback(status);
export const estimateStatusLabel = (status: string) => ESTIMATE_STATUS[status] ?? fallback(status);
export const paymentMethodLabel = (method: string) => PAYMENT_METHOD[method] ?? fallback(method);
export const roleLabel = (role: string) => ROLE[role] ?? fallback(role);
export const planStatusLabel = (status: string) => PLAN_STATUS[status] ?? fallback(status);
