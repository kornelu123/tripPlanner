ALTER TABLE "categories" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_position_check" CHECK ("position" >= 0);
