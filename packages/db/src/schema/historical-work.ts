import { sql } from "drizzle-orm";
import {
  char,
  check,
  date,
  foreignKey,
  index,
  numeric,
  pgTable,
  text,
  uuid
} from "drizzle-orm/pg-core";

import { bridges, partialStructures } from "./bridges.js";
import { auditColumns } from "./common.js";

export const historicalWorks = pgTable(
  "historical_works",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bridgeId: uuid("bridge_id")
      .notNull()
      .references(() => bridges.id, { onDelete: "restrict", onUpdate: "cascade" }),
    partialStructureId: uuid("partial_structure_id"),
    type: text("type"),
    title: text("title"),
    reason: text("reason"),
    contractor: text("contractor"),
    client: text("client"),
    startedOn: date("started_on"),
    endedOn: date("ended_on"),
    quantity: numeric("quantity", { precision: 16, scale: 3 }),
    unit: text("unit"),
    contractAmount: numeric("contract_amount", { precision: 16, scale: 2 }),
    finalAmount: numeric("final_amount", { precision: 16, scale: 2 }),
    currency: char("currency", { length: 3 }),
    ...auditColumns()
  },
  (table) => [
    foreignKey({
      columns: [table.partialStructureId, table.bridgeId],
      foreignColumns: [partialStructures.id, partialStructures.bridgeId],
      name: "historical_works_partial_structure_bridge_fk"
    })
      .onDelete("restrict")
      .onUpdate("cascade"),
    index("historical_works_bridge_start_date_idx").on(table.bridgeId, table.startedOn),
    index("historical_works_partial_structure_idx").on(table.partialStructureId),
    check(
      "historical_works_title_not_blank",
      sql`${table.title} is null or btrim(${table.title}) <> ''`
    ),
    check(
      "historical_works_date_order",
      sql`${table.startedOn} is null or ${table.endedOn} is null or ${table.endedOn} >= ${table.startedOn}`
    ),
    check(
      "historical_works_quantity_unit_pair",
      sql`(${table.quantity} is null and ${table.unit} is null)
        or (${table.quantity} >= 0 and nullif(btrim(${table.unit}), '') is not null)`
    ),
    check(
      "historical_works_amount_currency_pair",
      sql`(${table.contractAmount} is null and ${table.finalAmount} is null and ${table.currency} is null)
        or (
          (${table.contractAmount} is not null or ${table.finalAmount} is not null)
          and (${table.contractAmount} is null or ${table.contractAmount} >= 0)
          and (${table.finalAmount} is null or ${table.finalAmount} >= 0)
          and ${table.currency} ~ '^[A-Z]{3}$'
        )`
    )
  ]
);
