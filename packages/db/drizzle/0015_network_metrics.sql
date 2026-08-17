CREATE TYPE "public"."network_metric_source" AS ENUM('OSM_ROUTED', 'MANUAL_FIXTURE', 'SIB_ASB', 'BAST_NETWORK');--> statement-breakpoint
CREATE TYPE "public"."network_road_class" AS ENUM('AUTOBAHN', 'BUNDESSTRASSE', 'LANDESSTRASSE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."network_traffic_applies_to" AS ENUM('CARRIED', 'CROSSED');--> statement-breakpoint
CREATE TABLE "network_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bridge_id" uuid NOT NULL,
	"observation_year" smallint NOT NULL,
	"latitude" numeric(9, 6),
	"longitude" numeric(10, 6),
	"carried_road" text,
	"road_class" "network_road_class" NOT NULL,
	"traffic_applies_to" "network_traffic_applies_to" NOT NULL,
	"normal_trip_km" numeric(8, 1),
	"closure_detour_km" numeric(8, 1),
	"additional_distance_km" numeric(8, 1),
	"alternative_crossing_count" integer,
	"on_strategic_network" boolean DEFAULT false NOT NULL,
	"source" "network_metric_source" NOT NULL,
	"source_description" text,
	"formula_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "network_metrics_year_range" CHECK ("network_metrics"."observation_year" between 1900 and 2200),
	CONSTRAINT "network_metrics_latitude_range" CHECK ("network_metrics"."latitude" is null or "network_metrics"."latitude" between -90 and 90),
	CONSTRAINT "network_metrics_longitude_range" CHECK ("network_metrics"."longitude" is null or "network_metrics"."longitude" between -180 and 180),
	CONSTRAINT "network_metrics_distances_non_negative" CHECK (("network_metrics"."normal_trip_km" is null or "network_metrics"."normal_trip_km" >= 0)
        and ("network_metrics"."closure_detour_km" is null or "network_metrics"."closure_detour_km" >= 0)
        and ("network_metrics"."additional_distance_km" is null or "network_metrics"."additional_distance_km" >= 0)),
	CONSTRAINT "network_metrics_alternative_count_non_negative" CHECK ("network_metrics"."alternative_crossing_count" is null or "network_metrics"."alternative_crossing_count" >= 0),
	CONSTRAINT "network_metrics_carried_road_not_blank" CHECK ("network_metrics"."carried_road" is null or btrim("network_metrics"."carried_road") <> ''),
	CONSTRAINT "network_metrics_formula_version_not_blank" CHECK (btrim("network_metrics"."formula_version") <> ''),
	CONSTRAINT "network_metrics_source_description_not_blank" CHECK ("network_metrics"."source_description" is null or btrim("network_metrics"."source_description") <> '')
);
--> statement-breakpoint
ALTER TABLE "traffic_observations" ADD COLUMN "heavy_vehicle_daily" integer;--> statement-breakpoint
ALTER TABLE "network_metrics" ADD CONSTRAINT "network_metrics_bridge_id_bridges_id_fk" FOREIGN KEY ("bridge_id") REFERENCES "public"."bridges"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "network_metrics_bridge_unique" ON "network_metrics" USING btree ("bridge_id");--> statement-breakpoint
CREATE INDEX "network_metrics_year_idx" ON "network_metrics" USING btree ("observation_year");--> statement-breakpoint
ALTER TABLE "traffic_observations" ADD CONSTRAINT "traffic_observations_non_negative_heavy_vehicle_daily" CHECK ("traffic_observations"."heavy_vehicle_daily" is null or "traffic_observations"."heavy_vehicle_daily" >= 0);