# Auditoría técnica de OpenFieldPro para Reparati

Fecha: 2026-10-10 · Rama: `feature/reparati-openfieldpro-audit` · Alcance: auditoría + puesta en marcha local. No se cambió branding, modelo de datos ni flujos.

## 1. Arquitectura general

Monorepo pnpm (`pnpm@9.0.0`, Node >= 22; probado con Node 24.21).

| Workspace | Tecnología | Rol |
|---|---|---|
| `apps/api` | Fastify 5 + TypeScript + Drizzle + Zod | API REST (`/api/...`), auth JWT, PDFs (pdfkit), correo (nodemailer), Stripe opcional |
| `apps/web` | Next.js 15 (App Router), React 18, Tailwind 4 | Panel interno (UI en inglés, `<html lang="en">`) |
| `apps/mobile` | Expo SDK 52, React Native 0.76, expo-sqlite | App técnico: tablero de solo lectura + paquetes offline de diagnóstico |
| `apps/worker` | Node (polling, sin BullMQ aún) | Genera trabajos recurrentes, recordatorios de citas y reintentos de plugins; notifica por ntfy |
| `packages/db` | Drizzle ORM + postgres.js | Esquema, migraciones (`drizzle/0000–0018`), seed |
| `packages/shared` | TypeScript | Tipos/validaciones compartidas |
| `packages/plugin-sdk` | TypeScript | Manifiestos y eventos de plugins |

Otros: `landing/`, `infra/` (Caddy, compose), `deploy.sh|ps1`, `scripts/` (release-safety, lockfile, backups cifrados), `docs/` (plan, paridad HCP, release checklist).

## 2. Instalación

```bash
npm i -g pnpm@9.0.0          # si no está instalado
pnpm install --frozen-lockfile
node scripts/verify-lockfile.mjs
```

Se añadió `.npmrc` con `public-hoist-pattern[]=@babel/runtime` (ver §16: sin esto Metro/Expo no resuelve el módulo bajo pnpm).

## 3. Infraestructura local

`infra/compose.yml` (original) usa puertos fijos 5432/6379/9000/9001/8080, que pueden chocar con otras apps. Se añadió `infra/compose.dev.yml` (solo Postgres+PostGIS y Redis, contenedores `reparati-ofp-*`, volumen nombrado):

```bash
docker compose -f infra/compose.dev.yml up -d     # Postgres 5440, Redis 6390
```

## 4. Variables de entorno

Plantilla: `.env.example`. Para desarrollo se creó `.env` local (ignorado por git) con:

| Variable | Valor local |
|---|---|
| `DATABASE_URL` | `postgres://ofp:ofp@localhost:5440/ofp` |
| `REDIS_URL` | `redis://localhost:6390` |
| `API_PORT` | `3401` |
| `JWT_SECRET` | secreto de desarrollo (en producción se rechazan valores por defecto o < 32 chars) |
| `CORS_ORIGIN` | `http://localhost:3400` |
| `NEXT_PUBLIC_API_URL` / `INTERNAL_API_URL` / `PUBLIC_API_URL` | `http://localhost:3401` |
| `PUBLIC_WEB_URL` | `http://localhost:3400` |
| `ALLOW_SCHEMA_PUSH` | `true` (necesario para `db:migrate`; en producción debe ser `false`) |
| `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_AUTH_TOKEN`, `EXPO_PUBLIC_ORG_ID` | ver §7 |

**No** poner `NODE_ENV=development` en `.env`: hace fallar `next build` (`<Html> should not be imported...`). Opcionales sin configurar: SMTP, Stripe, `NTFY_URL`, S3, claves de licencia.

## 5. Puertos usados en este entorno

3000 y 3200 estaban ocupados por otras apps, así que:

| Servicio | URL |
|---|---|
| Web (panel) | http://localhost:3400 (el script `dev` de web fija `-p 3000`; se arranca con `pnpm exec next dev -p 3400`) |
| API | http://localhost:3401 (health: `/api/health`) |
| Postgres | localhost:5440 |
| Redis | localhost:6390 |
| Metro/Expo | http://localhost:8081 |

## 6. Comandos para levantar

```bash
set -a; . ./.env; set +a                    # bash. En PowerShell, cargar las variables a mano
pnpm db:migrate && pnpm db:seed             # una vez
(cd apps/api && pnpm dev)                   # API :3401
(cd apps/web && pnpm exec next dev -p 3400) # Web :3400
```

Credenciales demo del seed: `owner@demo.test` / `demo12345` (rol owner). El seed no crea técnicos.

## 7. App móvil

La app **no tiene pantalla de login**: toma el token por variable de entorno.

```bash
TOKEN=$(curl -s -X POST localhost:3401/api/auth/login -H 'content-type: application/json' \
  -d '{"email":"owner@demo.test","password":"demo12345"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
cd apps/mobile
EXPO_PUBLIC_API_URL=http://<IP-LAN-del-PC>:3401 EXPO_PUBLIC_AUTH_TOKEN=$TOKEN \
EXPO_PUBLIC_ORG_ID=<uuid de orgs.id> pnpm exec expo start
```

