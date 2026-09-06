CREATE TABLE "place_price_estimates" (
  "place_id" uuid PRIMARY KEY NOT NULL REFERENCES "places"("id") ON DELETE CASCADE,
  "price_level" varchar(20) NOT NULL,
  "minimum_amount" numeric(12,2),
  "maximum_amount" numeric(12,2),
  "currency" varchar(3) NOT NULL,
  "unit" varchar(30) NOT NULL,
  "sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "admission_prices" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "original_amounts" jsonb,
  "confidence" numeric(4,3) NOT NULL,
  "last_checked_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "place_price_estimates_level_check" CHECK ("price_level" IN ('budget', 'moderate', 'expensive', 'premium')),
  CONSTRAINT "place_price_estimates_unit_check" CHECK ("unit" IN ('per_person', 'admission', 'typical_meal', 'per_night', 'other')),
  CONSTRAINT "place_price_estimates_confidence_check" CHECK ("confidence" >= 0 AND "confidence" <= 1)
);
