# Subdomain Deployment Guide

This repo now separates the public marketing site, authenticated product app, and documentation site into independent workspace apps.

## Surfaces

| Production host | Workspace app | Local dev | Purpose |
| --- | --- | --- | --- |
| `domain-name.com` | `apps/marketing` | `http://localhost:3020` | Public SEO and conversion site |
| `app.domain-name.com` | `apps/dashboard` | `http://localhost:3010` | Authenticated SOTS product |
| `docs.domain-name.com` | `apps/docs` | `http://localhost:3021` | Public user documentation |

The dashboard remains rooted at `/` because it is deployed to the app subdomain. Do not move dashboard routes under `/app` unless the product is later collapsed back onto a single domain.

## Local Commands

```bash
pnpm dev:marketing
pnpm dev:app
pnpm dev:docs
```

Full workspace verification:

```bash
pnpm build
pnpm test
```

Filtered production builds:

```bash
pnpm build:marketing
pnpm build:app
pnpm build:docs
```

## Environment Variables

Marketing:

```env
NEXT_PUBLIC_SITE_URL=https://domain-name.com
NEXT_PUBLIC_APP_URL=https://app.domain-name.com
NEXT_PUBLIC_DOCS_URL=https://docs.domain-name.com
```

Docs:

```env
NEXT_PUBLIC_SITE_URL=https://docs.domain-name.com
NEXT_PUBLIC_APP_URL=https://app.domain-name.com
NEXT_PUBLIC_MARKETING_URL=https://domain-name.com
```

Dashboard:

```env
NEXT_PUBLIC_APP_URL=https://app.domain-name.com
NEXT_PUBLIC_DOCS_URL=https://docs.domain-name.com
NEXT_PUBLIC_MARKETING_URL=https://domain-name.com
NEXT_PUBLIC_API_GATEWAY_URL=https://api.domain-name.com
```

Auth service:

```env
AUTH_COOKIE_DOMAIN=app.domain-name.com
APP_ORIGIN=https://app.domain-name.com
MARKETING_ORIGIN=https://domain-name.com
DOCS_ORIGIN=https://docs.domain-name.com
CORS_ALLOWED_ORIGINS=https://app.domain-name.com
```

Leave `AUTH_COOKIE_DOMAIN` empty for localhost development.

## Vercel Project Mapping

Create one Vercel project per app:

| Vercel project | Root directory | Domain |
| --- | --- | --- |
| `sots-marketing` | `apps/marketing` | `domain-name.com` |
| `sots-dashboard` | `apps/dashboard` | `app.domain-name.com` |
| `sots-docs` | `apps/docs` | `docs.domain-name.com` |

Each project can use:

```bash
pnpm install --frozen-lockfile
pnpm build
```

If the deployment platform supports filtered builds, use:

```bash
pnpm --filter @sots/marketing build
pnpm --filter dashboard build
pnpm --filter @sots/docs build
```

## DNS

Configure DNS after creating deployment targets:

```txt
domain-name.com       -> marketing deployment
www.domain-name.com   -> redirect to domain-name.com
app.domain-name.com   -> dashboard deployment
docs.domain-name.com  -> docs deployment
```

If the API gateway is exposed publicly:

```txt
api.domain-name.com   -> API gateway deployment
```

## Acceptance Checks

Marketing:

- `domain-name.com` renders the public homepage.
- `/pricing`, `/security`, `/privacy`, `/terms`, `/contact`, `/robots.txt`, and `/sitemap.xml` render.
- CTAs link to `app.domain-name.com` and `docs.domain-name.com`.

Dashboard:

- `app.domain-name.com/` redirects logged-out users to `/auth/login`.
- Auth cookies are scoped to `app.domain-name.com` in production.
- Sidebar links to docs and marketing resolve correctly.
- `/api-gateway/*` points to the configured API gateway.

Docs:

- `docs.domain-name.com` renders the docs homepage.
- Role guides, SDK pages, API reference, billing, entitlements, security, and troubleshooting pages render.
- `/robots.txt` and `/sitemap.xml` render.

