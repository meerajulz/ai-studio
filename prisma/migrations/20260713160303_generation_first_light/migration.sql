/*
  Warnings:

  - Added the required column `pathname` to the `GeneratedMedia` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "GeneratedMedia" ADD COLUMN     "originalFilename" TEXT,
ADD COLUMN     "pathname" TEXT NOT NULL,
ADD COLUMN     "projectId" TEXT;

-- CreateIndex
CREATE INDEX "GeneratedMedia_projectId_idx" ON "GeneratedMedia"("projectId");

-- AddForeignKey
ALTER TABLE "GeneratedMedia" ADD CONSTRAINT "GeneratedMedia_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
