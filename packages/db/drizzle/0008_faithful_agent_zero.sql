CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "bridges_global_search_trgm_idx" ON "bridges" USING gin ((
        coalesce("external_structure_number", '') || ' ' ||
        coalesce("name", '') || ' ' ||
        coalesce("road", '') || ' ' ||
        coalesce("federal_state", '') || ' ' ||
        coalesce("district", '') || ' ' ||
        coalesce("municipality", '') || ' ' ||
        coalesce("locality", '') || ' ' ||
        coalesce("stationing", '') || ' ' ||
        coalesce("crossed_feature", '')
      ) gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "findings_global_search_trgm_idx" ON "findings" USING gin ((
        coalesce("source_identifier", '') || ' ' ||
        coalesce("defect_type", '') || ' ' ||
        coalesce("description", '') || ' ' ||
        coalesce("location", '') || ' ' ||
        coalesce("extent", '')
      ) gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "recommendations_global_search_trgm_idx" ON "recommendations" USING gin ((
        coalesce("work_type", '') || ' ' ||
        coalesce("description", '') || ' ' ||
        coalesce("urgency", '')
      ) gin_trgm_ops);
