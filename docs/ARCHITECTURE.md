# Architecture

The system is composed of several strictly isolated components.

## Repositories
*   **LauncherXD** (\Micchael710/LauncherXD\): Source code, Worker, D1 schema, and documentation.
*   **LauncherXD-Releases** (\Micchael710/LauncherXD-Releases\): Distribution repository. Exclusively stores GitHub Releases, manifests, and large binary assets (.jar, .zip).

## Administrative Back Office (Local)
**The Back Office is a local-only application** executing on the administrator's PC via \localhost\. It will NOT be deployed to Cloudflare Pages as a public web application.
It consists of two parts:
1.  **Local UI**: Runs in the browser at \localhost:<port>\. The browser **never** receives the GitHub PAT/token.
2.  **Local Backend**: A localhost server that securely stores the GitHub credentials (e.g. via Windows Credential Manager). **The Local Backend handles large GitHub binary uploads** directly to the GitHub API, avoiding Cloudflare Worker payload limits and memory constraints.

## Cloudflare Worker & D1
The Worker is the central authority for release metadata and publication lifecycle.
*   The Worker **does NOT proxy large binary uploads**.
*   The Worker generates and uploads the \launcherxd-manifest.json\ directly to GitHub.
*   **D1 remains the sole source of truth** for metadata, ensuring consistency.

## Launcher (Client)
The Launcher application will query the Cloudflare Worker/D1 to fetch metadata and the manifest, and then download the large binary assets directly from \LauncherXD-Releases\ via GitHub.
