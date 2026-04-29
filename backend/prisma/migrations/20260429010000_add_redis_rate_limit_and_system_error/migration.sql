ALTER TYPE "SubmissionStatus" ADD VALUE IF NOT EXISTS 'SYSTEM_ERROR';

ALTER TABLE "ExecutionLog"
ALTER COLUMN "memory" DROP NOT NULL;

ALTER TABLE "Problem"
ADD CONSTRAINT "Problem_difficulty_check"
CHECK ("difficulty" IN ('EASY', 'MEDIUM', 'HARD')) NOT VALID;
