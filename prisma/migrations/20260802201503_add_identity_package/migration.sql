-- CreateTable
CREATE TABLE "IdentityPackage" (
    "id" TEXT NOT NULL,
    "anchors" JSONB NOT NULL,
    "scorerId" TEXT NOT NULL,
    "imageCount" INTEGER NOT NULL DEFAULT 0,
    "analyzedCount" INTEGER NOT NULL DEFAULT 0,
    "version" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "identityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "IdentityPackage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IdentityPackage_identityId_key" ON "IdentityPackage"("identityId");

-- CreateIndex
CREATE INDEX "IdentityPackage_userId_idx" ON "IdentityPackage"("userId");

-- AddForeignKey
ALTER TABLE "IdentityPackage" ADD CONSTRAINT "IdentityPackage_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityPackage" ADD CONSTRAINT "IdentityPackage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
