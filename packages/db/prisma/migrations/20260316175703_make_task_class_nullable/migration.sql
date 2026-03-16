-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_class_id_fkey";

-- AlterTable
ALTER TABLE "tasks" ALTER COLUMN "class_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
