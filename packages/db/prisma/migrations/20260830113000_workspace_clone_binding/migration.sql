ALTER TABLE "ProjectWorkspace"
ADD COLUMN "repositoryCloneUrl" TEXT;

CREATE INDEX "ProjectWorkspace_applicationId_repositoryOriginHash_idx"
ON "ProjectWorkspace"("applicationId", "repositoryOriginHash");
