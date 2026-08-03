-- CreateTable
CREATE TABLE "MediaEmbedding" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "vector" JSONB NOT NULL,
    "dim" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "MediaEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaEmbedding_userId_idx" ON "MediaEmbedding"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaEmbedding_mediaId_kind_version_key" ON "MediaEmbedding"("mediaId", "kind", "version");

-- AddForeignKey
ALTER TABLE "MediaEmbedding" ADD CONSTRAINT "MediaEmbedding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
