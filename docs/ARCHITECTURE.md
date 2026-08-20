# Arquitectura del Backend - LauncherXD

## Estado Actual (Fase 2)
La arquitectura está diseñada para separar claramente el backend (API) de los futuros frontends (Launcher desktop y Back Office web).
En la Fase 2, se integró el esquema base en D1 utilizando migraciones estructuradas para soportar lanzamientos (releases), archivos, noticias y configuración pública. El proyecto está dividido lógicamente en Rutas, Servicios y Repositorios.

## Detalles Técnicos
- **Ubicación del Worker**: `apps/api/` (Aislado del futuro frontend).
- **Nombre del Worker**: `launcherxd-api`
- **Binding DB**: `DB` (apunta a la base de datos `launcherxd-db`)
- **Migraciones**: Los cambios en D1 se aplican a través de `apps/api/migrations/*.sql`
- **Arquitectura Interna**: `Hono` Routes -> Services -> Repositories -> D1 Database

## Cómo Ejecutar Localmente
1. Abrir una terminal en `apps/api/`
2. Instalar dependencias: `npm install`
3. Opcional: Cargar datos de prueba locales (seeds) ejecutando `npx wrangler d1 execute launcherxd-db --local --file apps/api/seeds/local.sql`. NUNCA se debe usar `--remote` con scripts de seeds.
4. Iniciar el servidor de desarrollo: `npm run dev`

## Estructura Modular
El código fuente dentro de `apps/api/src/` está dividido en:
- `routes/`: Define endpoints de HTTP y extrae variables/parámetros.
- `services/`: Contiene la lógica de negocio, mapeos y validaciones.
- `repositories/`: Interactúa de forma directa y única con D1 usando consultas seguras (prepared statements).
- `types/`: Define interfaces tipadas.

## Qué NO se ha implementado todavía (Fase 2)
- Frontend, interfaces visuales ni pantallas de login.
- Endpoints administrativos (creación, subida y publicación).
- Autenticación o roles de usuarios.
- GitHub Releases y Downloader funcional.
- Subida de archivos (sólo está preparado el modelo de base de datos para almacenar el manifiesto de dichos archivos).

## Regla de Referencia: Orion Launcher
Existe un launcher anterior (`Orion-Launcher-electron-main`) que funcionó correctamente. Para futuras implementaciones (como downloader, updater, validación de hashes, progreso, instalación, etc.), se debe seguir esta regla:
1. **Inspeccionar Orion primero**: Analizar cómo resolvieron el problema.
2. **Reutilizar o Adaptar**: Si la implementación sigue buenas prácticas, es segura, eficiente, está bien estructurada y sigue siendo apropiada, se debe reutilizar o adaptar.
3. **Mejorar**: Si la implementación antigua es defectuosa, se debe crear una nueva y mejor solución. NO copiar automáticamente código sólo porque funcionó.
4. **Prohibido importar**: Secretos, tokens, credenciales o configuraciones de Firebase innecesarias.
