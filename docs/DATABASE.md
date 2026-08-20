# Esquema de Base de Datos - LauncherXD

El proyecto usa Cloudflare D1 como motor principal de base de datos relacional. 
Esta base de datos es responsable únicamente de la metadata; los archivos binarios reales serán descargados desde GitHub Releases u otro proveedor.

## Migraciones y Seeds
Las migraciones se almacenan de manera versionada en `apps/api/migrations/*.sql`.
El historial de migraciones aplicadas remotamente se guarda automáticamente en la tabla interna `d1_migrations`. **Esta tabla pertenece al sistema de migraciones de Wrangler y NUNCA debe limpiarse manualmente.** Si se elimina, Wrangler perderá el rastro de qué migraciones se aplicaron a la base de datos remota.

Para datos de prueba (seeds) en desarrollo local, estos se almacenan de manera independiente en `apps/api/seeds/local.sql` y deben ejecutarse exclusivamente con comandos de ejecución directa local. Nunca deben incluirse en el directorio de `migrations/`.

## Tablas Actuales

### 1. `releases`
Almacena versiones (launcher, modpacks) del ecosistema.
- **`id`**: PK
- **`version`**: Versión del paquete (Ej: "1.0.0").
- **`channel`**: Canal (stable, beta).
- **`release_type`**: Tipo (launcher, modpack). Restringido.
- **`status`**: Estado (draft, published, deprecated). Restringido. Los drafts NUNCA se exponen.
- **Constraints y Relaciones**: Índice único en `(version, channel, release_type)` para evitar duplicados lógicos. Constraints CHECK aseguran tipos correctos y `total_size >= 0`.

### 2. `release_files`
Almacena la estructura de archivos que componen a una release.
- **`release_id`**: FK a `releases.id` (ON DELETE CASCADE) para prevenir huérfanos.
- **`path`**: Ruta física del archivo en el servidor/descarga.
- **`logical_path`**: El archivo lógico final que resultará tras la posible reconstrucción de partes (ej. `minecraft.zip`). Usado para agrupar multipartes.
- **`operation`**: Permite parches incrementales (`add`, `replace`, `delete`). Restringido a esos valores.
- **`sha256`**: Para validación criptográfica de integridad de la parte o archivo.
- **Partes (Divididos)**: Las columnas `part_index`, `part_count` y `final_sha256` permiten unir archivos pesados divididos. Tienen restricciones lógicas de que index y count deben existir juntos, y el index ser menor o igual al count.

### 3. `news`
Noticias del ecosistema que aparecerán en el launcher.
- **`published`**: Boolean que oculta/muestra una noticia.

### 4. `launcher_settings`
Configuraciones clave-valor públicas de la app.
- **`is_public`**: Define si debe exponerse mediante `/api/settings/public`. Prohibido almacenar aquí secretos como contraseñas, tokens y PATs.

## Índices
Se han configurado índices en columnas de frecuente filtrado u ordenamiento, incluyendo `channel`, `release_type`, `status` y `published_at` para optimizar las consultas en los endpoints públicos.

## Seguridad de Consultas
Todas las consultas y escrituras a D1 deben utilizar obligatoriamente SQL parametrizado (prepare().bind()). La concatenaci�n directa en consultas est� estrictamente prohibida para prevenir inyecciones SQL.
