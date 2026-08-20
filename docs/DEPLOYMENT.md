# Deployment

## Cloudflare Worker
Deploy the API via \
px wrangler deploy\.
Requires D1 bindings and the \GITHUB_TOKEN\ secret.
\wrangler.jsonc\ must be configured to point \GITHUB_RELEASES_REPO\ to \LauncherXD-Releases\.

## Back Office
The Back Office is **NOT deployed** to any cloud host.
It is an exclusively local application. The UI runs on \localhost\, communicating with a local backend server that holds upload credentials securely.

## Launcher Client
Will be built and distributed separately, querying the Worker for updates and downloading assets directly from the GitHub Releases of \LauncherXD-Releases\.
