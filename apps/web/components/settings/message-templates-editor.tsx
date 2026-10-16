"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  MESSAGE_TEMPLATE_REQUIRED_VARIABLES,
  MESSAGE_TEMPLATE_VARIABLES,
  messageTemplateSampleVariables,
  renderMessageTemplate,
  validateMessageTemplate,
  type MessageTemplateKind,
} from "@ofp/shared";
import type { BusinessSettingsDTO } from "@/lib/api";

interface EditorProps {
  settings: BusinessSettingsDTO;
  updateSettings: (next: BusinessSettingsDTO) => void;
  companyName: string;
}

const KINDS: Array<{
  kind: MessageTemplateKind;
  title: string;
  description: string;
  subjectField?: keyof BusinessSettingsDTO["messages"];
  bodyField: keyof BusinessSettingsDTO["messages"];
}> = [
  {
    kind: "invoice",
    title: "Correo de factura",
    description: "Se envía cuando mandas una factura por correo a un cliente.",
    subjectField: "invoiceEmailSubject",
    bodyField: "invoiceEmailBody",
  },
  {
    kind: "estimate",
    title: "Correo de cotización",
    description: "Se envía cuando mandas una cotización por correo a un cliente.",
    subjectField: "estimateEmailSubject",
    bodyField: "estimateEmailBody",
  },
  {
    kind: "portal_link",
    title: "Correo del enlace del portal",
    description: "Se envía cuando mandas a un cliente su enlace seguro del portal.",
    subjectField: "portalLinkSubject",
    bodyField: "portalLinkBody",
  },
  {
    kind: "review_request",
    title: "Mensaje de solicitud de reseña",
    description: "Se envía cuando pides a un cliente que deje una reseña.",
    bodyField: "reviewRequestBody",
  },
];

function TemplateCard({
  kind,
  title,
  description,
  subjectField,
  bodyField,
  messages,
  onMessagesChange,
  companyName,
}: {
  kind: MessageTemplateKind;
  title: string;
  description: string;
  subjectField?: keyof BusinessSettingsDTO["messages"];
  bodyField: keyof BusinessSettingsDTO["messages"];
  messages: BusinessSettingsDTO["messages"];
  onMessagesChange: (next: BusinessSettingsDTO["messages"]) => void;
  companyName: string;
}) {
  const subject = subjectField ? (messages[subjectField] ?? "") : "";
  const body = messages[bodyField] ?? "";

  // Required-variable coverage is per kind (subject or body may carry it), so
  // the combined template is validated once; a typo anywhere is still a hard
  // save error via the same rule on the API side.
  const validation = useMemo(() => validateMessageTemplate(`${subject}\n${body}`, kind), [subject, body, kind]);
  const sample = useMemo(() => messageTemplateSampleVariables(kind, companyName), [kind, companyName]);
  const available = MESSAGE_TEMPLATE_VARIABLES[kind];

  const unknown = validation.unknown;
  const missingRequired = validation.missingRequired;

  function appendVariable(name: string) {
    const current = body;
    const next = `${current}${current && !current.endsWith("\n") ? "\n" : ""}{{${name}}}`;
    onMessagesChange({ ...messages, [bodyField]: next });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-fg-muted">{description}</p>
      </CardHeader>
      <CardContent className="grid gap-4">
        {subjectField ? (
          <label className="grid gap-1.5 text-sm text-fg-muted">
            Asunto
            <Input
              value={subject}
              onChange={(event) => onMessagesChange({ ...messages, [subjectField!]: event.target.value })}
              placeholder={`e.g. ${available[0]} placeholder`}
            />
          </label>
        ) : null}
        <label className="grid gap-1.5 text-sm text-fg-muted">
          Mensaje
          <textarea
            value={body}
            onChange={(event) => onMessagesChange({ ...messages, [bodyField]: event.target.value })}
            rows={6}
            className="rounded-lg border border-border bg-surface-200 px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          />
        </label>

        {unknown.length > 0 ? (
          <div className="rounded-lg border border-red/30 bg-red/5 p-3 text-sm text-red">
            Variable desconocida{unknown.length > 1 ? "s" : ""}: {unknown.join(", ")}. Check the list below.
          </div>
        ) : null}
        {unknown.length === 0 && missingRequired.length > 0 ? (
          <div className="rounded-lg border border-yellow/40 bg-yellow/10 p-3 text-sm text-fg">
            Aviso: esta plantilla nunca usa {missingRequired.join(", ")} : el correo al cliente podría no incluirlo.
          </div>
        ) : null}

        <div>
          <p className="mb-1.5 text-xs font-medium text-fg-muted">Variables disponibles</p>
          <div className="flex flex-wrap gap-1.5">
            {available.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => appendVariable(name)}
                title={`Insertar {{${name}}} al final del mensaje`}
                className="rounded-full border border-border bg-surface-100 px-2 py-0.5 font-mono text-xs text-accent hover:border-accent/60 hover:bg-accent/10"
              >
                {`{{${name}}}`}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-fg-muted">Vista previa en vivo</p>
          <div className="rounded-lg border border-border bg-surface-100 p-3">
            <p className="text-sm font-semibold text-fg">{renderMessageTemplate(subject, sample)}</p>
            <pre className="mt-2 whitespace-pre-wrap text-sm text-fg">{renderMessageTemplate(body, sample)}</pre>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function MessageTemplatesEditor({ settings, updateSettings, companyName }: EditorProps) {
  const messages = settings.messages;
  const updateMessages = (next: BusinessSettingsDTO["messages"]) => {
    updateSettings({ ...settings, messages: next });
  };

  return (
    <div className="grid gap-4">
      <p className="text-sm text-fg-muted">
        Los correos son texto plano. Escribe el nombre de la variable entre llaves dobles: <code>{"{{variable}}"}</code> para insertar los valores reales. Las variables desconocidas impiden guardar; las que la plantilla debería usar se resaltan si faltan.
      </p>
      {KINDS.map((card) => (
        <TemplateCard
          key={card.kind}
          kind={card.kind}
          title={card.title}
          description={card.description}
          subjectField={card.subjectField}
          bodyField={card.bodyField}
          messages={messages}
          onMessagesChange={updateMessages}
          companyName={companyName}
        />
      ))}
    </div>
  );
}
