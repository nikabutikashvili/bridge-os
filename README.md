# Bridge OS

Bridge portfolio management. Ingests German Bauwerksbuch (bridge inspection record) PDFs and turns them into structured, traceable data for monitoring, maintenance planning, budgeting, and tender preparation.

## Stack

- Next.js (web) + Fastify (API), TypeScript throughout
- PostgreSQL, Drizzle ORM
- pnpm workspace / Turborepo monorepo
- Zod contracts

## Running it

```sh
docker compose up --build
```

- Web app: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:4000](http://localhost:4000)
- Postgres: `localhost:5432`

This also runs migrations and seeds a demo bridge, so the app is populated on first load.

For local (non-Docker) development:

```sh
pnpm install
cp .env.example .env
docker compose up -d postgres
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## What you can do

- **Portfolio** — browse bridges, filter and sort by condition, road, or inspection status.
- **Prioritization** — bridges and findings are ranked by a deterministic policy, shown as a list of reasons (unresolved condition ratings, recommendation urgency, inspection age/due status, condition trend, traffic volume) rather than a single opaque score.
- **Findings & recommendations** — inspection findings and the recommendations linked to them.
- **Source evidence** — every extracted fact links back to the source PDF, page, and excerpt it came from.
- **Planning** — turn a recommendation into a managerial intervention and track it through its lifecycle (planned → budgeted → tender preparation → tendered → in progress → completed).
- **Budgeting** — assign interventions to a yearly budget program, track approved amount vs. cost estimates.
- **Work packages** — generate a tender-preparation draft from a planned intervention, with explicit readiness gaps (missing quantity, estimate, drawings, etc.).
