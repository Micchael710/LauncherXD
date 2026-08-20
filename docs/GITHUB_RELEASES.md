# GitHub Releases Integration

This document outlines how LauncherXD interacts with GitHub Releases to store and distribute binary files safely.

## Abstraction
We do NOT couple the application directly to GitHub. We use a provider abstraction: `ArtifactStorageProvider`.
This allows us to swap GitHub for an S3-compatible service (like Cloudflare R2) in the future without rewriting the core launcher code.

### Interfaces
- `StorageRelease`: Represents a release (version, tag, publish date).
- `StorageAsset`: Represents a binary file (name, size, url).

## Implementation
`GitHubReleaseProvider` implements this abstraction using `fetch` directed at the GitHub REST API (`https://api.github.com`).
All requests include standard headers (`Accept`, `User-Agent`, `X-GitHub-Api-Version`), and an optional `Authorization: Bearer <TOKEN>` to avoid rate limits or access private repositories.

## Configuration
- `GITHUB_OWNER`: The GitHub organization or user (e.g. `Micchael710`).
- `GITHUB_RELEASES_REPO`: The specific repository holding releases (e.g. `LauncherXD`).

### Secret Token
The token is NEVER checked into source code. It is provided directly to the Cloudflare Worker via Wrangler secrets:
```bash
npx wrangler secret put GITHUB_TOKEN
```
This is essential for security.

## Future Sync to D1
GitHub is strictly for *storage and distribution*. LauncherXD remains the source of truth for file integrity via `SHA-256`. 
The future Admin API will sync metadata from GitHub to D1 `release_files`, calculating and storing the `sha256` and `logical_path`.
The frontend will ONLY trust the D1 `manifest`, regardless of what exists in GitHub.

## API Limits y Diagnóstico
Para prevenir el consumo innecesario de la cuota de la API de GitHub, se cuenta con el endpoint de diagnóstico `/health/github`.
Este endpoint realiza una petición ligera (sin descargar assets ni releases) únicamente para confirmar conectividad.
**Nota de Diagnóstico:** `/health/github` está pensado exclusivamente para uso operacional o de diagnóstico en el Back Office. No debe ser consultado periódicamente por los clientes/launchers finales, ya que cada ejecución consume cuota de GitHub API. No implementar cache/rate-limit todavía en esta fase.

## Estrategia de Subida de Archivos Grandes (Uploads)
La subida de archivos gigantes (varios GB) no puede realizarse directamente usando el Worker como proxy (debido a limitaciones de memoria y timeout), pero **NUNCA** debe realizarse permitiendo que el navegador (Browser) utilice el token de administración de GitHub (`GITHUB_TOKEN`) directamente, ya que eso filtraría el token público.

La arquitectura futura deberá contemplar un flujo seguro (por ejemplo, firmas pre-generadas, subidas divididas o un servicio auxiliar). 
**Decisión técnica:** El diseño final de uploads grandes queda pendiente. No implementar en esta fase ni inventar todavía la solución definitiva.
