# Release Management Lifecycle

Releases go through strict phases controlled by D1 and Cloudflare Workers.

## Local Back Office
Administration is performed via a **local-only** Back Office.
- UI runs on \localhost\.
- A Local Backend handles direct uploads of large files to GitHub API.
- The browser never receives GitHub secrets.

## Worker Responsibilities
The Worker acts as the single source of truth for metadata (D1) and manifest orchestration.
1. \prepare\: Creates draft in GitHub (\LauncherXD-Releases\) and assigns \github_tag\.
2. \status\: Reconciles actual GitHub uploaded assets against D1 expectations (matching physical path SHA-256 expected names, exact sizes, and strict lowercase 64-hex SHA-256 digests).
3. \publish\: Re-verifies status, syncs URLs, deterministically sorts files, builds and uploads \launcherxd-manifest.json\, and finally marks the GitHub Release as published (draft=false, make_latest=false).

D1 always dictates whether a release is truly published.
