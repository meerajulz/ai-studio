/*
  Warnings:

  - You are about to drop the column `identityId` on the `UploadedMedia` table. All the data in the column will be lost.
  - Made the column `projectId` on table `Identity` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "IdentityStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TrainingMediaRole" AS ENUM ('PRIMARY', 'SECONDARY', 'VIDEO', 'POSE', 'STYLE', 'OTHER');

-- DropForeignKey
ALTER TABLE "Identity" DROP CONSTRAINT "Identity_projectId_fkey";

-- DropForeignKey
ALTER TABLE "UploadedMedia" DROP CONSTRAINT "UploadedMedia_identityId_fkey";

-- DropIndex
DROP INDEX "UploadedMedia_identityId_idx";

-- AlterTable
ALTER TABLE "Identity" ADD COLUMN     "description" TEXT,
ADD COLUMN     "displayImageId" TEXT,
ADD COLUMN     "status" "IdentityStatus" NOT NULL DEFAULT 'DRAFT',
ALTER COLUMN "projectId" SET NOT NULL;

-- AlterTable
ALTER TABLE "UploadedMedia" DROP COLUMN "identityId";

-- CreateTable
CREATE TABLE "IdentityMedia" (
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "role" "TrainingMediaRole" NOT NULL DEFAULT 'OTHER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "identityId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,

    CONSTRAINT "IdentityMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdentityMedia_identityId_idx" ON "IdentityMedia"("identityId");

-- CreateIndex
CREATE INDEX "IdentityMedia_mediaId_idx" ON "IdentityMedia"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityMedia_identityId_mediaId_key" ON "IdentityMedia"("identityId", "mediaId");

-- CreateIndex
CREATE INDEX "Identity_displayImageId_idx" ON "Identity"("displayImageId");

-- AddForeignKey
ALTER TABLE "Identity" ADD CONSTRAINT "Identity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Identity" ADD CONSTRAINT "Identity_displayImageId_fkey" FOREIGN KEY ("displayImageId") REFERENCES "UploadedMedia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityMedia" ADD CONSTRAINT "IdentityMedia_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityMedia" ADD CONSTRAINT "IdentityMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "UploadedMedia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
