# LauncherXD

LauncherXD es un launcher de Minecraft en desarrollo con un Back Office para gestionar versiones, archivos, noticias, configuración y publicación de releases.

## Estado actual

La **Fase 7 — Back Office** está completada e integrada en `main`.

Actualmente el proyecto cuenta con:

- Gestión de releases y estados (`draft`, `published`, `deprecated`).
- Gestión de archivos de release con operaciones `add`, `replace` y `delete`.
- Soporte de metadatos multipart.
- Validación de tamaño y SHA-256.
- Preparación y publicación mediante GitHub Releases.
- Subida de archivos físicos como `.jar`, `.zip` y otros assets binarios.
- Generación de `launcherxd-manifest.json`.
- Gestión de noticias.
- Gestión de settings públicos y privados.
- Autenticación administrativa mediante `ADMIN_API_TOKEN` con Cloudflare Access como fallback.
- Almacenamiento local de credenciales protegido con Windows DPAPI (`CurrentUser`).
- Tests automatizados para API, backend local y frontend del Back Office.

El siguiente bloque de desarrollo es la **Fase 8**, enfocada en el launcher frontend/desktop.

## Arquitectura actual

```text
Back Office React
    |
    v
Backend local Hono
127.0.0.1:3000
    |
    +----> Cloudflare Worker
    |         |
    |         v
    |        D1
    |
    +----> GitHub Releases
           (assets binarios)
