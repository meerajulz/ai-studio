/*
  Warnings:

  - Added the required column `pathname` to the `UploadedMedia` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `UploadedMedia` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "UploadedMedia" ADD COLUMN     "durationSeconds" INTEGER,
ADD COLUMN     "originalFilename" TEXT,
ADD COLUMN     "pathname" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
