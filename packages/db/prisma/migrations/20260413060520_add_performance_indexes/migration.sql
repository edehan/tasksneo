-- CreateIndex
CREATE INDEX "attachments_task_id_idx" ON "attachments"("task_id");

-- CreateIndex
CREATE INDEX "attachments_submission_id_idx" ON "attachments"("submission_id");

-- CreateIndex
CREATE INDEX "class_members_user_id_idx" ON "class_members"("user_id");

-- CreateIndex
CREATE INDEX "notification_jobs_task_id_idx" ON "notification_jobs"("task_id");

-- CreateIndex
CREATE INDEX "submissions_task_id_idx" ON "submissions"("task_id");

-- CreateIndex
CREATE INDEX "task_user_state_user_id_idx" ON "task_user_state"("user_id");

-- CreateIndex
CREATE INDEX "tasks_class_id_is_published_deleted_at_created_at_idx" ON "tasks"("class_id", "is_published", "deleted_at", "created_at" DESC);
