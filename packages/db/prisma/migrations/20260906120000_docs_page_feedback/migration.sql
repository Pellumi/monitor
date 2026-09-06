CREATE TABLE "DocsPageFeedback" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "docsVersion" TEXT NOT NULL,
    "helpful" BOOLEAN NOT NULL,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocsPageFeedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocsPageFeedback_feedbackId_pageId_docsVersion_key"
ON "DocsPageFeedback"("feedbackId", "pageId", "docsVersion");

CREATE INDEX "DocsPageFeedback_pageId_docsVersion_createdAt_idx"
ON "DocsPageFeedback"("pageId", "docsVersion", "createdAt");

CREATE INDEX "DocsPageFeedback_ipHash_createdAt_idx"
ON "DocsPageFeedback"("ipHash", "createdAt");
