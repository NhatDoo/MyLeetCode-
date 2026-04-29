ALTER TABLE "Problem"
ADD COLUMN "image" TEXT,
ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "topics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "TestCase"
ADD COLUMN "image" TEXT;

CREATE INDEX "Problem_tags_gin_idx" ON "Problem" USING GIN ("tags");

CREATE INDEX "Problem_topics_gin_idx" ON "Problem" USING GIN ("topics");
