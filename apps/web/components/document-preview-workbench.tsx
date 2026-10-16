"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export interface DocumentPreviewVariant {
  id: string;
  label: string;
  html: string;
}

export interface DocumentPreviewItem {
  id: string;
  label: string;
  html: string;
  variants?: DocumentPreviewVariant[];
}

export function DocumentPreviewWorkbench({
  documents,
  initialDocumentId,
  compact = false,
  fileName = "customer-document.html",
}: {
  documents: DocumentPreviewItem[];
  initialDocumentId?: string;
  compact?: boolean;
  fileName?: string;
}) {
  const [documentId, setDocumentId] = useState(initialDocumentId ?? documents[0]?.id ?? "");
  const [variantId, setVariantId] = useState("");
  const [viewport, setViewport] = useState<"page" | "phone">("page");
  const [zoom, setZoom] = useState(compact ? 50 : 75);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const activeDocument = documents.find((document) => document.id === documentId) ?? documents[0];
  const activeVariant = activeDocument?.variants?.find((variant) => variant.id === variantId) ?? activeDocument?.variants?.[0];
  const html = activeVariant?.html ?? activeDocument?.html ?? "";

  useEffect(() => {
    setVariantId(activeDocument?.variants?.[0]?.id ?? "");
  }, [activeDocument?.id]);

  const downloadHtml = () => {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName.endsWith(".html") ? fileName : `${fileName}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const frameWidth = viewport === "phone" ? 390 : 900;
  const frameHeight = compact ? 1040 : 1120;
  const scale = viewport === "phone" ? 1 : zoom / 100;

  return (
    <Card className="overflow-hidden p-0" data-testid="document-preview-workbench">
      <div className="border-b border-border bg-surface-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-fg">Vista del cliente</h3>
              <span className="rounded-full border border-green/25 bg-green/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green">Vista previa en vivo</span>
            </div>
            <p className="mt-1 text-xs text-fg-muted">Los cambios aparecen aquí antes de guardarlos o enviarlos.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-border bg-surface-200 p-1" aria-label="Tamaño de la vista previa">
              <button type="button" aria-pressed={viewport === "page"} onClick={() => setViewport("page")} className={`min-h-8 rounded-md px-2.5 text-xs font-semibold ${viewport === "page" ? "bg-surface-50 text-fg shadow-sm" : "text-fg-muted"}`}>Página</button>
              <button type="button" aria-pressed={viewport === "phone"} onClick={() => setViewport("phone")} className={`min-h-8 rounded-md px-2.5 text-xs font-semibold ${viewport === "phone" ? "bg-surface-50 text-fg shadow-sm" : "text-fg-muted"}`}>Teléfono</button>
            </div>
            {viewport === "page" ? (
              <label className="flex items-center gap-2 text-xs text-fg-muted">
                Zoom
                <select aria-label="Zoom de la vista previa" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="h-9 rounded-lg border border-border bg-surface-50 px-2 text-xs text-fg">
                  <option value={50}>50%</option>
                  <option value={75}>75%</option>
                  <option value={100}>100%</option>
                </select>
              </label>
            ) : null}
            {!compact ? (
              <>
                <Button size="sm" variant="secondary" onClick={() => frameRef.current?.contentWindow?.print()}>Imprimir / PDF</Button>
                <Button size="sm" variant="secondary" onClick={downloadHtml}>Descargar HTML</Button>
              </>
            ) : null}
          </div>
        </div>

        {documents.length > 1 ? (
          <div role="tablist" aria-label="Tipo de documento" className="mt-4 flex flex-wrap gap-2">
            {documents.map((document) => (
              <button key={document.id} type="button" role="tab" aria-selected={activeDocument?.id === document.id} onClick={() => setDocumentId(document.id)} className={`min-h-9 rounded-lg border px-3 text-xs font-semibold ${activeDocument?.id === document.id ? "border-accent bg-accent text-surface-50" : "border-border bg-surface-100 text-fg-muted hover:text-fg"}`}>{document.label}</button>
            ))}
          </div>
        ) : null}

        {activeDocument?.variants?.length ? (
          <div className="mt-3 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Vista previa de la opción de la cotización">
            <span className="text-xs font-medium text-fg-muted">Opción seleccionada</span>
            {activeDocument.variants.map((variant) => (
              <button key={variant.id} type="button" role="radio" aria-checked={(activeVariant?.id ?? activeDocument.variants?.[0]?.id) === variant.id} onClick={() => setVariantId(variant.id)} className={`min-h-8 rounded-md border px-2.5 text-xs font-semibold ${(activeVariant?.id ?? activeDocument.variants?.[0]?.id) === variant.id ? "border-accent bg-accent-muted text-accent" : "border-border bg-surface-100 text-fg-muted"}`}>{variant.label}</button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="max-h-[860px] overflow-auto bg-surface-300 p-3 sm:p-5" aria-label="Lienzo de la vista previa">
        <div className="mx-auto overflow-hidden rounded-xl bg-white shadow-[0_18px_45px_rgba(17,24,39,0.14)]" style={{ width: frameWidth * scale, height: frameHeight * scale }}>
          <iframe
            ref={frameRef}
            title={`Vista previa para el cliente: ${activeDocument?.label ?? "Documento"}${activeVariant ? ` - ${activeVariant.label}` : ""}`}
            srcDoc={html}
            className="origin-top-left border-0 bg-white"
            style={{ width: frameWidth, height: frameHeight, transform: `scale(${scale})` }}
          />
        </div>
      </div>
    </Card>
  );
}
