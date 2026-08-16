import { timestamp } from "drizzle-orm/pg-core";

export type ScalarProperties = Record<string, boolean | number | string | null>;

export function auditColumns() {
  return {
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  };
}
