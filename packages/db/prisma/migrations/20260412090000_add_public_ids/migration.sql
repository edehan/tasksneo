ALTER TABLE "classes" ADD COLUMN "public_id" VARCHAR(8);
ALTER TABLE "tasks" ADD COLUMN "public_id" VARCHAR(8);
ALTER TABLE "submissions" ADD COLUMN "public_id" VARCHAR(8);

CREATE OR REPLACE FUNCTION generate_public_id(len integer)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
	alphabet constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	result text := '';
	idx integer;
BEGIN
	IF len <= 0 THEN
		RETURN result;
	END IF;

	FOR idx IN 1..len LOOP
		result := result || substr(alphabet, floor(random() * length(alphabet) + 1)::integer, 1);
	END LOOP;

	RETURN result;
END;
$$;

DO $$
DECLARE
	record_item record;
	candidate text;
BEGIN
	FOR record_item IN SELECT id FROM "classes" WHERE "public_id" IS NULL LOOP
		LOOP
			candidate := generate_public_id(8);
			EXIT WHEN NOT EXISTS (
				SELECT 1 FROM "classes" WHERE "public_id" = candidate
			);
		END LOOP;

		UPDATE "classes"
		SET "public_id" = candidate
		WHERE id = record_item.id;
	END LOOP;

	FOR record_item IN SELECT id FROM "tasks" WHERE "public_id" IS NULL LOOP
		LOOP
			candidate := generate_public_id(8);
			EXIT WHEN NOT EXISTS (
				SELECT 1 FROM "tasks" WHERE "public_id" = candidate
			);
		END LOOP;

		UPDATE "tasks"
		SET "public_id" = candidate
		WHERE id = record_item.id;
	END LOOP;

	FOR record_item IN SELECT id FROM "submissions" WHERE "public_id" IS NULL LOOP
		LOOP
			candidate := generate_public_id(8);
			EXIT WHEN NOT EXISTS (
				SELECT 1 FROM "submissions" WHERE "public_id" = candidate
			);
		END LOOP;

		UPDATE "submissions"
		SET "public_id" = candidate
		WHERE id = record_item.id;
	END LOOP;
END;
$$;

ALTER TABLE "classes" ALTER COLUMN "public_id" SET NOT NULL;
ALTER TABLE "tasks" ALTER COLUMN "public_id" SET NOT NULL;
ALTER TABLE "submissions" ALTER COLUMN "public_id" SET NOT NULL;

CREATE UNIQUE INDEX "classes_public_id_key" ON "classes"("public_id");
CREATE UNIQUE INDEX "tasks_public_id_key" ON "tasks"("public_id");
CREATE UNIQUE INDEX "submissions_public_id_key" ON "submissions"("public_id");

DROP FUNCTION generate_public_id(integer);
