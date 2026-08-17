CREATE TYPE "public"."hydrological_metric_source" AS ENUM('PEGELONLINE', 'WSV_PUBLISHED');--> statement-breakpoint
CREATE TYPE "public"."hydrological_water_state" AS ENUM('LOW', 'NORMAL', 'HIGH', 'UNKNOWN', 'COMMENTED', 'OUTDATED');--> statement-breakpoint
CREATE TABLE "hydrological_flood_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bridge_id" uuid NOT NULL,
	"event_year" smallint NOT NULL,
	"peaked_on" date NOT NULL,
	"peak_water_level_cm" integer NOT NULL,
	"station_uuid" uuid NOT NULL,
	"station_name" text NOT NULL,
	"water_name" text NOT NULL,
	"mhw_cm" integer,
	"hsw_cm" integer,
	"hhw_cm" integer,
	"marke_i_cm" integer,
	"marke_ii_cm" integer,
	"source" "hydrological_metric_source" NOT NULL,
	"source_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hydrological_flood_events_year_range" CHECK ("hydrological_flood_events"."event_year" between 1900 and 2200),
	CONSTRAINT "hydrological_flood_events_date_matches_year" CHECK (extract(year from "hydrological_flood_events"."peaked_on") = "hydrological_flood_events"."event_year"),
	CONSTRAINT "hydrological_flood_events_peak_non_negative" CHECK ("hydrological_flood_events"."peak_water_level_cm" >= 0
        and ("hydrological_flood_events"."mhw_cm" is null or "hydrological_flood_events"."mhw_cm" >= 0)
        and ("hydrological_flood_events"."hsw_cm" is null or "hydrological_flood_events"."hsw_cm" >= 0)
        and ("hydrological_flood_events"."hhw_cm" is null or "hydrological_flood_events"."hhw_cm" >= 0)
        and ("hydrological_flood_events"."marke_i_cm" is null or "hydrological_flood_events"."marke_i_cm" >= 0)
        and ("hydrological_flood_events"."marke_ii_cm" is null or "hydrological_flood_events"."marke_ii_cm" >= 0)),
	CONSTRAINT "hydrological_flood_events_station_name_not_blank" CHECK (btrim("hydrological_flood_events"."station_name") <> ''),
	CONSTRAINT "hydrological_flood_events_water_name_not_blank" CHECK (btrim("hydrological_flood_events"."water_name") <> ''),
	CONSTRAINT "hydrological_flood_events_source_description_not_blank" CHECK ("hydrological_flood_events"."source_description" is null or btrim("hydrological_flood_events"."source_description") <> '')
);
--> statement-breakpoint
CREATE TABLE "hydrological_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bridge_id" uuid NOT NULL,
	"station_uuid" uuid NOT NULL,
	"station_name" text NOT NULL,
	"station_number" text,
	"water_name" text NOT NULL,
	"river_km" numeric(8, 3),
	"latitude" numeric(9, 6),
	"longitude" numeric(10, 6),
	"distance_km" numeric(6, 1),
	"observed_at" timestamp with time zone NOT NULL,
	"water_level_cm" integer NOT NULL,
	"unit" text NOT NULL,
	"state_mnw_mhw" "hydrological_water_state",
	"state_nsw_hsw" "hydrological_water_state",
	"mhw_cm" integer,
	"hsw_cm" integer,
	"hhw_cm" integer,
	"mnw_cm" integer,
	"mw_cm" integer,
	"marke_i_cm" integer,
	"marke_ii_cm" integer,
	"inspection_trigger_cm" integer NOT NULL,
	"source" "hydrological_metric_source" NOT NULL,
	"source_description" text,
	"formula_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hydrological_metrics_station_name_not_blank" CHECK (btrim("hydrological_metrics"."station_name") <> ''),
	CONSTRAINT "hydrological_metrics_water_name_not_blank" CHECK (btrim("hydrological_metrics"."water_name") <> ''),
	CONSTRAINT "hydrological_metrics_unit_not_blank" CHECK (btrim("hydrological_metrics"."unit") <> ''),
	CONSTRAINT "hydrological_metrics_latitude_range" CHECK ("hydrological_metrics"."latitude" is null or "hydrological_metrics"."latitude" between -90 and 90),
	CONSTRAINT "hydrological_metrics_longitude_range" CHECK ("hydrological_metrics"."longitude" is null or "hydrological_metrics"."longitude" between -180 and 180),
	CONSTRAINT "hydrological_metrics_distance_non_negative" CHECK ("hydrological_metrics"."distance_km" is null or "hydrological_metrics"."distance_km" >= 0),
	CONSTRAINT "hydrological_metrics_levels_non_negative" CHECK ("hydrological_metrics"."water_level_cm" >= 0
        and ("hydrological_metrics"."mhw_cm" is null or "hydrological_metrics"."mhw_cm" >= 0)
        and ("hydrological_metrics"."hsw_cm" is null or "hydrological_metrics"."hsw_cm" >= 0)
        and ("hydrological_metrics"."hhw_cm" is null or "hydrological_metrics"."hhw_cm" >= 0)
        and ("hydrological_metrics"."mnw_cm" is null or "hydrological_metrics"."mnw_cm" >= 0)
        and ("hydrological_metrics"."mw_cm" is null or "hydrological_metrics"."mw_cm" >= 0)
        and ("hydrological_metrics"."marke_i_cm" is null or "hydrological_metrics"."marke_i_cm" >= 0)
        and ("hydrological_metrics"."marke_ii_cm" is null or "hydrological_metrics"."marke_ii_cm" >= 0)
        and "hydrological_metrics"."inspection_trigger_cm" >= 0),
	CONSTRAINT "hydrological_metrics_formula_version_not_blank" CHECK (btrim("hydrological_metrics"."formula_version") <> ''),
	CONSTRAINT "hydrological_metrics_source_description_not_blank" CHECK ("hydrological_metrics"."source_description" is null or btrim("hydrological_metrics"."source_description") <> ''),
	CONSTRAINT "hydrological_metrics_station_number_not_blank" CHECK ("hydrological_metrics"."station_number" is null or btrim("hydrological_metrics"."station_number") <> '')
);
--> statement-breakpoint
ALTER TABLE "hydrological_flood_events" ADD CONSTRAINT "hydrological_flood_events_bridge_id_bridges_id_fk" FOREIGN KEY ("bridge_id") REFERENCES "public"."bridges"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "hydrological_metrics" ADD CONSTRAINT "hydrological_metrics_bridge_id_bridges_id_fk" FOREIGN KEY ("bridge_id") REFERENCES "public"."bridges"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "hydrological_flood_events_bridge_year_unique" ON "hydrological_flood_events" USING btree ("bridge_id","event_year");--> statement-breakpoint
CREATE INDEX "hydrological_flood_events_bridge_idx" ON "hydrological_flood_events" USING btree ("bridge_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hydrological_metrics_bridge_unique" ON "hydrological_metrics" USING btree ("bridge_id");--> statement-breakpoint
CREATE INDEX "hydrological_metrics_station_idx" ON "hydrological_metrics" USING btree ("station_uuid");