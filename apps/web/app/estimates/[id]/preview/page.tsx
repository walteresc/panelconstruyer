import Link from "next/link";
import { api } from "@/lib/api";
import { estimateDocumentHtml } from "@/lib/document-data";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { DocumentPreviewWorkbench } from "@/components/document-preview-workbench";

export default async function EstimatePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [estimate, jobs, customers, org] = await Promise.all([
    api.estimate(id).catch(() => null),
    api.jobs().catch(() => []),
    api.customers().catch(() => []),
    api.org().catch(() => null),
  ]);

  if (!estimate) {
    return (
      <div>
        <PageHeader title="Vista previa de la cotización no disponible" description={`ID de la cotización: ${id}`} />
        <Card>
          <EmptyState title="Sin datos de la cotización" description="Verifica el identificador de la cotización o la conexión con la API." />
        </Card>
      </div>
    );
  }

  const job = jobs.find((row) => row.id === estimate.jobId) ?? null;
  const customer = job ? customers.find((row) => row.id === job.customerId) ?? null : null;
  const html = estimateDocumentHtml({ estimate, customer, job, lineItems: estimate.lineItems, org });
  const estimateNumber = estimate.number;
  const variants = estimate.status === "approved" ? undefined : estimate.options.map((option) => ({
    id: option.id,
    label: option.label,
    html: estimateDocumentHtml({
      estimate: { ...estimate, selectedOptionId: option.id },
      customer,
      job,
      lineItems: estimate.lineItems,
      org,
    }),
  }));

  return (
    <div>
      <PageHeader
        title={`Preview ${estimateNumber}`}
        description="Vista previa del documento de cotización para el cliente."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`/estimates/${estimate.id}/document.html`} target="_blank">
              <Button size="sm" variant="secondary">Abrir vista del cliente</Button>
            </Link>
            {job && (
              <Link href={`/jobs/${job.id}`}>
                <Button size="sm" variant="secondary">Volver al trabajo</Button>
              </Link>
            )}
          </div>
        }
      />
      <DocumentPreviewWorkbench
        documents={[{ id: "estimate", label: "Cotización", html, variants }]}
        fileName={`${estimateNumber}.html`}
      />
    </div>
  );
}
