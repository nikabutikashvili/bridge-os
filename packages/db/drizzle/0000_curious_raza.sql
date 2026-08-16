CREATE TYPE "public"."document_status" AS ENUM('UPLOADED', 'PROCESSING', 'READY', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."extraction_method" AS ENUM('MANUAL', 'TEXT_EXTRACTION', 'OCR', 'MODEL_EXTRACTION', 'IMPORT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."finding_status" AS ENUM('OPEN', 'MONITORING', 'RESOLVED', 'DISMISSED');--> statement-breakpoint
CREATE TYPE "public"."inspection_type" AS ENUM('MAIN', 'SIMPLE', 'SPECIAL', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."provenance_kind" AS ENUM('SOURCE_FACT', 'DERIVED');--> statement-breakpoint
CREATE TYPE "public"."recommendation_status" AS ENUM('OPEN', 'APPROVED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "bridges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_structure_number" text,
	"name" text,
	"road" text,
	"country_code" char(2),
	"federal_state" text,
	"district" text,
	"municipality" text,
	"locality" text,
	"postal_code" text,
	"stationing" text,
	"crossed_feature" text,
	"latitude" numeric(9, 6),
	"longitude" numeric(10, 6),
	"owner" text,
	"load_bearing_responsibility" text,
	"responsible_authority" text,
	"maintenance_office" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bridges_external_structure_number_not_blank" CHECK ("bridges"."external_structure_number" is null or btrim("bridges"."external_structure_number") <> ''),
	CONSTRAINT "bridges_country_code_format" CHECK ("bridges"."country_code" is null or "bridges"."country_code" ~ '^[A-Z]{2}$'),
	CONSTRAINT "bridges_latitude_range" CHECK ("bridges"."latitude" is null or "bridges"."latitude" between -90 and 90),
	CONSTRAINT "bridges_longitude_range" CHECK ("bridges"."longitude" is null or "bridges"."longitude" between -180 and 180)
);
--> statement-breakpoint
CREATE TABLE "partial_structures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bridge_id" uuid NOT NULL,
	"external_partial_structure_number" text,
	"name" text,
	"construction_year" smallint,
	"structure_type" text,
	"structural_system" text,
	"length_m" numeric(12, 3),
	"width_m" numeric(12, 3),
	"area_sq_m" numeric(14, 3),
	"clear_height_m" numeric(12, 3),
	"span_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partial_structures_id_bridge_unique" UNIQUE("id","bridge_id"),
	CONSTRAINT "partial_structures_external_number_not_blank" CHECK ("partial_structures"."external_partial_structure_number" is null or btrim("partial_structures"."external_partial_structure_number") <> ''),
	CONSTRAINT "partial_structures_construction_year_range" CHECK ("partial_structures"."construction_year" is null or "partial_structures"."construction_year" between 1700 and 2200),
	CONSTRAINT "partial_structures_positive_geometry" CHECK (("partial_structures"."length_m" is null or "partial_structures"."length_m" > 0)
        and ("partial_structures"."width_m" is null or "partial_structures"."width_m" > 0)
        and ("partial_structures"."area_sq_m" is null or "partial_structures"."area_sq_m" > 0)
        and ("partial_structures"."clear_height_m" is null or "partial_structures"."clear_height_m" > 0)),
	CONSTRAINT "partial_structures_positive_span_count" CHECK ("partial_structures"."span_count" is null or "partial_structures"."span_count" > 0)
);
--> statement-breakpoint
CREATE TABLE "components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bridge_id" uuid NOT NULL,
	"partial_structure_id" uuid NOT NULL,
	"type" text,
	"name" text,
	"location" text,
	"material" text,
	"construction_year" smallint,
	"install_year" smallint,
	"additional_properties" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "components_id_bridge_partial_unique" UNIQUE("id","bridge_id","partial_structure_id"),
	CONSTRAINT "components_type_not_blank" CHECK ("components"."type" is null or btrim("components"."type") <> ''),
	CONSTRAINT "components_year_ranges" CHECK (("components"."construction_year" is null or "components"."construction_year" between 1700 and 2200)
        and ("components"."install_year" is null or "components"."install_year" between 1700 and 2200)),
	CONSTRAINT "components_additional_properties_object" CHECK ("components"."additional_properties" is null or jsonb_typeof("components"."additional_properties") = 'object')
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bridge_id" uuid,
	"partial_structure_id" uuid,
	"type" text NOT NULL,
	"original_filename" text NOT NULL,
	"status" "document_status" NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_type_not_blank" CHECK (btrim("documents"."type") <> ''),
	CONSTRAINT "documents_original_filename_not_blank" CHECK (btrim("documents"."original_filename") <> ''),
	CONSTRAINT "documents_partial_structure_requires_bridge" CHECK ("documents"."partial_structure_id" is null or "documents"."bridge_id" is not null),
	CONSTRAINT "documents_metadata_object" CHECK ("documents"."metadata" is null or jsonb_typeof("documents"."metadata") = 'object')
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bridge_id" uuid NOT NULL,
	"partial_structure_id" uuid NOT NULL,
	"inspection_id" uuid NOT NULL,
	"component_id" uuid,
	"source_identifier" text,
	"defect_type" text,
	"description" text,
	"location" text,
	"extent" text,
	"dimension_length" numeric(14, 3),
	"dimension_width" numeric(14, 3),
	"dimension_depth" numeric(14, 3),
	"dimension_unit" text,
	"quantity" numeric(16, 3),
	"quantity_unit" text,
	"stability_rating" smallint,
	"traffic_safety_rating" smallint,
	"durability_rating" smallint,
	"status" "finding_status",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "findings_id_bridge_partial_unique" UNIQUE("id","bridge_id","partial_structure_id"),
	CONSTRAINT "findings_description_not_blank" CHECK ("findings"."description" is null or btrim("findings"."description") <> ''),
	CONSTRAINT "findings_non_negative_measurements" CHECK (("findings"."dimension_length" is null or "findings"."dimension_length" >= 0)
        and ("findings"."dimension_width" is null or "findings"."dimension_width" >= 0)
        and ("findings"."dimension_depth" is null or "findings"."dimension_depth" >= 0)
        and ("findings"."quantity" is null or "findings"."quantity" >= 0)),
	CONSTRAINT "findings_dimension_unit_pair" CHECK ((
        ("findings"."dimension_length" is null and "findings"."dimension_width" is null and "findings"."dimension_depth" is null and "findings"."dimension_unit" is null)
        or
        (("findings"."dimension_length" is not null or "findings"."dimension_width" is not null or "findings"."dimension_depth" is not null)
          and nullif(btrim("findings"."dimension_unit"), '') is not null)
      )),
	CONSTRAINT "findings_quantity_unit_pair" CHECK (("findings"."quantity" is null and "findings"."quantity_unit" is null)
        or ("findings"."quantity" is not null and nullif(btrim("findings"."quantity_unit"), '') is not null)),
	CONSTRAINT "findings_svd_ranges" CHECK (("findings"."stability_rating" is null or "findings"."stability_rating" between 0 and 4)
        and ("findings"."traffic_safety_rating" is null or "findings"."traffic_safety_rating" between 0 and 4)
        and ("findings"."durability_rating" is null or "findings"."durability_rating" between 0 and 4))
);
--> statement-breakpoint
CREATE TABLE "historical_works" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bridge_id" uuid NOT NULL,
	"partial_structure_id" uuid,
	"type" text,
	"title" text,
	"reason" text,
	"contractor" text,
	"client" text,
	"started_on" date,
	"ended_on" date,
	"quantity" numeric(16, 3),
	"unit" text,
	"contract_amount" numeric(16, 2),
	"final_amount" numeric(16, 2),
	"currency" char(3),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "historical_works_title_not_blank" CHECK ("historical_works"."title" is null or btrim("historical_works"."title") <> ''),
	CONSTRAINT "historical_works_date_order" CHECK ("historical_works"."started_on" is null or "historical_works"."ended_on" is null or "historical_works"."ended_on" >= "historical_works"."started_on"),
	CONSTRAINT "historical_works_quantity_unit_pair" CHECK (("historical_works"."quantity" is null and "historical_works"."unit" is null)
        or ("historical_works"."quantity" >= 0 and nullif(btrim("historical_works"."unit"), '') is not null)),
	CONSTRAINT "historical_works_amount_currency_pair" CHECK (("historical_works"."contract_amount" is null and "historical_works"."final_amount" is null and "historical_works"."currency" is null)
        or (
          ("historical_works"."contract_amount" is not null or "historical_works"."final_amount" is not null)
          and ("historical_works"."contract_amount" is null or "historical_works"."contract_amount" >= 0)
          and ("historical_works"."final_amount" is null or "historical_works"."final_amount" >= 0)
          and "historical_works"."currency" ~ '^[A-Z]{3}$'
        ))
);
--> statement-breakpoint
CREATE TABLE "inspections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bridge_id" uuid NOT NULL,
	"partial_structure_id" uuid NOT NULL,
	"type" "inspection_type",
	"inspected_on" date,
	"inspector" text,
	"condition_score" numeric(2, 1),
	"cycle_months" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inspections_id_bridge_partial_unique" UNIQUE("id","bridge_id","partial_structure_id"),
	CONSTRAINT "inspections_condition_score_range" CHECK ("inspections"."condition_score" is null or "inspections"."condition_score" between 1.0 and 4.0),
	CONSTRAINT "inspections_positive_cycle_months" CHECK ("inspections"."cycle_months" is null or "inspections"."cycle_months" > 0)
);
--> statement-breakpoint
CREATE TABLE "bridge_evidence" (
	"bridge_id" uuid NOT NULL,
	"evidence_id" uuid NOT NULL,
	"field_name" text NOT NULL,
	"kind" "provenance_kind" NOT NULL,
	"derivation_method" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bridge_evidence_bridge_id_evidence_id_field_name_pk" PRIMARY KEY("bridge_id","evidence_id","field_name"),
	CONSTRAINT "bridge_evidence_field_name_valid" CHECK ("bridge_evidence"."field_name" in (
        '$', 'externalStructureNumber', 'name', 'road', 'location.countryCode',
        'location.federalState', 'location.district', 'location.municipality',
        'location.locality', 'location.postalCode', 'location.stationing',
        'location.crossedFeature', 'location.latitude', 'location.longitude',
        'owner', 'loadBearingResponsibility', 'responsibleAuthority', 'maintenanceOffice'
      )),
	CONSTRAINT "bridge_evidence_derivation_valid" CHECK (("bridge_evidence"."kind" = 'SOURCE_FACT' and "bridge_evidence"."derivation_method" is null)
        or ("bridge_evidence"."kind" = 'DERIVED' and nullif(btrim("bridge_evidence"."derivation_method"), '') is not null))
);
--> statement-breakpoint
CREATE TABLE "component_evidence" (
	"component_id" uuid NOT NULL,
	"evidence_id" uuid NOT NULL,
	"field_name" text NOT NULL,
	"kind" "provenance_kind" NOT NULL,
	"derivation_method" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "component_evidence_component_id_evidence_id_field_name_pk" PRIMARY KEY("component_id","evidence_id","field_name"),
	CONSTRAINT "component_evidence_field_name_valid" CHECK ("component_evidence"."field_name" in (
        '$', 'type', 'name', 'location', 'material', 'constructionYear', 'installYear',
        'additionalProperties'
      )),
	CONSTRAINT "component_evidence_derivation_valid" CHECK (("component_evidence"."kind" = 'SOURCE_FACT' and "component_evidence"."derivation_method" is null)
        or ("component_evidence"."kind" = 'DERIVED' and nullif(btrim("component_evidence"."derivation_method"), '') is not null))
);
--> statement-breakpoint
CREATE TABLE "finding_evidence" (
	"finding_id" uuid NOT NULL,
	"evidence_id" uuid NOT NULL,
	"field_name" text NOT NULL,
	"kind" "provenance_kind" NOT NULL,
	"derivation_method" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finding_evidence_finding_id_evidence_id_field_name_pk" PRIMARY KEY("finding_id","evidence_id","field_name"),
	CONSTRAINT "finding_evidence_field_name_valid" CHECK ("finding_evidence"."field_name" in (
        '$', 'sourceIdentifier', 'defectType', 'description', 'location', 'extent',
        'dimensionLength', 'dimensionWidth', 'dimensionDepth', 'dimensionUnit',
        'quantity', 'quantityUnit', 'stabilityRating', 'trafficSafetyRating',
        'durabilityRating', 'status', 'componentId'
      )),
	CONSTRAINT "finding_evidence_derivation_valid" CHECK (("finding_evidence"."kind" = 'SOURCE_FACT' and "finding_evidence"."derivation_method" is null)
        or ("finding_evidence"."kind" = 'DERIVED' and nullif(btrim("finding_evidence"."derivation_method"), '') is not null))
);
--> statement-breakpoint
CREATE TABLE "historical_work_evidence" (
	"historical_work_id" uuid NOT NULL,
	"evidence_id" uuid NOT NULL,
	"field_name" text NOT NULL,
	"kind" "provenance_kind" NOT NULL,
	"derivation_method" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "historical_work_evidence_historical_work_id_evidence_id_field_name_pk" PRIMARY KEY("historical_work_id","evidence_id","field_name"),
	CONSTRAINT "historical_work_evidence_field_name_valid" CHECK ("historical_work_evidence"."field_name" in (
        '$', 'partialStructureId', 'type', 'title', 'reason', 'contractor', 'client',
        'startedOn', 'endedOn', 'quantity', 'unit', 'contractAmount', 'finalAmount', 'currency'
      )),
	CONSTRAINT "historical_work_evidence_derivation_valid" CHECK (("historical_work_evidence"."kind" = 'SOURCE_FACT' and "historical_work_evidence"."derivation_method" is null)
        or ("historical_work_evidence"."kind" = 'DERIVED' and nullif(btrim("historical_work_evidence"."derivation_method"), '') is not null))
);
--> statement-breakpoint
CREATE TABLE "inspection_evidence" (
	"inspection_id" uuid NOT NULL,
	"evidence_id" uuid NOT NULL,
	"field_name" text NOT NULL,
	"kind" "provenance_kind" NOT NULL,
	"derivation_method" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inspection_evidence_inspection_id_evidence_id_field_name_pk" PRIMARY KEY("inspection_id","evidence_id","field_name"),
	CONSTRAINT "inspection_evidence_field_name_valid" CHECK ("inspection_evidence"."field_name" in (
        '$', 'type', 'inspectedOn', 'inspector', 'conditionScore', 'cycleMonths'
      )),
	CONSTRAINT "inspection_evidence_derivation_valid" CHECK (("inspection_evidence"."kind" = 'SOURCE_FACT' and "inspection_evidence"."derivation_method" is null)
        or ("inspection_evidence"."kind" = 'DERIVED' and nullif(btrim("inspection_evidence"."derivation_method"), '') is not null))
);
--> statement-breakpoint
CREATE TABLE "partial_structure_evidence" (
	"partial_structure_id" uuid NOT NULL,
	"evidence_id" uuid NOT NULL,
	"field_name" text NOT NULL,
	"kind" "provenance_kind" NOT NULL,
	"derivation_method" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partial_structure_evidence_partial_structure_id_evidence_id_field_name_pk" PRIMARY KEY("partial_structure_id","evidence_id","field_name"),
	CONSTRAINT "partial_structure_evidence_field_name_valid" CHECK ("partial_structure_evidence"."field_name" in (
        '$', 'externalPartialStructureNumber', 'name', 'constructionYear', 'structureType',
        'structuralSystem', 'lengthM', 'widthM', 'areaSqM', 'clearHeightM', 'spanCount'
      )),
	CONSTRAINT "partial_structure_evidence_derivation_valid" CHECK (("partial_structure_evidence"."kind" = 'SOURCE_FACT' and "partial_structure_evidence"."derivation_method" is null)
        or ("partial_structure_evidence"."kind" = 'DERIVED' and nullif(btrim("partial_structure_evidence"."derivation_method"), '') is not null))
);
--> statement-breakpoint
CREATE TABLE "recommendation_evidence" (
	"recommendation_id" uuid NOT NULL,
	"evidence_id" uuid NOT NULL,
	"field_name" text NOT NULL,
	"kind" "provenance_kind" NOT NULL,
	"derivation_method" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recommendation_evidence_recommendation_id_evidence_id_field_name_pk" PRIMARY KEY("recommendation_id","evidence_id","field_name"),
	CONSTRAINT "recommendation_evidence_field_name_valid" CHECK ("recommendation_evidence"."field_name" in (
        '$', 'workType', 'description', 'urgency', 'quantity', 'unit',
        'sourceEstimatedCost', 'sourceEstimatedCostCurrency', 'targetYear', 'plannedYear', 'status'
      )),
	CONSTRAINT "recommendation_evidence_derivation_valid" CHECK (("recommendation_evidence"."kind" = 'SOURCE_FACT' and "recommendation_evidence"."derivation_method" is null)
        or ("recommendation_evidence"."kind" = 'DERIVED' and nullif(btrim("recommendation_evidence"."derivation_method"), '') is not null))
);
--> statement-breakpoint
CREATE TABLE "source_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"page_number" integer,
	"source_excerpt" text,
	"bounding_box_x" numeric(8, 6),
	"bounding_box_y" numeric(8, 6),
	"bounding_box_width" numeric(8, 6),
	"bounding_box_height" numeric(8, 6),
	"extraction_confidence" numeric(4, 3),
	"extraction_method" "extraction_method" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_evidence_positive_page_number" CHECK ("source_evidence"."page_number" is null or "source_evidence"."page_number" > 0),
	CONSTRAINT "source_evidence_excerpt_not_blank" CHECK ("source_evidence"."source_excerpt" is null or btrim("source_evidence"."source_excerpt") <> ''),
	CONSTRAINT "source_evidence_bounding_box_complete" CHECK ((
        "source_evidence"."bounding_box_x" is null and "source_evidence"."bounding_box_y" is null
        and "source_evidence"."bounding_box_width" is null and "source_evidence"."bounding_box_height" is null
      ) or (
        "source_evidence"."bounding_box_x" is not null and "source_evidence"."bounding_box_y" is not null
        and "source_evidence"."bounding_box_width" is not null and "source_evidence"."bounding_box_height" is not null
        and "source_evidence"."page_number" is not null
      )),
	CONSTRAINT "source_evidence_bounding_box_range" CHECK ("source_evidence"."bounding_box_x" is null or (
        "source_evidence"."bounding_box_x" between 0 and 1
        and "source_evidence"."bounding_box_y" between 0 and 1
        and "source_evidence"."bounding_box_width" > 0 and "source_evidence"."bounding_box_width" <= 1
        and "source_evidence"."bounding_box_height" > 0 and "source_evidence"."bounding_box_height" <= 1
        and "source_evidence"."bounding_box_x" + "source_evidence"."bounding_box_width" <= 1
        and "source_evidence"."bounding_box_y" + "source_evidence"."bounding_box_height" <= 1
      )),
	CONSTRAINT "source_evidence_confidence_range" CHECK ("source_evidence"."extraction_confidence" is null or "source_evidence"."extraction_confidence" between 0 and 1)
);
--> statement-breakpoint
CREATE TABLE "traffic_observation_evidence" (
	"traffic_observation_id" uuid NOT NULL,
	"evidence_id" uuid NOT NULL,
	"field_name" text NOT NULL,
	"kind" "provenance_kind" NOT NULL,
	"derivation_method" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "traffic_observation_evidence_traffic_observation_id_evidence_id_field_name_pk" PRIMARY KEY("traffic_observation_id","evidence_id","field_name"),
	CONSTRAINT "traffic_observation_evidence_field_name_valid" CHECK ("traffic_observation_evidence"."field_name" in (
        '$', 'observationYear', 'observedOn', 'dailyTraffic', 'truckSharePercent',
        'sourceDescription'
      )),
	CONSTRAINT "traffic_observation_evidence_derivation_valid" CHECK (("traffic_observation_evidence"."kind" = 'SOURCE_FACT' and "traffic_observation_evidence"."derivation_method" is null)
        or ("traffic_observation_evidence"."kind" = 'DERIVED' and nullif(btrim("traffic_observation_evidence"."derivation_method"), '') is not null))
);
--> statement-breakpoint
CREATE TABLE "recommendation_findings" (
	"bridge_id" uuid NOT NULL,
	"partial_structure_id" uuid NOT NULL,
	"recommendation_id" uuid NOT NULL,
	"finding_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recommendation_findings_pk" PRIMARY KEY("recommendation_id","finding_id")
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bridge_id" uuid NOT NULL,
	"partial_structure_id" uuid NOT NULL,
	"work_type" text,
	"description" text,
	"urgency" text,
	"quantity" numeric(16, 3),
	"unit" text,
	"source_estimated_cost" numeric(16, 2),
	"source_estimated_cost_currency" char(3),
	"target_year" smallint,
	"planned_year" smallint,
	"status" "recommendation_status",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recommendations_id_bridge_partial_unique" UNIQUE("id","bridge_id","partial_structure_id"),
	CONSTRAINT "recommendations_description_not_blank" CHECK ("recommendations"."description" is null or btrim("recommendations"."description") <> ''),
	CONSTRAINT "recommendations_quantity_unit_pair" CHECK (("recommendations"."quantity" is null and "recommendations"."unit" is null)
        or ("recommendations"."quantity" >= 0 and nullif(btrim("recommendations"."unit"), '') is not null)),
	CONSTRAINT "recommendations_estimated_cost_pair" CHECK (("recommendations"."source_estimated_cost" is null and "recommendations"."source_estimated_cost_currency" is null)
        or ("recommendations"."source_estimated_cost" >= 0 and "recommendations"."source_estimated_cost_currency" ~ '^[A-Z]{3}$')),
	CONSTRAINT "recommendations_year_ranges" CHECK (("recommendations"."target_year" is null or "recommendations"."target_year" between 1700 and 2200)
        and ("recommendations"."planned_year" is null or "recommendations"."planned_year" between 1700 and 2200))
);
--> statement-breakpoint
CREATE TABLE "traffic_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bridge_id" uuid NOT NULL,
	"observation_year" smallint NOT NULL,
	"observed_on" date,
	"daily_traffic" integer,
	"truck_share_percent" numeric(5, 2),
	"source_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "traffic_observations_year_range" CHECK ("traffic_observations"."observation_year" between 1900 and 2200),
	CONSTRAINT "traffic_observations_date_matches_year" CHECK ("traffic_observations"."observed_on" is null or extract(year from "traffic_observations"."observed_on") = "traffic_observations"."observation_year"),
	CONSTRAINT "traffic_observations_non_negative_daily_traffic" CHECK ("traffic_observations"."daily_traffic" is null or "traffic_observations"."daily_traffic" >= 0),
	CONSTRAINT "traffic_observations_truck_share_range" CHECK ("traffic_observations"."truck_share_percent" is null or "traffic_observations"."truck_share_percent" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "partial_structures" ADD CONSTRAINT "partial_structures_bridge_id_bridges_id_fk" FOREIGN KEY ("bridge_id") REFERENCES "public"."bridges"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_bridge_id_bridges_id_fk" FOREIGN KEY ("bridge_id") REFERENCES "public"."bridges"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_partial_structure_bridge_fk" FOREIGN KEY ("partial_structure_id","bridge_id") REFERENCES "public"."partial_structures"("id","bridge_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_bridge_id_bridges_id_fk" FOREIGN KEY ("bridge_id") REFERENCES "public"."bridges"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_partial_structure_bridge_fk" FOREIGN KEY ("partial_structure_id","bridge_id") REFERENCES "public"."partial_structures"("id","bridge_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_bridge_id_bridges_id_fk" FOREIGN KEY ("bridge_id") REFERENCES "public"."bridges"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_partial_structure_bridge_fk" FOREIGN KEY ("partial_structure_id","bridge_id") REFERENCES "public"."partial_structures"("id","bridge_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_inspection_scope_fk" FOREIGN KEY ("inspection_id","bridge_id","partial_structure_id") REFERENCES "public"."inspections"("id","bridge_id","partial_structure_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_component_scope_fk" FOREIGN KEY ("component_id","bridge_id","partial_structure_id") REFERENCES "public"."components"("id","bridge_id","partial_structure_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "historical_works" ADD CONSTRAINT "historical_works_bridge_id_bridges_id_fk" FOREIGN KEY ("bridge_id") REFERENCES "public"."bridges"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "historical_works" ADD CONSTRAINT "historical_works_partial_structure_bridge_fk" FOREIGN KEY ("partial_structure_id","bridge_id") REFERENCES "public"."partial_structures"("id","bridge_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_bridge_id_bridges_id_fk" FOREIGN KEY ("bridge_id") REFERENCES "public"."bridges"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_partial_structure_bridge_fk" FOREIGN KEY ("partial_structure_id","bridge_id") REFERENCES "public"."partial_structures"("id","bridge_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bridge_evidence" ADD CONSTRAINT "bridge_evidence_bridge_id_bridges_id_fk" FOREIGN KEY ("bridge_id") REFERENCES "public"."bridges"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bridge_evidence" ADD CONSTRAINT "bridge_evidence_evidence_id_source_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."source_evidence"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "component_evidence" ADD CONSTRAINT "component_evidence_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "component_evidence" ADD CONSTRAINT "component_evidence_evidence_id_source_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."source_evidence"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "finding_evidence" ADD CONSTRAINT "finding_evidence_finding_id_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."findings"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "finding_evidence" ADD CONSTRAINT "finding_evidence_evidence_id_source_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."source_evidence"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "historical_work_evidence" ADD CONSTRAINT "historical_work_evidence_historical_work_id_historical_works_id_fk" FOREIGN KEY ("historical_work_id") REFERENCES "public"."historical_works"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "historical_work_evidence" ADD CONSTRAINT "historical_work_evidence_evidence_id_source_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."source_evidence"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inspection_evidence" ADD CONSTRAINT "inspection_evidence_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inspection_evidence" ADD CONSTRAINT "inspection_evidence_evidence_id_source_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."source_evidence"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "partial_structure_evidence" ADD CONSTRAINT "partial_structure_evidence_partial_structure_id_partial_structures_id_fk" FOREIGN KEY ("partial_structure_id") REFERENCES "public"."partial_structures"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "partial_structure_evidence" ADD CONSTRAINT "partial_structure_evidence_evidence_id_source_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."source_evidence"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "recommendation_evidence" ADD CONSTRAINT "recommendation_evidence_recommendation_id_recommendations_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."recommendations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "recommendation_evidence" ADD CONSTRAINT "recommendation_evidence_evidence_id_source_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."source_evidence"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "source_evidence" ADD CONSTRAINT "source_evidence_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "traffic_observation_evidence" ADD CONSTRAINT "traffic_observation_evidence_traffic_observation_id_traffic_observations_id_fk" FOREIGN KEY ("traffic_observation_id") REFERENCES "public"."traffic_observations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "traffic_observation_evidence" ADD CONSTRAINT "traffic_observation_evidence_evidence_id_source_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."source_evidence"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "recommendation_findings" ADD CONSTRAINT "recommendation_findings_recommendation_scope_fk" FOREIGN KEY ("recommendation_id","bridge_id","partial_structure_id") REFERENCES "public"."recommendations"("id","bridge_id","partial_structure_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "recommendation_findings" ADD CONSTRAINT "recommendation_findings_finding_scope_fk" FOREIGN KEY ("finding_id","bridge_id","partial_structure_id") REFERENCES "public"."findings"("id","bridge_id","partial_structure_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_bridge_id_bridges_id_fk" FOREIGN KEY ("bridge_id") REFERENCES "public"."bridges"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_partial_structure_bridge_fk" FOREIGN KEY ("partial_structure_id","bridge_id") REFERENCES "public"."partial_structures"("id","bridge_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "traffic_observations" ADD CONSTRAINT "traffic_observations_bridge_id_bridges_id_fk" FOREIGN KEY ("bridge_id") REFERENCES "public"."bridges"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "bridges_external_structure_number_unique" ON "bridges" USING btree ("external_structure_number");--> statement-breakpoint
CREATE INDEX "bridges_road_idx" ON "bridges" USING btree ("road");--> statement-breakpoint
CREATE INDEX "bridges_federal_state_idx" ON "bridges" USING btree ("federal_state");--> statement-breakpoint
CREATE INDEX "bridges_responsible_authority_idx" ON "bridges" USING btree ("responsible_authority");--> statement-breakpoint
CREATE INDEX "bridges_maintenance_office_idx" ON "bridges" USING btree ("maintenance_office");--> statement-breakpoint
CREATE UNIQUE INDEX "partial_structures_bridge_external_number_unique" ON "partial_structures" USING btree ("bridge_id","external_partial_structure_number");--> statement-breakpoint
CREATE INDEX "partial_structures_bridge_id_idx" ON "partial_structures" USING btree ("bridge_id");--> statement-breakpoint
CREATE INDEX "components_bridge_id_idx" ON "components" USING btree ("bridge_id");--> statement-breakpoint
CREATE INDEX "components_partial_structure_id_idx" ON "components" USING btree ("partial_structure_id");--> statement-breakpoint
CREATE INDEX "components_type_idx" ON "components" USING btree ("type");--> statement-breakpoint
CREATE INDEX "documents_bridge_id_idx" ON "documents" USING btree ("bridge_id");--> statement-breakpoint
CREATE INDEX "documents_partial_structure_id_idx" ON "documents" USING btree ("partial_structure_id");--> statement-breakpoint
CREATE INDEX "documents_status_idx" ON "documents" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "findings_inspection_source_identifier_unique" ON "findings" USING btree ("inspection_id","source_identifier");--> statement-breakpoint
CREATE INDEX "findings_bridge_status_idx" ON "findings" USING btree ("bridge_id","status");--> statement-breakpoint
CREATE INDEX "findings_partial_structure_idx" ON "findings" USING btree ("partial_structure_id");--> statement-breakpoint
CREATE INDEX "findings_inspection_id_idx" ON "findings" USING btree ("inspection_id");--> statement-breakpoint
CREATE INDEX "findings_component_id_idx" ON "findings" USING btree ("component_id");--> statement-breakpoint
CREATE INDEX "historical_works_bridge_start_date_idx" ON "historical_works" USING btree ("bridge_id","started_on");--> statement-breakpoint
CREATE INDEX "historical_works_partial_structure_idx" ON "historical_works" USING btree ("partial_structure_id");--> statement-breakpoint
CREATE INDEX "inspections_bridge_date_idx" ON "inspections" USING btree ("bridge_id","inspected_on");--> statement-breakpoint
CREATE INDEX "inspections_partial_structure_date_idx" ON "inspections" USING btree ("partial_structure_id","inspected_on");--> statement-breakpoint
CREATE INDEX "bridge_evidence_evidence_id_idx" ON "bridge_evidence" USING btree ("evidence_id");--> statement-breakpoint
CREATE INDEX "component_evidence_evidence_id_idx" ON "component_evidence" USING btree ("evidence_id");--> statement-breakpoint
CREATE INDEX "finding_evidence_evidence_id_idx" ON "finding_evidence" USING btree ("evidence_id");--> statement-breakpoint
CREATE INDEX "historical_work_evidence_evidence_id_idx" ON "historical_work_evidence" USING btree ("evidence_id");--> statement-breakpoint
CREATE INDEX "inspection_evidence_evidence_id_idx" ON "inspection_evidence" USING btree ("evidence_id");--> statement-breakpoint
CREATE INDEX "partial_structure_evidence_evidence_id_idx" ON "partial_structure_evidence" USING btree ("evidence_id");--> statement-breakpoint
CREATE INDEX "recommendation_evidence_evidence_id_idx" ON "recommendation_evidence" USING btree ("evidence_id");--> statement-breakpoint
CREATE INDEX "source_evidence_document_page_idx" ON "source_evidence" USING btree ("document_id","page_number");--> statement-breakpoint
CREATE INDEX "traffic_observation_evidence_evidence_id_idx" ON "traffic_observation_evidence" USING btree ("evidence_id");--> statement-breakpoint
CREATE INDEX "recommendation_findings_finding_id_idx" ON "recommendation_findings" USING btree ("finding_id");--> statement-breakpoint
CREATE INDEX "recommendations_bridge_status_idx" ON "recommendations" USING btree ("bridge_id","status");--> statement-breakpoint
CREATE INDEX "recommendations_partial_structure_idx" ON "recommendations" USING btree ("partial_structure_id");--> statement-breakpoint
CREATE INDEX "recommendations_planned_year_idx" ON "recommendations" USING btree ("planned_year");--> statement-breakpoint
CREATE INDEX "traffic_observations_bridge_year_idx" ON "traffic_observations" USING btree ("bridge_id","observation_year");