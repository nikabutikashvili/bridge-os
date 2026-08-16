# Bridge OS Challenge

A take-home SWE challenge foundation for a bridge portfolio management product. The application will ingest German Bauwerksbuch PDFs and turn their contents into structured, traceable data for monitoring, planning, budgeting, tender preparation, and evidence workflows.

This repository contains the engineering foundation, core bridge-management domain schema, development fixture, bridge portfolio, maintenance-planning, budgeting, and work-package experiences, deterministic Bauwerksbuch PDF ingestion, and a provider-neutral structured extraction pipeline with an OpenAI adapter. Live extraction is an explicit CLI operation and is never called during automated tests.

## Stack

- pnpm workspace with Turborepo
- TypeScript
- Next.js App Router in `apps/web`
- Fastify in `apps/api`
- PostgreSQL
- Drizzle ORM in `packages/db`
- Zod contracts and validation
- Vitest
- ESLint

## Repository Layout

```text
apps/
  api/        Fastify API, server composition, startup, routes, error handling
  web/        Next.js App Router shell
packages/
  contracts/ Shared Zod schemas and TypeScript contracts
  db/        Drizzle config, schema, connection, migrations, seed command
```

## Run Everything with Docker Compose

The fastest way to see the full application — Postgres, the Fastify API, and the Next.js web app — with no manual setup:

```sh
docker compose up --build
```

This builds every service, starts Postgres, runs Drizzle migrations, seeds the reviewable Musterbrücke Fiktivtal / A57 development fixture, then starts the API and web app once their dependencies are healthy:

