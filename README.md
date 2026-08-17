# Bridge OS

Bridge portfolio management. Ingests German Bauwerksbuch PDFs and turns them into structured, traceable data for monitoring, maintenance planning, budgeting, and tender preparation.

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

- **Portfolio** — browse bridges; filter and sort by condition, road, or inspection status.
- **Findings & recommendations** — inspection findings and the recommendations linked to them.
- **Source evidence** — every extracted fact links back to the source PDF, page, and excerpt.
- **Planning** — turn a recommendation into a managerial intervention (planned → budgeted → tender preparation → tendered → in progress → completed).
- **Budgeting** — assign interventions to a yearly programme; old source estimates are restated with the NRW road construction price index.
- **Work packages** — tender-preparation draft from a planned intervention, with explicit readiness gaps.

## Ranking

Attention, planning, and budget use the same deterministic reason list — not a single score.

From the Bauwerksbuch: S/V/D ratings, recommendation urgency, inspection due date, condition trend.

Joined at read time from **seeded snapshots** (no live API calls):

- **Traffic** — BASt Dauerzählstellen. DTV and HGV.
- **Network** — OSM closure detour with the crossing excluded. Extra vehicle-km/day if the structure is lost.
- **Weather** — Open-Meteo ERA5-land. Freeze/thaw, heavy rain, and de-icing days joined to open durability findings (corrosion, water ingress, scour).
- **Flood** — PEGELONLINE plus published Rhine peaks. Watch only when the structure is already scour-sensitive; current low water is not treated as a flood.
- **Costs** — NRW Baupreisindex Straßenbau (demo series, 2015 = 100). Historical source estimates shown in current euros.
