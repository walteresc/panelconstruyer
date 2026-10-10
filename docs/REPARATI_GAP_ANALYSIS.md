# Gap analysis: OpenFieldPro vs necesidades de Reparati

Basado en la auditoría local (ver `REPARATI_AUDIT.md`). Esfuerzo: S ≤ 3 días · M ≈ 1–2 semanas · L ≈ 3–6 semanas · XL > 6 semanas (estimaciones gruesas de una persona, sin validar).

| Necesidad Reparati | Existe | Parcial | No existe | Observaciones | Esfuerzo |
|---|:-:|:-:|:-:|---|:-:|
| Clientes (persona/empresa, múltiples teléfonos, WhatsApp, email) | | ✔ | | `customers`: name, email, phone, notes. Falta tipo persona/empresa, RUC/DNI, WhatsApp y teléfonos múltiples | S |
| Propiedades por cliente (dirección, distrito, referencias, historial) | | ✔ | | `properties` ligada a cliente: address + lat/lng (texto). Falta distrito, referencias, tipo; historial vía jobs | S–M |
| Solicitudes (descripción, categoría, fotos, urgencia, fecha, canal) | | ✔ | | `POST /api/public/:orgId/book` y `/jobs/new` crean `lead`. Falta categoría, urgencia, canal, fotos en la solicitud | M |
| Cotizaciones (precio cliente, alcance, materiales, impuestos, aprobación) | ✔ | | | Estimates con opciones, líneas, impuestos (`taxRateBps`), depósito, firma, aprobación por portal | S (config/localización) |
| Despacho / dispatch | ✔ | | | Tablero con carriles por técnico, drag & drop, conflictos. Requiere técnicos con rol | S |
| Órdenes de servicio (asignación, horario, estado, notas) | | ✔ | | `jobs` + `appointments`. Estados `lead/scheduled/in_progress/completed/canceled`; faltan estados de aceptación/en camino/llegué/garantía | M |
| Operarios afiliados (especialidades, cobertura, documentos, herramientas, movilidad, disponibilidad) | | | ✔ | `users` solo tiene rol y activo. Requiere perfil de afiliado y almacenamiento de documentos | L |
| Costo interno / pago al operario | | ✔ | | `jobs.labor_cost_cents` y `catalog_items.cost_cents`. Falta pago por operario y por trabajo | M |
| Margen Reparati (cliente vs operario + materiales) | | ✔ | | Hay datos de costo y precio; no hay cálculo ni reporte de margen por trabajo | M |
| Adelantos y liquidación al operario | | | ✔ | No hay entidad de liquidaciones ni pagos a operarios | L |
| App móvil de operario | | ✔ | | Tablero de lectura + offline de diagnósticos. Sin login, detalle, estados ni acciones | XL |
| Aceptar/rechazar trabajo, en camino, llegué, iniciar, finalizar | | | ✔ | No existe en API ni en móvil | L |
| Fotos antes/durante/después | | ✔ | | `photos` por job con subida validada. Falta etiqueta de fase y subida desde móvil | M |
| Checklist de ejecución | | | ✔ | Solo workflows de diagnóstico (vertical electrodomésticos), no checklists genéricos por servicio | M–L |
| Materiales usados | | ✔ | | `line_items` con costo/precio por job; falta registro desde campo y stock | M |
| Garantías y retrabajo | | ✔ | | Tablas `correction_reports` (diagnósticos) y planes de servicio; no hay garantía por trabajo ni retrabajo | M |
| Conformidad del cliente | | ✔ | | Portal con aprobación de estimate y `reviews`; no hay conformidad de cierre de trabajo | S–M |
| Pagos (cobro al cliente) | ✔ | | | Pagos manuales + Stripe opcional. Moneda fija `usd`; Perú requeriría pasarela local (Culqi/Niubiz/Yape) o solo manual | M |
| Facturación electrónica SUNAT | | | ✔ | No existe; invoices genéricas. Requiere integración con OSE/PSE | XL |
| Localización es-PE / PEN / IGV / zona horaria | | ✔ | | Impuestos configurables; UI solo en inglés, moneda sin campo, zona demo Denver | M |
| Cobertura (distritos por operario/zona) | | | ✔ | PostGIS disponible en la imagen pero sin uso | M |
| Especialidades / categorías de servicio | | ✔ | | `catalog_categories` sirve para el catálogo, no para skills de operario | S–M |
| Rating interno de operarios | | ✔ | | `reviews` por job y `technician-scorecards` en reportes; falta rating interno y reclamos | M |
| WhatsApp | | | ✔ | Solo manifiesto de plugin Twilio sin lógica; worker solo ntfy. `message_logs` + SMTP existen como base | L |
| API pública Reparati | | ✔ | | Solo `POST /api/public/:orgId/book`, `GET /:orgId`, portal por token y `/api/v1` con tokens. Falta contrato de solicitudes con fotos, catálogo, seguimiento | M |
| Seguimiento del cliente (sin elegir técnico) | | ✔ | | Portal por token (`/p/[token]`, `/portal/[id]`) muestra estimates/invoices; falta línea de tiempo del servicio | M |
| Cliente no elige ni compara técnicos | ✔ | | | El modelo actual no expone técnicos al cliente; hay que asegurar que el portal no los muestre | S |
| Roles y permisos (afiliado externo, finanzas) | | ✔ | | `owner/dispatcher/technician`; falta aislamiento de datos económicos para afiliados | M |
| Reportes | ✔ | | | Ingresos, aging, conversión, scorecards de técnicos; ajustar a márgenes y liquidaciones | S–M |
| Tienda (productos + instalación) | | | ✔ | No existe; catálogo/price book es para servicios | XL |
| Recurrentes / mantenimiento empresas | ✔ | | | `recurring_jobs`, `service_plans` con visitas | S |
| Backups, upgrades, mantenimiento | ✔ | | | Controlador de operaciones, backups cifrados, restore con prueba | S (validar) |

## Lectura rápida

- **Se reutiliza casi tal cual**: CRM, estimates, facturas, dispatch, calendario, portal, documentos, reportes, planes recurrentes, backups.
- **Se extiende**: solicitudes (categoría/urgencia/fotos), propiedades, estados de trabajo, materiales, fotos por fase, localización, API pública, seguimiento.
- **Se construye**: perfil y economía del operario afiliado, liquidaciones, app móvil operativa, checklists, garantías/retrabajo, cobertura, WhatsApp, (opcional) facturación SUNAT y tienda.
- El mayor bloque de trabajo es el **flujo operario**: asignación → aceptación → ejecución en campo (móvil) → evidencias → liquidación.
