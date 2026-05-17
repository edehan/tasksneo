CREATE TYPE "audit_actor_type" AS ENUM ('USER', 'ADMIN', 'SYSTEM');

CREATE SEQUENCE "audit_logs_sequence_seq";

CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "sequence" BIGINT NOT NULL DEFAULT nextval('audit_logs_sequence_seq'),
  "action" VARCHAR(100) NOT NULL,
  "actor_type" "audit_actor_type" NOT NULL,
  "actor_user_id" TEXT,
  "target_type" VARCHAR(100),
  "target_id" TEXT,
  "class_id" TEXT,
  "metadata" JSONB,
  "ip_address" VARCHAR(45),
  "user_agent" VARCHAR(512),
  "request_id" VARCHAR(128),
  "prev_hash" CHAR(64),
  "entry_hash" CHAR(64) NOT NULL,
  "hash_algorithm" VARCHAR(32) NOT NULL DEFAULT 'HMAC-SHA256',
  "hash_key_id" VARCHAR(100) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_logs_sequence_key" UNIQUE ("sequence")
);

ALTER SEQUENCE "audit_logs_sequence_seq" OWNED BY "audit_logs"."sequence";

CREATE INDEX "idx_audit_logs_created" ON "audit_logs" ("created_at" DESC);
CREATE INDEX "idx_audit_logs_action_created" ON "audit_logs" ("action", "created_at" DESC);
CREATE INDEX "idx_audit_logs_actor_created" ON "audit_logs" ("actor_user_id", "created_at" DESC);
CREATE INDEX "idx_audit_logs_target" ON "audit_logs" ("target_type", "target_id");
CREATE INDEX "idx_audit_logs_class_created" ON "audit_logs" ("class_id", "created_at" DESC);

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_audit_logs_no_update"
BEFORE UPDATE ON "audit_logs"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

CREATE TRIGGER "trg_audit_logs_no_delete"
BEFORE DELETE ON "audit_logs"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
