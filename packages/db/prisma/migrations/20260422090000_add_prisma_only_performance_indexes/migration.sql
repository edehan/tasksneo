-- CreateIndex
CREATE INDEX "idx_class_members_class_joined" ON "class_members"("class_id", "joined_at");

-- CreateIndex
CREATE INDEX "idx_class_members_user_joined" ON "class_members"("user_id", "joined_at");

-- CreateIndex
CREATE INDEX "idx_class_members_class_role" ON "class_members"("class_id", "role");

-- CreateIndex
CREATE INDEX "idx_submissions_user_task" ON "submissions"("user_id", "task_id");

-- CreateIndex
CREATE INDEX "idx_attachments_avatar_user" ON "attachments"("avatar_user_id");

-- CreateIndex
CREATE INDEX "idx_attachments_class" ON "attachments"("class_id");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_keys_key_hash_key" ON "mcp_keys"("key_hash");

-- CreateIndex
CREATE INDEX "idx_mcp_keys_user_revoked" ON "mcp_keys"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "idx_sessions_mcp_key" ON "sessions"("mcp_key_id");
