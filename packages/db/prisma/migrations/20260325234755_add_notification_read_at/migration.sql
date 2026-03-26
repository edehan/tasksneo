-- AlterTable
ALTER TABLE "notification_jobs" ADD COLUMN     "read_at" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "idx_notif_user_status_created" ON "notification_jobs"("user_id", "status", "created_at" DESC);
