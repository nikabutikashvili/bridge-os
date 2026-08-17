CREATE TYPE "public"."environmental_metric_source" AS ENUM('OPEN_METEO');--> statement-breakpoint
CREATE TABLE "environmental_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bridge_id" uuid NOT NULL,
	"observation_year" smallint NOT NULL,
	"latitude" numeric(9, 6),
	"longitude" numeric(10, 6),
	"grid_latitude" numeric(9, 6),
	"grid_longitude" numeric(10, 6),
	"elevation_m" numeric(8, 1),
	"freeze_thaw_days" integer,
	"frost_days" integer,
	"ice_days" integer,
	"wet_dry_cycles" integer,
	"mean_relative_humidity_percent" numeric(5, 1),
	"precipitation_hours" integer,
	"heavy_rain_days_20" integer,
	"heavy_rain_days_30" integer,
	"annual_precip_mm" numeric(8, 1),
	"deicing_days" integer,
	"monthly_precip_mm" jsonb,
	"monthly_freeze_thaw_days" jsonb,
	"source" "environmental_metric_source" NOT NULL,
	"source_description" text,
	"formula_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "environmental_metrics_year_range" CHECK ("environmental_metrics"."observation_year" between 1900 and 2200),
	CONSTRAINT "environmental_metrics_latitude_range" CHECK ("environmental_metrics"."latitude" is null or "environmental_metrics"."latitude" between -90 and 90),
	CONSTRAINT "environmental_metrics_longitude_range" CHECK ("environmental_metrics"."longitude" is null or "environmental_metrics"."longitude" between -180 and 180),
	CONSTRAINT "environmental_metrics_non_negative_counts" CHECK (("environmental_metrics"."freeze_thaw_days" is null or "environmental_metrics"."freeze_thaw_days" >= 0)
        and ("environmental_metrics"."frost_days" is null or "environmental_metrics"."frost_days" >= 0)
        and ("environmental_metrics"."ice_days" is null or "environmental_metrics"."ice_days" >= 0)
        and ("environmental_metrics"."wet_dry_cycles" is null or "environmental_metrics"."wet_dry_cycles" >= 0)
        and ("environmental_metrics"."precipitation_hours" is null or "environmental_metrics"."precipitation_hours" >= 0)
        and ("environmental_metrics"."heavy_rain_days_20" is null or "environmental_metrics"."heavy_rain_days_20" >= 0)
        and ("environmental_metrics"."heavy_rain_days_30" is null or "environmental_metrics"."heavy_rain_days_30" >= 0)
        and ("environmental_metrics"."deicing_days" is null or "environmental_metrics"."deicing_days" >= 0)),
	CONSTRAINT "environmental_metrics_humidity_range" CHECK ("environmental_metrics"."mean_relative_humidity_percent" is null
        or "environmental_metrics"."mean_relative_humidity_percent" between 0 and 100),
	CONSTRAINT "environmental_metrics_precip_non_negative" CHECK ("environmental_metrics"."annual_precip_mm" is null or "environmental_metrics"."annual_precip_mm" >= 0),
	CONSTRAINT "environmental_metrics_monthly_precip_shape" CHECK ("environmental_metrics"."monthly_precip_mm" is null
        or (jsonb_typeof("environmental_metrics"."monthly_precip_mm") = 'array'
          and jsonb_array_length("environmental_metrics"."monthly_precip_mm") = 12)),
	CONSTRAINT "environmental_metrics_monthly_freeze_thaw_shape" CHECK ("environmental_metrics"."monthly_freeze_thaw_days" is null
        or (jsonb_typeof("environmental_metrics"."monthly_freeze_thaw_days") = 'array'
          and jsonb_array_length("environmental_metrics"."monthly_freeze_thaw_days") = 12)),
	CONSTRAINT "environmental_metrics_formula_version_not_blank" CHECK (btrim("environmental_metrics"."formula_version") <> ''),
	CONSTRAINT "environmental_metrics_source_description_not_blank" CHECK ("environmental_metrics"."source_description" is null or btrim("environmental_metrics"."source_description") <> '')
);
--> statement-breakpoint
ALTER TABLE "environmental_metrics" ADD CONSTRAINT "environmental_metrics_bridge_id_bridges_id_fk" FOREIGN KEY ("bridge_id") REFERENCES "public"."bridges"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "environmental_metrics_bridge_year_unique" ON "environmental_metrics" USING btree ("bridge_id","observation_year");--> statement-breakpoint
CREATE INDEX "environmental_metrics_year_idx" ON "environmental_metrics" USING btree ("observation_year");