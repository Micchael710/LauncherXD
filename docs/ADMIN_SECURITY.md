# Seguridad Administrativa (Admin Security)

## Arquitectura de Autenticación
La API del LauncherXD delega la autenticación administrativa estrictamente a **Cloudflare Access**. 
- Los clientes o navegadores web que quieran acceder a funciones de Back Office primero deben autenticarse mediante Cloudflare Access.
- Cloudflare emite un JWT firmado y lo inyecta en el header `Cf-Access-Jwt-Assertion`.
- El middleware `adminAuth` verifica criptográficamente este JWT utilizando el JWKS oficial del Team Domain de Cloudflare (`https://<team-domain>/cdn-cgi/access/certs`).

## Rutas Protegidas vs Públicas
- `/api/releases/*`, `/api/news`, `/api/settings/public` son **públicas** y no requieren JWT, puesto que el Launcher necesita acceso de solo lectura para el cliente final.
- `/api/admin/*` está **protegido** por el middleware. Cualquier petición sin un JWT válido, expirado, con firma incorrecta o de origen dudoso será rechazada con un código HTTP `401 Unauthorized`.

## Política Fail-Closed
Toda la infraestructura de seguridad opera bajo un modelo "fail-closed". Si ocurre un fallo de red al obtener el JWKS, o falta la configuración en el Worker (`CLOUDFLARE_ACCESS_TEAM_DOMAIN`, `CLOUDFLARE_ACCESS_AUD`), la API rechazará TODAS las peticiones administrativas por defecto. Nunca se confiará en la ausencia de errores para otorgar acceso.

## CORS vs Autenticación
**CORS no es un mecanismo de seguridad.** Que las rutas públicas acepten `*` para CORS no afecta a las rutas administrativas, ya que estas validan una identidad real. En el futuro, el Back Office estará alojado bajo un dominio protegido y CORS se restringirá estrictamente a dicho dominio.

## Variables de Configuración
Para desplegar la protección, deben configurarse las siguientes `vars` en `wrangler.jsonc` (no son secretos y pueden versionarse):
- `CLOUDFLARE_ACCESS_TEAM_DOMAIN`: El dominio interno del tenant de Cloudflare Zero Trust (ej. `midominio.cloudflareaccess.com`).
- `CLOUDFLARE_ACCESS_AUD`: El tag de la aplicación (Audience) de Cloudflare Access.

## Permisos Futuros
Actualmente el middleware solo comprueba autenticación general (`adminIdentity`). En fases futuras, los claims del JWT (como el `email` o grupos) se podrán mapear contra permisos granulares (ej: `release:write`, `news:write`).