Escanear el QR con Expo Go (el teléfono debe estar en la misma red; `localhost` no sirve en dispositivo físico). Expo Web no funciona: falta `react-native-web`. El token expira (12 h).

Verificado: typecheck OK; `expo export --platform android` genera el bundle Hermes (559 módulos); Metro arranca. **No se probó en dispositivo/emulador** (no hay).

## 8. Servicios externos

- Opcionales y apagados por defecto: Stripe (checkout + webhook), SMTP (envío de documentos/portal), ntfy, S3 (réplica de backups), claves de licencia de soporte.
- Plugins "first-party" sembrados (Slack, Discord, ntfy, Google Maps, Twilio SMS, Resend, Mailchimp, QuickBooks, Zapier) son **manifiestos**; no hay integración real para Twilio/WhatsApp (el worker solo implementa ntfy; el código dice "Twilio/Resend slot in here later").
- Moneda del checkout Stripe fijada en `"usd"` (`routes/invoices.ts`, `routes/portal.ts`).

## 9. Base de datos

PostgreSQL 16 + PostGIS, Drizzle ORM. `db:check` OK; `db:migrate` aplica las 19 migraciones; `db:parity` verifica 38 tablas. Redis responde y la API lo reporta en `/api/health`.

## 10. Entidades principales

`orgs` (multi-tenant, branding, `business_settings` jsonb), `users` (roles `owner|dispatcher|technician`), `customers` (name, email, phone, notes), `properties` (address, lat/lng texto), `jobs` (estado `lead|scheduled|in_progress|completed|canceled`, `assigned_to`, `labor_cost_cents`, total), `appointments` (job + técnico + horario), `estimates` (+ `estimate_options`, líneas, depósito, firma, aprobación), `invoices` (+ líneas, pricing jsonb), `payments`, `line_items`, `catalog_items/categories` (price book con `cost_cents`), `photos` (por job), `documents` (PDF en bytea), `recurring_jobs`, `service_plans/enrollments/visits`, `reviews`, `portal_links`, `message_logs`, `notifications`, `activities`, `api_tokens`, `plugins/plugin_installs/plugin_events`, `equipment` y familia `diagnostic_*` (vertical de electrodomésticos).

## 11. Funcionalidades encontradas (verificadas)

Login y 22 rutas del panel cargan sin error con el seed: Today, New Job, Jobs, Dispatch board, Schedule, Closeout, Pipeline, Customers (+detalle, equipos), Estimates, Invoices & Payments, Service Plans, Documents, Price Book, Diagnostics, Diagnostic Library, Coverage, Reviews, Reports, Integrations, Settings, `/book` (reserva pública), portal de cliente (`/portal/[id]`, `/p/[token]`). La API expone ~116 rutas (customers, jobs, appointments, estimates, invoices, pagos manuales/Stripe, fotos, documentos, mensajes, reportes, búsqueda, tokens API `/api/v1`, plugins, sync offline, backups/restores/upgrades).

La API en vivo respondió 200 en `/api/jobs`, `/appointments`, `/customers`, `/diagnostics/sessions` con JWT.

Reserva pública existente: `POST /api/public/:orgId/book` (nombre, email, teléfono, título, descripción) crea cliente + job en `lead`, con rate limit (10/h por IP+org). Es la base natural para la futura API pública de Reparati.

## 12. Funcionalidades incompletas o limitadas

- App móvil: un único tablero (próximo trabajo, citas, sesiones de diagnóstico) con caché SQLite y cola de escrituras **solo para diagnósticos** (mediciones/correcciones). No hay login, detalle de trabajo, cambios de estado, fotos, checklist ni materiales.
- Sin técnicos en el seed → el dispatch aparece vacío.
- UI completamente en inglés, moneda USD, zona horaria demo `America/Denver`, texto "Open field-service operations".
- El script `dev` de web fija el puerto 3000.
- Sin script `lint` en el monorepo.

## 13. Qué encaja directamente con Reparati

CRM de clientes/propiedades, jobs y citas, dispatch con carriles por técnico y prevención de conflictos, estimates con opciones/depósito/aprobación, facturas y pagos manuales, price book con costo vs precio, fotos por trabajo, documentos PDF con branding, portal de cliente por token, notificaciones, reviews, plan de servicio, rastreo de actividad, plugins/API tokens, backups cifrados, multi-tenant. Reserva pública `lead`.

## 14. Qué falta desarrollar

