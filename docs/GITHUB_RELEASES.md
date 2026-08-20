# GitHub Releases Integration

## Repositories
- Source code and Worker logic: \Micchael710/LauncherXD\
- Release distribution (Assets & Manifests): \Micchael710/LauncherXD-Releases\

## Upload Strategy
The Cloudflare Worker does **NOT** accept or proxy large binary files.
Large binaries (.jar, .zip, etc.) must be uploaded directly to GitHub via the **Local Back Office Backend**.
The Local Back Office UI running in the browser will send upload commands to the localhost backend, which will then use the GitHub Token to stream large files to GitHub API. The browser itself never receives the GitHub PAT/token.

The Worker is strictly responsible for orchestrating the release lifecycle (creating drafts, checking status, reconciling idempotency, and generating/uploading the \launcherxd-manifest.json\).

## Asset Hashing & Naming
Every uploaded asset gets a deterministic name based on the SHA-256 hash of its physical path.
Format: \lx-<64 hex of SHA-256(physical path)>-<safe-basename>\
This guarantees identical multipart pieces get distinct names while avoiding folder injection attacks.
