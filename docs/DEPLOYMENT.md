# Deployment Guide

This document describes how to deploy the LauncherXD API to Cloudflare Workers.

## Prerequisites
- Wrangler CLI (`npm install -g wrangler` or `npx wrangler`)
- Cloudflare account with a D1 database instantiated.

## Configuration
The `wrangler.jsonc` file configures the Worker.
- `name`: `launcherxd-api`
- `d1_databases`: The binding `DB` connected to the actual remote D1 ID.
- `vars`: Contains non-secret config like `GITHUB_OWNER` and `GITHUB_RELEASES_REPO`.

### Secrets
Certain variables must NOT be placed in `wrangler.jsonc` because they are highly sensitive.
To configure `GITHUB_TOKEN`, run:
```bash
npx wrangler secret put GITHUB_TOKEN
```
Provide the secret in the secure prompt. It will be encrypted by Cloudflare.

## Deployment Steps
1. Navigate to the API folder: `cd apps/api`
2. Run deployment: `npx wrangler deploy`
3. Verify remote database migrations (if required): `npx wrangler d1 migrations apply launcherxd-db --remote`

## Local Development
For testing locally:
```bash
npm run dev
```
To run local D1 migrations and seeds:
```bash
npx wrangler d1 execute launcherxd-db --local --file migrations/0001_initial_schema.sql
npx wrangler d1 execute launcherxd-db --local --file seeds/local.sql
```
**Warning**: Never run `seeds/local.sql` remotely.
