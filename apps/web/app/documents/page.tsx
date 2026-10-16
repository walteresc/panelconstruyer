import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const documentTypes = [
  {
    title: "Facturas",
    description: "Facturas y recibos para el cliente, generados a partir de los conceptos y pagos reales.",
    href: "/invoices",
  },
  {
    title: "Cotizaciones",
    description: "Vistas previas de cotizaciones para el cliente, generadas a partir de los totales y conceptos del trabajo.",
    href: "/estimates",
  },
];

export default function DocumentsPage() {
  return (
    <div>
      <PageHeader
        title="Documentos"
        description="Base de documentos con tu marca: facturas, cotizaciones, recibos, órdenes de trabajo y planes de mantenimiento."
      />

      <Card className="mb-6 border-accent/30 bg-accent/5">
        <p className="text-sm text-fg-muted">
          Los documentos se generan en HTML y se pueden imprimir o guardar como PDF.
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {documentTypes.map((item) => (
          <Card key={item.title} className="flex flex-col justify-between gap-5">
            <div>
              <h2 className="text-lg font-semibold text-fg">{item.title}</h2>
              <p className="mt-2 text-sm text-fg-muted">{item.description}</p>
            </div>
            <Link href={item.href}>
              <Button size="sm" variant="secondary">Abrir</Button>
            </Link>
          </Card>
        ))}
      </div>

    </div>
  );
}
