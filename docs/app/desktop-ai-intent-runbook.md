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

In Tellann, sign in, select an entitled project, open **Intent**, and choose **Upload and generate**. Select PDF, DOCX, Markdown, text, HTML, or OpenAPI JSON/YAML. The page tracks derived-evidence processing and flow generation, then opens the review draft. Raw file bytes remain local. Accepting the review draft creates the immutable graph version.

## Automated acceptance

With the stack healthy, run:

```powershell
pnpm.cmd --filter @tellann/desktop-contracts build
pnpm.cmd verify:desktop:intent
```

The verifier checks redaction and prompt-injection isolation, document processing, asynchronous draft generation, review gating, explicit acceptance, immutable graph creation, reconciliation, and report provenance.