- Web app: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:4000](http://localhost:4000) (`GET /health`)
- Postgres: `localhost:5432` (`bridge_os` / `bridge_os`)

No `.env` file or extra configuration is required for this path — model-backed extraction (`pnpm extract`, `pnpm fixtures:ingest`) still needs `OPENAI_API_KEY` and is not part of the automatic startup. Uploaded documents persist in a named Docker volume across restarts.

To stop everything:

```sh
docker compose down          # keep the database and uploaded documents
docker compose down -v       # also remove them
```

## Local Setup

The steps below run each service directly on your machine instead of in Docker — useful for active development.

1. Use Node.js 22 or newer.

2. Install dependencies:

   ```sh
   pnpm install
   ```

3. Create a local environment file:

   ```sh
   cp .env.example .env
   ```

4. Start PostgreSQL:

   ```sh
   docker compose up -d postgres
   ```

5. Generate and run migrations after schema changes:

   ```sh
   pnpm db:generate
   pnpm db:migrate
   ```

6. Seed the local development fixture:

   ```sh
   pnpm db:seed
   ```

7. Start development servers:

   ```sh
   pnpm dev
   ```

The API listens on `http://localhost:4000` by default. The web app reads `NEXT_PUBLIC_API_URL` and defaults to `http://localhost:4000`.

Uploaded PDFs are stored below `DOCUMENT_STORAGE_ROOT` (default `.data/documents`) and are limited by `DOCUMENT_MAX_UPLOAD_BYTES` (default 25 MiB). Both values are validated when the API starts.

To run model-backed extraction, also configure `EXTRACTION_MODEL`, `OPENAI_API_KEY`, and optionally `OPENAI_BASE_URL` and `EXTRACTION_MODEL_MAX_OUTPUT_TOKENS`. These variables are validated only by the extraction composition root, so the read API does not require model credentials.

For the five-document demo workflow, place the local PDFs in `fixtures/bauwerksbuch` and run:

```sh
pnpm fixtures:ingest
```

The fixture PDFs are intentionally Git-ignored and are never encoded as application data.

## Frontend Application

The Next.js application provides API-backed Portfolio, Planning, Budget, Work Packages, and Documents & Data Quality workspaces. The top bar searches bridge identity and location, findings, and recommendations, with keyboard navigation into the relevant bridge context. Planning uses URL-addressable lifecycle views and a contextual form that creates a managerial intervention without changing its source recommendation. Budget uses a URL-addressable planning year, editable approved amount, and transactional program-membership controls. Work Packages provides a preparation queue and source-backed planning drafts with explicit readiness gaps. Documents keeps deterministic parsing, model extraction, errors, and bridge information gaps visible without reducing them to an opaque score.

Reusable UI primitives live under `apps/web/src/components/ui`. They cover compact headings and tables, metrics, semantic status and condition badges, filters, loading/error/empty states, a contextual detail panel, provenance links, and timelines. Locale-aware formatters under `apps/web/src/lib/formatters.ts` use German date and numeric conventions while keeping missing values explicit.

## Bridge Portfolio API

The read-only API is versioned under `/api/v1`:

- `GET /api/v1/bridges` - portfolio summaries with pagination, filtering, and sorting
- `GET /api/v1/bridges/:id` - bridge overview and headline condition
- `GET /api/v1/bridges/:id/inspections`
- `GET /api/v1/bridges/:id/findings`
- `GET /api/v1/bridges/:id/recommendations`
- `GET /api/v1/bridges/:id/history`
- `GET /api/v1/bridges/:id/documents`
- `GET /api/v1/search?q=<term>&limit=<per-group-limit>` - grouped bridge, finding, and recommendation results

Portfolio filters are `road`, `conditionMin`, `conditionMax`, `inspectionStatus`, `recommendationUrgency`, and `findingStatus`. Sort fields are `condition`, `latestInspection`, `constructionYear`, and `name`; pagination uses `page` and `pageSize`.

Inspection status is derived from the latest inspection recorded for each partial structure. The earliest computable next due date determines `OVERDUE`, `DUE_SOON` (within 180 days), or `CURRENT`; absent cycle data yields `UNKNOWN` when no known due date needs attention. Responses expose workflow-focused projections rather than database rows, and finding/recommendation evidence includes document, page, excerpt, field, and source-versus-derived context.

Global search uses escaped PostgreSQL `ILIKE` substring matching over explicit text fields. `pg_trgm` GIN expression indexes cover the same bridge, finding, and recommendation search documents, while exact identifiers and prefix matches receive deterministic ordering priority.

## Maintenance Planning API

- `GET /api/v1/planning` - paginated work queue selected by lifecycle `view`
- `POST /api/v1/planning/interventions` - create one managerial intervention from an actionable recommendation

`recommended-unplanned` is a read view over source recommendations that do not have a planned intervention. The persisted intervention lifecycle is `PLANNED`, `BUDGETED`, `TENDER_PREPARATION`, `TENDERED_READY`, `IN_PROGRESS`, and `COMPLETED`. For the MVP, a recommendation can have at most one intervention; this keeps source inspection advice distinct from the organization's work type, planned year, quantity, and cost estimate.

Maintenance priority is deterministic and returns an ordered list of reasons rather than an opaque score. Policy version `maintenance-priority-v1` considers unresolved S/V/D ratings, recorded recommendation urgency, age from linked inspection evidence, inspection due state, condition deterioration, and latest traffic volume. Unknown inputs remain absent reasons. An agency-specific policy can replace this isolated function without changing persistence or the API response shape.

## Budget Program API

- `GET /api/v1/budget?year=2026` - year program, intervention estimates, membership, and exact cost summary
- `PUT /api/v1/budget/:year` - set or clear the approved planning amount
- `PUT /api/v1/budget/:year/interventions/:interventionId` - include or exclude one same-year intervention transactionally

One budget program exists per planning year. PostgreSQL composite foreign keys prevent an intervention from being placed in a program for a different year. Money is aggregated as integer minor units, and selected work without a usable estimate remains visible as `Cost estimate required`; it is never silently treated as a zero-cost funded intervention.

Recommendation `sourceEstimatedCost` remains the Bauwerksbuch fact. A planned intervention estimate separately records `USER_PLANNING` or `EXTERNAL_ENRICHED` provenance and `DRAFT` or `REVIEWED` status. The budget read model chooses the applicable estimate for calculation while returning both records so their origins cannot be conflated.

## Work Package API

- `GET /api/v1/work-packages` - generated drafts and active planned interventions eligible for preparation
- `GET /api/v1/work-packages/:id` - one versioned work-package snapshot
- `POST /api/v1/work-packages` - create one draft from an active planned intervention

A work package captures its important planning inputs as a versioned JSON snapshot while retaining typed foreign keys and live links to the intervention, bridge, recommendation, findings, and documents. This makes the handoff reproducible if live records later change. The tradeoff is intentional staleness: the UI displays the generation time and directs reviewers to live records; future refreshes should create a new explicit version rather than silently rewriting the original draft.

Readiness is derived conservatively from facts present at generation time. Source evidence, quantity, a current inspection, a managerial planning estimate, drawings, and traffic-management requirements are marked available only when recorded. Site verification remains required. A source recommendation cost does not become a managerial planning estimate. Every draft states: `Planning draft — requires technical and procurement review.` The feature does not claim to produce a legally complete tender.

## Document Ingestion API

Document routes are versioned under `/api/v1`:

- `POST /api/v1/documents` - upload one PDF in the `file` multipart field
- `GET /api/v1/documents` - list uploaded and demo documents with processing state
- `GET /api/v1/documents/overview` - workflow-focused document lifecycle and bridge data-health checks
- `GET /api/v1/documents/:id` - document metadata, latest processing run, and pages
- `GET /api/v1/documents/:id/pages/:pageNumber` - deterministic extracted page text

Example upload:

```sh
curl -F 'file=@./bauwerksbuch.pdf;type=application/pdf' \
  http://localhost:4000/api/v1/documents
```

The API validates the MIME type, configured byte limit, and PDF signature before ingestion. A SHA-256 checksum prevents duplicate storage and processing. Files use a replaceable storage interface with a local-filesystem implementation for development. PDF.js extracts text per page; pages with too little text are rasterized and OCR'd with Tesseract so scanned Bauwerksbücher still persist verifiable page text. Processing runs retain explicit `UPLOADED`, `PARSING`, `PARSED`, `EXTRACTION_PENDING`, `EXTRACTED`, and `FAILED` states. Successful parsing stops at `EXTRACTION_PENDING`; no bridge facts or LLM output are created in this slice.

The overview joins each document to its latest parsing and extraction attempts, including page count, parser, pipeline version, provider/model, and retained errors. Bridge data health is a fixed set of explicit checks rather than a percentage: latest dated inspection, traffic age, core geometry, linked processing/extraction errors, recommendation quantities and cost estimates, automatically extracted findings awaiting review, page-level evidence for critical extracted findings, and recorded load-recalculation documents. Traffic is stale after five years. Core geometry requires length, width, area, and span count for every Teilbauwerk; clear height is not universally required. Completed and cancelled recommendations do not contribute planning gaps.

## Structured Extraction Pipeline

The extraction architecture is staged and provider-neutral:

1. Parsed page text is loaded from `document_pages`; original PDFs are not sent as one undifferentiated request.
2. Each page is classified independently into identity, geometry, components, inspections, findings, recommendations, works/costs, traffic, or drawings/other.
3. Consecutive pages are grouped by category in chunks of at most three and sent to category-specific prompt/schema versions.
4. Provider output is parsed with strict Zod contracts. Every non-null value requires a page and source excerpt; null values cannot carry invented evidence.
5. German decimals, dates, currencies, and common units are normalized deterministically, then validated again against domain create contracts.
6. A compact registry of already validated Teilbauwerk, inspection, and finding source keys is passed forward so later calls reuse relationships without receiving unrelated pages.
7. Domain rows, recommendation links, `SourceEvidence`, entity-field evidence links, document assignment, and run completion are committed in one transaction.

`ExtractionProvider` remains the replaceable application boundary. The live implementation delegates to a smaller `StructuredModelClient`; only `OpenAiStructuredModelClient` imports a vendor SDK. It uses strict structured responses with the domain Zod schemas and records provider request IDs and token usage. Prompts are versioned per domain and require supplied content only, null unknowns, preserved identifiers and German wording, source excerpts, and no model-generated engineering prioritization.

`document_extraction_runs`, `document_extraction_invocations`, and `document_page_classifications` make attempts inspectable and reproducible. Failed runs retain stage/code/message details and can be retried as a new linked attempt. `SourceEvidence.extraction_run_id` links model-created evidence to the producing run without changing provenance into EAV.

Every run-created evidence row starts with review state `AUTOMATICALLY_EXTRACTED`; confidence, extraction method, evidence, and review state are exposed together. Human confirmation/rejection states exist as a small future-facing boundary, but no review workflow or mutation API is implemented.

Text remains the default input. A deterministic vision policy marks layout-heavy text pages as vision-eligible only when a page-image source is explicitly configured. Pages with too little extractable text are rasterized during parse and OCR'd with Tesseract (`deu`) so evidence excerpts stay verifiable against persisted page text. Parser name becomes `pdfjs-dist/…+tesseract` when any page used OCR. Those pages are stored with `document_pages.text_source = OCR`; run-created `SourceEvidence` rows stay `MODEL_EXTRACTION` with review state `AUTOMATICALLY_EXTRACTED`, which is what the provenance constraints require.

Parse also looks at the first twenty pages for a labelled photograph (`Foto`, `Lichtbild`, `Bauwerksansicht`, and similar captions), rasterizes that page to JPEG, and stores it beside the PDF as `{documentId}/bridge-photo.jpg`. The document row keeps the photo storage key, page number, MIME type, and byte size together. Bridge list and detail responses expose `photoUrl` (`/api/v1/bridges/{id}/photo`) when a linked document has a photograph; `GET` of that URL returns the JPEG.

Run a parsed document with:

```sh
pnpm extract <document-id>
pnpm extract --retry <failed-run-id>
```

## Repeatable Demo Ingestion

`pnpm fixtures:ingest` validates that `fixtures/bauwerksbuch` contains exactly five distinct PDFs, processes them sequentially in filename order, and reports documents ingested or checksum-skipped, bridges created/updated, inspections, findings, recommendations, validation failures, and per-file processing/extraction errors. `--json` emits the same report as JSON. The command is restricted to `NODE_ENV=development`, a localhost PostgreSQL server, and a development database name. Scanned PDFs without a text layer are OCR'd at parse time; that requires a local `tesseract` install. The German (`deu`) language pack is preferred (`brew install tesseract-lang` on macOS); English is used only if `deu` is unavailable.

The default rerun policy is conservative:

- A checksum already in the document catalog is not stored or parsed again.
- `--reparse` re-reads the stored PDF, replaces `document_pages` (including OCR text), regenerates the stored bridge photograph, and then extracts from the new page text. Use this after OCR/parser changes, for example Bauwerksbuch 3.
- A successful extraction is skipped. A failed extraction is retried as a linked attempt.
- `--reextract` is required to rerun an already successful document without re-parsing.
- Source identity is based on domain keys: external Bauwerk and Teilbauwerk numbers; Teilbauwerk/date/type for inspections; document finding identifiers or evidence; scoped recommendation/work keys; and traffic year/date.
- Each extracted entity has document ownership, stable entity UUID, latest run, and a SHA-256 fingerprint of the last applied normalized record.
- Re-extraction updates only rows still matching that fingerprint and carrying no human-reviewed evidence. A changed identity, omitted previously extracted entity, manual edit, or reviewed evidence aborts the transaction and preserves the prior data.
- Newly extracted entities may be added. Stale entities are never automatically deleted or marked resolved.
- Planned interventions, budget membership, and work packages are outside extraction ownership and are never rewritten by this workflow.

These rules deliberately favor an inspectable failure over silently overwriting reviewed facts.

The deterministic orchestration provider and mocked structured-model fixtures cover tests without real API calls. Model extraction is deliberately not registered as an HTTP route or automatic upload side effect.

## Scripts

- `pnpm dev` - run app development servers
- `pnpm build` - build all workspaces
- `pnpm lint` - run ESLint
- `pnpm typecheck` - run TypeScript checks
- `pnpm test` - run Vitest
- `pnpm extract <document-id>` - run configured structured extraction for one parsed document
- `pnpm fixtures:ingest` - ingest and extract the five local demo PDFs with checksum and lineage protection
- `pnpm db:generate` - generate explicit Drizzle migrations
- `pnpm db:migrate` - run versioned Drizzle migrations
- `pnpm db:seed` - idempotently upsert development fixtures into a guarded local database
- `pnpm db:reset:dev` - reset, migrate, and seed a guarded local database; requires an explicit confirmation token

## Database Migrations

Use generated, version-controlled Drizzle migrations:

```sh
pnpm db:generate
pnpm db:migrate
```

Do not use schema push as the normal migration strategy.

Versioned migrations are in `packages/db/drizzle`. Migrations contain schema changes only; development fixtures are kept under `packages/db/src/fixtures` and are applied separately by `pnpm db:seed`.

## Development Fixture

`pnpm db:seed` idempotently upserts a reviewable Musterbrücke Fiktivtal / A57 fixture for structure `9999999`. It includes one Teilbauwerk, components, inspection history, findings with S/V/D values, linked recommendations, three distinct managerial interventions, a 2026 budget program, traffic, historical work and costs, and field-level evidence.

The bridge has `data_origin = DEMO_FIXTURE`. Its source documents use `DEMO_*` types, fixture metadata, `extractionPerformed: false`, and excerpts prefixed with `[DEMO-FIXTUR]`. This data must not be presented as PDF-extraction output.

Seed and reset commands require `NODE_ENV=development`, a localhost PostgreSQL URL, and a database named `bridge_os` or prefixed with `bridge_os_`. Production-like database names are rejected.

The destructive reset additionally requires an explicit token:

```sh
ALLOW_DATABASE_RESET=bridge-os-local-reset pnpm db:reset:dev
```

The reset drops only the `public` and Drizzle migration schemas in the validated local development database, then reapplies migrations and fixtures.

## Core Domain Model

- `bridges` represents the Bauwerk aggregate and stores identity, route, location, and administrative responsibility.
- `partial_structures` represents inspectable Teilbauwerke and stores construction, structural-system, and geometry facts.
- Components, inspections, findings, and recommendations are scoped to a partial structure. Composite foreign keys prevent links across bridges or Teilbauwerke.
- Recommendations link to findings through a many-to-many table. Historical work can be bridge-wide or scoped to one partial structure; traffic observations belong to the bridge.
- Planned interventions represent managerial decisions and reference exactly one source recommendation. Composite foreign keys preserve bridge and partial-structure scope; quantity/unit and complete estimate amount/currency/source/status groups are enforced in PostgreSQL.
- Budget programs hold one approved amount per planning year. A typed membership table links same-year interventions to the program without changing their delivery status or source recommendation.
- Work packages store one versioned creation-time snapshot per planned intervention. A composite foreign key preserves intervention, recommendation, bridge, and partial-structure scope; creation is transactional and duplicate drafts are rejected.
- Source documents may be unassigned while processing, then linked to a bridge and optionally a partial structure.
- Document files, page text, and processing runs are separate concerns: file metadata stays on `documents`, deterministic text lives in `document_pages`, and each processing attempt has an explicit lifecycle in `document_processing_runs`.
- Semantic extraction attempts are separate from deterministic parsing. Prompt/model metadata belongs to extraction runs and invocations, while accepted facts remain in typed domain tables with field-level provenance.

Provenance is not stored as EAV. `source_evidence` contains a document citation, page, excerpt, normalized bounding box, confidence, and extraction method. Entity-specific evidence tables link that citation to a constrained domain field and classify the value as a source fact or a derived value. Derived values require a recorded derivation method.

## Engineering Notes

- Fastify app construction is separated from process startup so tests can instantiate the app directly.
- PostgreSQL query tests are enabled with `TEST_DATABASE_URL`; CI migrates and seeds an isolated PostgreSQL service before running them.
- Environment variables are validated at startup with Zod.
- API errors flow through centralized structured error handling.
- Shared contracts belong in `packages/contracts`; database schema and migration concerns belong in `packages/db`.
- Missing source data remains nullable rather than being inferred. Source facts and derived values are distinguished explicitly in provenance links.
