# Desktop AI-assisted flow declaration

## Start the local workflow on Windows

```powershell
docker compose up -d postgres redis
pnpm.cmd --filter @tellann/db exec prisma migrate deploy
pnpm.cmd --filter @tellann/db build
pnpm.cmd --filter @tellann/db exec tsx src/seed-plans.ts
pnpm.cmd dev:desktop-intent
```

The launcher refuses to start when PostgreSQL or Redis is unavailable. It starts and health-checks auth-api, onboarding-api, FDRS, the API gateway, background workers, and the Electron desktop app. Logs are written under `artifacts/desktop-intent-stack`.

In Tellann, sign in, select an entitled project, open **Intent**, and choose **Upload and generate**. Select PDF, DOCX, Markdown, text, HTML, or OpenAPI JSON/YAML. Raw file bytes remain local. Accepting the review draft creates the immutable graph version.

Extraction, upload, evidence processing and draft generation run in the desktop main process (`apps/desktop/src/main/document-import-manager.ts`), not in the page. You can leave Intent or Sources while an import runs; progress reappears when you return, and an import interrupted by closing the desktop resumes on the next start. Files that had not finished uploading when the desktop closed must be added again.

After pulling these changes, apply the `SUPERSEDED` draft status migration with `pnpm.cmd --filter @tellann/db exec prisma migrate deploy`.

Drafts that could not use an AI provider say so on the review page: with document evidence they are assembled from the document text, otherwise they fall back to a generic domain template. Conflicting statements between documents must be answered and applied (which regenerates the draft) before a draft can be accepted.

## Automated acceptance

With the stack healthy, run:

```powershell
pnpm.cmd --filter @tellann/desktop-contracts build
pnpm.cmd verify:desktop:intent
```

The verifier checks redaction and prompt-injection isolation, document processing, asynchronous draft generation, review gating, explicit acceptance, immutable graph creation, reconciliation, and report provenance.
