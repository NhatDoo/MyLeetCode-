-- DropIndex
DROP INDEX "Problem_tags_gin_idx";

-- DropIndex
DROP INDEX "Problem_topics_gin_idx";

-- AlterTable
ALTER TABLE "Problem" ADD COLUMN     "starterCode" JSONB;

-- CreateTable
CREATE TABLE "CommunitySolution" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,

    CONSTRAINT "CommunitySolution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunitySolution_problemId_createdAt_idx" ON "CommunitySolution"("problemId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunitySolution_userId_idx" ON "CommunitySolution"("userId");

-- AddForeignKey
ALTER TABLE "CommunitySolution" ADD CONSTRAINT "CommunitySolution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunitySolution" ADD CONSTRAINT "CommunitySolution_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
