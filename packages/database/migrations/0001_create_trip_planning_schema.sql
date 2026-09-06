CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar(320) NOT NULL,
  "display_name" varchar(200) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "trips" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
CREATE TABLE "memberships" (
  "trip_id" uuid NOT NULL REFERENCES "trips"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" varchar(20) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("trip_id", "user_id"),
  CONSTRAINT "memberships_role_check" CHECK ("role" IN ('editor', 'viewer'))
);
--> statement-breakpoint
CREATE TABLE "places" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "normalized_address" text NOT NULL,
  "provider_id" varchar(255),
  "display_name" varchar(300) NOT NULL,
  "coordinates" geography(Point,4326) NOT NULL,
  "source_platform" varchar(50),
  "source_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
  "trip_id" uuid REFERENCES "trips"("id") ON DELETE CASCADE,
  "name" varchar(100) NOT NULL,
  "color" varchar(32) NOT NULL,
  "icon" varchar(100) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "categories_one_owner_check" CHECK (("user_id" IS NOT NULL) <> ("trip_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "trip_points" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trip_id" uuid NOT NULL REFERENCES "trips"("id") ON DELETE CASCADE,
  "place_id" uuid NOT NULL REFERENCES "places"("id") ON DELETE RESTRICT,
  "position" integer NOT NULL,
  "category_id" uuid REFERENCES "categories"("id") ON DELETE SET NULL,
  "notes" text,
  "planned_arrival" timestamp with time zone,
  "duration_minutes" integer,
  "status" varchar(20) DEFAULT 'planned' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "trip_points_position_check" CHECK ("position" >= 0),
  CONSTRAINT "trip_points_duration_check" CHECK ("duration_minutes" IS NULL OR "duration_minutes" >= 0),
  CONSTRAINT "trip_points_status_check" CHECK ("status" IN ('planned', 'visited', 'skipped'))
);
--> statement-breakpoint
CREATE TABLE "routes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trip_id" uuid NOT NULL REFERENCES "trips"("id") ON DELETE CASCADE,
  "provider_id" varchar(255),
  "mode" varchar(20) NOT NULL,
  "distance_meters" integer,
  "duration_seconds" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "route_legs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "route_id" uuid NOT NULL REFERENCES "routes"("id") ON DELETE CASCADE,
  "from_trip_point_id" uuid REFERENCES "trip_points"("id") ON DELETE SET NULL,
  "to_trip_point_id" uuid REFERENCES "trip_points"("id") ON DELETE SET NULL,
  "position" integer NOT NULL,
  "distance_meters" integer,
  "duration_seconds" integer,
  "geometry" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_imports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trip_id" uuid NOT NULL REFERENCES "trips"("id") ON DELETE CASCADE,
  "imported_by_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "platform" varchar(50) NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "source_url" text NOT NULL,
  "payload" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "trips_owner_id_idx" ON "trips" ("owner_id");
CREATE UNIQUE INDEX "users_email_idx" ON "users" ("email");
CREATE INDEX "memberships_user_id_idx" ON "memberships" ("user_id");
CREATE INDEX "places_coordinates_gist_idx" ON "places" USING gist ("coordinates");
CREATE UNIQUE INDEX "places_provider_id_idx" ON "places" ("source_platform", "provider_id") WHERE "provider_id" IS NOT NULL;
CREATE INDEX "categories_user_id_idx" ON "categories" ("user_id");
CREATE INDEX "categories_trip_id_idx" ON "categories" ("trip_id");
CREATE INDEX "trip_points_category_id_idx" ON "trip_points" ("category_id");
CREATE UNIQUE INDEX "trip_points_trip_position_idx" ON "trip_points" ("trip_id", "position");
CREATE INDEX "routes_trip_id_idx" ON "routes" ("trip_id");
CREATE UNIQUE INDEX "route_legs_route_position_idx" ON "route_legs" ("route_id", "position");
CREATE INDEX "social_imports_trip_id_idx" ON "social_imports" ("trip_id");
CREATE UNIQUE INDEX "social_imports_platform_external_id_idx" ON "social_imports" ("platform", "external_id");
--> statement-breakpoint
CREATE FUNCTION app_user_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
$$;
--> statement-breakpoint
CREATE FUNCTION can_read_trip(requested_trip_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM trips t
    WHERE t.id = requested_trip_id AND (
      t.owner_id = app_user_id() OR EXISTS (
        SELECT 1 FROM memberships m WHERE m.trip_id = t.id AND m.user_id = app_user_id()
      )
    )
  )
$$;
--> statement-breakpoint
CREATE FUNCTION can_edit_trip(requested_trip_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM trips t
    WHERE t.id = requested_trip_id AND (
      t.owner_id = app_user_id() OR EXISTS (
        SELECT 1 FROM memberships m WHERE m.trip_id = t.id AND m.user_id = app_user_id() AND m.role = 'editor'
      )
    )
  )
$$;
--> statement-breakpoint
ALTER TABLE "trips" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "trip_points" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "routes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "route_legs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "social_imports" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "trips_read" ON "trips" FOR SELECT USING (can_read_trip("id"));
CREATE POLICY "trips_insert" ON "trips" FOR INSERT WITH CHECK ("owner_id" = app_user_id());
CREATE POLICY "trips_update" ON "trips" FOR UPDATE USING (can_edit_trip("id")) WITH CHECK (can_edit_trip("id"));
CREATE POLICY "trips_delete" ON "trips" FOR DELETE USING ("owner_id" = app_user_id());
CREATE POLICY "memberships_read" ON "memberships" FOR SELECT USING (can_read_trip("trip_id"));
CREATE POLICY "memberships_write" ON "memberships" FOR ALL USING (EXISTS (SELECT 1 FROM trips t WHERE t.id = "trip_id" AND t.owner_id = app_user_id())) WITH CHECK (EXISTS (SELECT 1 FROM trips t WHERE t.id = "trip_id" AND t.owner_id = app_user_id()));
CREATE POLICY "categories_access" ON "categories" FOR ALL USING ("user_id" = app_user_id() OR ("trip_id" IS NOT NULL AND can_read_trip("trip_id"))) WITH CHECK ("user_id" = app_user_id() OR ("trip_id" IS NOT NULL AND can_edit_trip("trip_id")));
CREATE POLICY "trip_points_read" ON "trip_points" FOR SELECT USING (can_read_trip("trip_id"));
CREATE POLICY "trip_points_write" ON "trip_points" FOR ALL USING (can_edit_trip("trip_id")) WITH CHECK (can_edit_trip("trip_id"));
CREATE POLICY "routes_read" ON "routes" FOR SELECT USING (can_read_trip("trip_id"));
CREATE POLICY "routes_write" ON "routes" FOR ALL USING (can_edit_trip("trip_id")) WITH CHECK (can_edit_trip("trip_id"));
CREATE POLICY "route_legs_read" ON "route_legs" FOR SELECT USING (EXISTS (SELECT 1 FROM routes r WHERE r.id = "route_id" AND can_read_trip(r.trip_id)));
CREATE POLICY "route_legs_write" ON "route_legs" FOR ALL USING (EXISTS (SELECT 1 FROM routes r WHERE r.id = "route_id" AND can_edit_trip(r.trip_id))) WITH CHECK (EXISTS (SELECT 1 FROM routes r WHERE r.id = "route_id" AND can_edit_trip(r.trip_id)));
CREATE POLICY "social_imports_read" ON "social_imports" FOR SELECT USING (can_read_trip("trip_id"));
CREATE POLICY "social_imports_write" ON "social_imports" FOR ALL USING (can_edit_trip("trip_id")) WITH CHECK (can_edit_trip("trip_id") AND "imported_by_user_id" = app_user_id());
