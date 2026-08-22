# LauncherXD

LauncherXD es un launcher de Minecraft en desarrollo que incluye un Back Office para gestionar versiones, modpacks, archivos, noticias, configuración y publicación de actualizaciones.

## Estado actual

La **Fase 7 — Back Office** está completada en la rama `feature/backoffice-orion-ui` y pendiente de integración en `main`.

Actualmente, el proyecto cuenta con:

- Gestión de releases y estados: `draft`, `published` y `deprecated`.
- Gestión separada de actualizaciones del launcher y modpacks.
- Operaciones de archivos: `add`, `replace` y `delete`.
- Cálculo automático de tamaño y SHA-256.
- División automática de archivos grandes en partes de **1 GiB**.
- Generación automática de metadatos multipart.
- Validación de archivos y releases antes de su publicación.
- Preparación y publicación mediante GitHub Releases.
- Subida de archivos físicos como `.jar`, `.zip` y otros assets binarios.
- Generación de `launcherxd-manifest.json`.
- Eliminación segura de modpacks publicados, incluyendo:
  - GitHub Release.
  - Git tag.
  - Assets asociados.
  - Metadatos almacenados en D1.
- Gestión de noticias con imágenes y enlaces directos a videos `.mp4` y `.webm`.
- Gestión de settings públicos y privados.
- Autenticación administrativa mediante `ADMIN_API_TOKEN`, con Cloudflare Access como alternativa.
- Almacenamiento local de credenciales protegido mediante Windows DPAPI (`CurrentUser`).
- Interfaz del Back Office inspirada en Orion Launcher.
- Workspace unificado para gestionar cada release desde una sola página.
- Tests automatizados para la API, el backend local y el frontend del Back Office.

Las secciones **Skins, Server, Console, Backups y Tasks** incluyen actualmente su estructura visual. Su integración funcional se realizará cuando estén disponibles los servicios externos y contratos necesarios.

El siguiente bloque principal de desarrollo es la **Fase 8**, enfocada en la integración del launcher frontend/desktop con los servicios preparados durante la Fase 7.

## Arquitectura actual

```text
Back Office React
        |
        v
Backend local Hono
  127.0.0.1:3000
        |
        +------> Cloudflare Worker
        |              |
        |              v
        |             D1
        |
        +------> GitHub Releases
                 (assets binarios)
```

## Seguridad

- Las credenciales administrativas no se guardan directamente en el código.
- El Worker utiliza secretos configurados en Cloudflare.
- El backend local protege las credenciales mediante Windows DPAPI.
- Las operaciones administrativas pasan por el backend local antes de llegar al Worker.
- Las operaciones destructivas requieren confirmaciones explícitas.
- La eliminación de modpacks verifica y reporta separadamente los resultados de GitHub y D1.

## Verificación de la Fase 7

- API: **99 tests aprobados**.
- Backend local: **104 tests aprobados**.
- Frontend del Back Office: **304 tests aprobados**.
- Migración de D1 para `video_url` aplicada.
- Worker desplegado y comprobado.
- Endpoints de salud de la API y D1 verificados.
- Publicación y eliminación manual de modpacks verificadas.
- Publicación de noticias con video verificada.
