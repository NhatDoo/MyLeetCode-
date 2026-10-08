CREATE TABLE "ProblemDiscussion" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,

    CONSTRAINT "ProblemDiscussion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProblemDiscussion_problemId_createdAt_idx" ON "ProblemDiscussion"("problemId", "createdAt");
CREATE INDEX "ProblemDiscussion_userId_idx" ON "ProblemDiscussion"("userId");

ALTER TABLE "ProblemDiscussion"
    ADD CONSTRAINT "ProblemDiscussion_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProblemDiscussion"
    ADD CONSTRAINT "ProblemDiscussion_problemId_fkey"
    FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;