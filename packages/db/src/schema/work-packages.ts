import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid
} from "drizzle-orm/pg-core";

import { auditColumns } from "./common.js";
import { workPackageStatusEnum } from "./enums.js";
import { plannedInterventions } from "./planned-interventions.js";

export const workPackages = pgTable(
  "work_packages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    plannedInterventionId: uuid("planned_intervention_id").notNull(),
    recommendationId: uuid("recommendation_id").notNull(),
    bridgeId: uuid("bridge_id").notNull(),
    partialStructureId: uuid("partial_structure_id").notNull(),
    title: text("title").notNull(),
    status: workPackageStatusEnum("status").notNull().default("DRAFT"),
    snapshotVersion: smallint("snapshot_version").notNull().default(1),
    snapshot: jsonb("snapshot").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    ...auditColumns()
  },
  (table) => [
    foreignKey({
      columns: [
        table.plannedInterventionId,
        table.recommendationId,
        table.bridgeId,
        table.partialStructureId
      ],
      foreignColumns: [
        plannedInterventions.id,
        plannedInterventions.recommendationId,
        plannedInterventions.bridgeId,
        plannedInterventions.partialStructureId
      ],
      name: "work_packages_planned_intervention_scope_fk"
    })
      .onDelete("restrict")
      .onUpdate("cascade"),
    unique("work_packages_planned_intervention_unique").on(
      table.plannedInterventionId
    ),
    index("work_packages_bridge_generated_idx").on(
      table.bridgeId,
      table.generatedAt
    ),
    index("work_packages_status_idx").on(table.status),
    check("work_packages_title_not_blank", sql`btrim(${table.title}) <> ''`),
    check("work_packages_snapshot_version_v1", sql`${table.snapshotVersion} = 1`),
    check(
      "work_packages_snapshot_object",
      sql`jsonb_typeof(${table.snapshot}) = 'object'`
    )
  ]
);