Ver `docs/REPARATI_GAP_ANALYSIS.md`. En resumen: perfil de operario afiliado (especialidades, cobertura, documentos, costo interno, rating), economía por trabajo (pago operario, margen, adelantos, liquidación), flujo de asignación/aceptación y estados de ejecución del operario, app móvil operativa, fotos antes/durante/después, checklist, materiales, garantías/retrabajo, localización (es-PE, PEN, IGV), WhatsApp, API pública Reparati, seguimiento de cliente sin elegir técnico.

## 15. Resultados de validación

| Chequeo | Resultado |
|---|---|
| `pnpm install --frozen-lockfile` | OK (964 paquetes) |
| `node scripts/verify-lockfile.mjs` | OK |
| `pnpm release:safety` | 12/12 pruebas OK |
| `pnpm db:check` / `db:parity` | OK / 38 tablas |
| Tests API | 226/226 |
| Tests worker / shared / plugin-sdk | 3/3 · 2/2 · 5/5 |
| Tests web (unit) | 14/14 |
| `@ofp/api build` (tsc) | OK |
| `@ofp/web build` (con `NODE_ENV=production`) | OK |
| `@ofp/mobile typecheck` | OK |
| `expo export --platform android` | OK |
| Lint | No existe script `lint` en el repo |
| E2E Playwright (`test:e2e`) | **No ejecutado** |
| Mobile `mirror.test.ts` | **No ejecutado** (sin script de test) |
| Prueba en dispositivo/emulador | **No realizada** |

## 16. Riesgos técnicos

1. **Vulnerabilidades en dependencias de producción** (`pnpm audit --prod`): 66 (4 críticas, 39 altas), incluidas `next` (RCE en Windows hosts / optimizador de imágenes), `fast-jwt` (JWT sin firma aceptado en ciertas condiciones), `fastify` (bypass de autenticación por URL malformada) y `shell-quote`. El repo ya aplica overrides (`fast-jwt`, `undici`, etc.) y lleva `docs/release/dependency-advisories.json`; hay que revisar y subir versiones menores/parches antes de exponer algo a internet. No se tocó nada en esta fase.
2. **Metro + pnpm**: sin hoisting de `@babel/runtime` el bundle móvil falla. Solución aplicada vía `.npmrc` (no altera el lockfile).
3. `react-native` 0.76.0 instalado vs 0.76.9 esperado por Expo 52 (aviso de Expo).
4. Documentos PDF almacenados como `bytea` en Postgres: crecerá la BD.
5. `properties.lat/lng` son texto; PostGIS está en la imagen pero el esquema no lo usa para cobertura.
6. Importes en enteros (centavos) sin campo de moneda: localizar a PEN exige tocar pricing, Stripe y documentos.
7. Roles solo `owner|dispatcher|technician`: sin rol de afiliado externo ni segregación de datos económicos.
8. El script de producción (`deploy.sh`) y `compose.prod.yml` no se probaron.

## 17. Licencia (resumen técnico, no es asesoría legal)

AGPL-3.0-only, © 2026 Nikolas Marconcini. Implicaciones:

- Cualquier modificación a este código (incluidos cambios de branding, esquema, API y app móvil) es obra derivada: si se **ofrece a usuarios por red** (SaaS interno o público, panel o API), hay que ofrecerles el **código fuente completo** de la versión modificada bajo AGPL-3.0. Aplica también a usuarios que son solo empleados/operarios de Reparati que interactúan por red con el panel.
- Si Reparati lo usa solo internamente sin permitir interacción de terceros por red, la obligación se activa al "conveyar" copias; pero un operario afiliado externo usando la app contra tu API probablemente cuenta como interacción remota. Consultar a un abogado.
- Se pueden mantener **separadas** (no derivadas) piezas que se comuniquen solo por interfaces públicas: `reparati-web` (Next.js propio) hablando con una API pública, siempre que no incorpore código AGPL. La API pública que corra **dentro** del código de OpenFieldPro sí sería AGPL; un servicio separado y propio (gateway) que llame a OFP por HTTP quedaría fuera, aunque conviene definir bien el límite.
- No eliminar avisos de copyright/licencia; el campo `remove_openfieldpro_attribution` es una opción del propio producto.
- Riesgo arquitectónico: mezclar código propietario de Reparati dentro de `apps/*` o `packages/*` lo somete a AGPL. Decidir temprano qué es AGPL (fork de OFP) y qué es propietario (web pública, gateway).

## 18. Próximos pasos recomendados

1. Aprobar esta auditoría y decidir el modelo de licencia/fork (§17).
2. Revisar y parchear dependencias críticas (§16.1) en rama aparte.
3. Localización mínima: es-PE, PEN, IGV 18 %, zona `America/Lima`.
4. Modelo de datos: operario afiliado + economía por trabajo + garantía/retrabajo.
5. Flujo de asignación interna y estados del operario; ampliar la app móvil (login, detalle, estados, fotos, checklist, materiales).
6. API pública de Reparati (base: `/api/public/:orgId/book`) y conexión con `reparati-web`.
7. WhatsApp (canal principal en Perú) como adaptador de mensajes.
