-- CreateEnum
CREATE TYPE "TrainedModelStatus" AS ENUM ('DRAFT', 'READY', 'FAILED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "IdentityDataset" (
    "id" TEXT NOT NULL,
    "readinessScore" INTEGER NOT NULL DEFAULT 0,
    "rating" TEXT NOT NULL DEFAULT 'poor',
    "imageCount" INTEGER NOT NULL DEFAULT 0,
    "analyzedCount" INTEGER NOT NULL DEFAULT 0,
    "metrics" JSONB NOT NULL,
    "version" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "datasetVersion" INTEGER NOT NULL DEFAULT 1,
    "recommendedImageIds" TEXT[],
    "rejectedImageIds" TEXT[],
    "rejectionReasons" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "identityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "IdentityDataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityTrainedModel" (
    "id" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "status" "TrainedModelStatus" NOT NULL DEFAULT 'DRAFT',
    "triggerWord" TEXT,
    "artifactRef" TEXT,
    "modelCompatibility" TEXT[],
    "cost" DOUBLE PRECISION,
    "durationSeconds" INTEGER,
    "params" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "identityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "IdentityTrainedModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityTrainingJob" (
    "id" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "providerJobId" TEXT,
    "datasetVersion" INTEGER NOT NULL,
    "triggerWord" TEXT,
    "params" JSONB,
    "cost" DOUBLE PRECISION,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "identityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trainedModelId" TEXT,

    CONSTRAINT "IdentityTrainingJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityEvaluation" (
    "id" TEXT NOT NULL,
    "face" DOUBLE PRECISION,
    "tattoos" DOUBLE PRECISION,
    "hair" DOUBLE PRECISION,
    "accessories" DOUBLE PRECISION,
    "pose" DOUBLE PRECISION,
    "expression" DOUBLE PRECISION,
    "lighting" DOUBLE PRECISION,
    "composition" DOUBLE PRECISION,
    "overallIdentityScore" DOUBLE PRECISION,
    "method" TEXT NOT NULL DEFAULT 'not-configured',
    "metrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "identityId" TEXT NOT NULL,
    "generationId" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "IdentityEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityArtifact" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "engine" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "ref" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "identityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "IdentityArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IdentityDataset_identityId_key" ON "IdentityDataset"("identityId");

-- CreateIndex
CREATE INDEX "IdentityDataset_userId_idx" ON "IdentityDataset"("userId");

-- CreateIndex
CREATE INDEX "IdentityTrainedModel_identityId_idx" ON "IdentityTrainedModel"("identityId");

-- CreateIndex
CREATE INDEX "IdentityTrainedModel_userId_idx" ON "IdentityTrainedModel"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityTrainedModel_identityId_engine_version_key" ON "IdentityTrainedModel"("identityId", "engine", "version");

-- CreateIndex
CREATE INDEX "IdentityTrainingJob_identityId_idx" ON "IdentityTrainingJob"("identityId");

-- CreateIndex
CREATE INDEX "IdentityTrainingJob_userId_idx" ON "IdentityTrainingJob"("userId");

-- CreateIndex
CREATE INDEX "IdentityTrainingJob_status_idx" ON "IdentityTrainingJob"("status");

-- CreateIndex
CREATE INDEX "IdentityEvaluation_identityId_idx" ON "IdentityEvaluation"("identityId");

-- CreateIndex
CREATE INDEX "IdentityEvaluation_generationId_idx" ON "IdentityEvaluation"("generationId");

-- CreateIndex
CREATE INDEX "IdentityEvaluation_userId_idx" ON "IdentityEvaluation"("userId");

-- CreateIndex
CREATE INDEX "IdentityArtifact_identityId_idx" ON "IdentityArtifact"("identityId");

-- CreateIndex
CREATE INDEX "IdentityArtifact_userId_idx" ON "IdentityArtifact"("userId");

-- AddForeignKey
ALTER TABLE "IdentityDataset" ADD CONSTRAINT "IdentityDataset_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDataset" ADD CONSTRAINT "IdentityDataset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityTrainedModel" ADD CONSTRAINT "IdentityTrainedModel_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityTrainedModel" ADD CONSTRAINT "IdentityTrainedModel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityTrainingJob" ADD CONSTRAINT "IdentityTrainingJob_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityTrainingJob" ADD CONSTRAINT "IdentityTrainingJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityTrainingJob" ADD CONSTRAINT "IdentityTrainingJob_trainedModelId_fkey" FOREIGN KEY ("trainedModelId") REFERENCES "IdentityTrainedModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityEvaluation" ADD CONSTRAINT "IdentityEvaluation_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityEvaluation" ADD CONSTRAINT "IdentityEvaluation_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "Generation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityEvaluation" ADD CONSTRAINT "IdentityEvaluation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityArtifact" ADD CONSTRAINT "IdentityArtifact_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityArtifact" ADD CONSTRAINT "IdentityArtifact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
