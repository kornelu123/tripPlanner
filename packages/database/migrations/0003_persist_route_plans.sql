ALTER TABLE "routes" ADD COLUMN "round_trip" boolean DEFAULT false NOT NULL;
ALTER TABLE "routes" ADD COLUMN "fixed_start_trip_point_id" uuid REFERENCES "trip_points"("id") ON DELETE SET NULL;
ALTER TABLE "routes" ADD COLUMN "fixed_end_trip_point_id" uuid REFERENCES "trip_points"("id") ON DELETE SET NULL;
ALTER TABLE "routes" ADD COLUMN "point_order" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "routes" ADD COLUMN "optimization_method" varchar(20) DEFAULT 'manual' NOT NULL;
ALTER TABLE "routes" ADD COLUMN "provider_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "routes" ADD CONSTRAINT "routes_mode_check" CHECK ("mode" IN ('driving', 'walking'));
ALTER TABLE "routes" ADD CONSTRAINT "routes_optimization_method_check" CHECK ("optimization_method" IN ('exact', 'heuristic', 'manual'));
