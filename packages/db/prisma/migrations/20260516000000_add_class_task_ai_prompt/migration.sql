ALTER TABLE "classes" ADD COLUMN "task_ai_prompt" TEXT;

UPDATE "classes"
SET "task_ai_prompt" = 'Title tasks by deliverable, not course name. Include topic, artifact, or milestone. Max 12 words.'
WHERE "task_ai_prompt" IS NULL;

ALTER TABLE "classes"
ALTER COLUMN "task_ai_prompt" SET DEFAULT 'Title tasks by deliverable, not course name. Include topic, artifact, or milestone. Max 12 words.';
