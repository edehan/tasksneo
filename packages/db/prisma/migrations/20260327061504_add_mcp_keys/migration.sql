-- CreateTable
CREATE TABLE "mcp_keys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "last_used_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "mcp_keys_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "mcp_keys" ADD CONSTRAINT "mcp_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
