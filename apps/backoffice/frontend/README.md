# LauncherXD Back Office Frontend

Web application for administrative management of LauncherXD.

## Overview

The Back Office frontend provides an interface for managing releases, files, news announcements, and system settings. It connects to the local backend proxy, which handles authentication and forwards authorized requests to the Cloudflare Worker API.

## Modules Available

- **Dashboard**: Read-only overview of platform metrics (Releases, News, and Settings counts).
- **Releases**: Manage release metadata, lifecycle states (draft, published, deprecated), and create new versions.
- **Release Files**: Manage release file assets, multipart package associations, readiness diagnostics, and local SHA-256 inspection.
- **News**: Create, edit, and publish news articles and announcements.
- **Settings**: View and configure global application parameters and toggle public/private visibility.

## Prerequisites

The local backend proxy service must be running at `http://127.0.0.1:3000`.

> **Security Note**: Administrative credentials and tokens remain exclusively in the local backend proxy service. The frontend does not store, request, or handle credentials or secret tokens.

## Development & Scripts

- `npm run dev`: Start the local development server (defaults to `http://localhost:5173`).
- `npm run lint`: Run ESLint checks across frontend code.
- `npm run typecheck`: Run TypeScript type validation (`tsc --noEmit`).
- `npm run build`: Build production assets (`tsc -b && vite build`).
- `npm test`: Run automated test suites with Vitest.
