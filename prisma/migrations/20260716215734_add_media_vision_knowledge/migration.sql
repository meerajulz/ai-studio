-- CreateTable
CREATE TABLE "MediaVisionKnowledge" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "metadata" JSONB NOT NULL,
    "score" JSONB NOT NULL,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "mediaId" TEXT NOT NULL,

    CONSTRAINT "MediaVisionKnowledge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaVisionKnowledge_mediaId_key" ON "MediaVisionKnowledge"("mediaId");

-- AddForeignKey
ALTER TABLE "MediaVisionKnowledge" ADD CONSTRAINT "MediaVisionKnowledge_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "UploadedMedia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
