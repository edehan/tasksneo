-- CreateTable
CREATE TABLE "site_announcements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "scheduled_at" TIMESTAMPTZ NOT NULL,
    "published_at" TIMESTAMPTZ,
    "cancelled_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_announcements_pkey" PRIMARY KEY ("id")
);
