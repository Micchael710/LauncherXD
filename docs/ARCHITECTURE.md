# Arquitectura del Backend - LauncherXD

## Estado Actual (Fase 1)
La arquitectura está diseñada para separar claramente el backend (API) de los futuros frontends (Launcher desktop y Back Office web).
Actualmente se ha implementado el Worker de Cloudflare y la conexión a la base de datos D1.

## Detalles Técnicos
- **Ubicación del Worker**: `apps/api/` (Aislado del futuro frontend que irá en otras carpetas o en la raíz, dejando el Worker modular).
- **Nombre del Worker**: `launcherxd-api`
- **Nombre lógico del binding DB**: `DB` (apunta a la base de datos física `launcherxd-db`)

## Cómo Ejecutar Localmente
Para probar la API de manera local simulando el entorno de Cloudflare:
1. Abrir una terminal en `apps/api/`
2. Instalar dependencias si no se ha hecho: `npm install`
3. Iniciar el servidor de desarrollo: `npm run dev`

## Cómo Probar los Endpoints
El servidor local suele levantarse en `http://localhost:8787` (Wrangler lo indicará en la consola).

### Probar `/health`
Verifica que el Worker funciona correctamente.
```bash
curl http://localhost:8787/health
# Respuesta esperada: {"status":"ok","service":"launcherxd-api"}
```

### Probar `/health/db`
Verifica la conexión del Worker con la base de datos D1 mediante un query seguro (`SELECT 1 AS ok`).
```bash
curl http://localhost:8787/health/db
# Respuesta esperada: {"status":"ok","database":"connected"}
```

## Cómo Desplegar
Para desplegar el Worker a los servidores de producción de Cloudflare:
1. Asegúrate de estar autenticado: `npx wrangler login` (desde la raíz o en `apps/api/`)
2. Despliega la aplicación: `npm run deploy` (dentro de `apps/api/`)

## Qué NO se ha implementado todavía
Tal como dictan los objetivos de la Fase 1, las siguientes funcionalidades **NO** están implementadas y quedan para fases posteriores:
- Frontend del launcher (interfaz de usuario, pantallas de login, visuales).
- Aplicación web de Back Office o Dashboard.
- Autenticación o esquemas de usuarios.
- Endpoints definitivos (`/api/releases`, `/api/manifest`, `/api/news`, `/api/auth`, etc.).
- Migraciones y tablas reales de D1 (usuarios, cuentas, skins, releases).
- Sistema de Updater, Downloader o sincronización con GitHub Releases.
- Configuraciones estrictas de CORS (ahora se permite `*` temporalmente, se debe ajustar cuando existan los dominios definitivos).
