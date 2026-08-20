# LauncherXD Admin API

La API Administrativa está diseñada para ser consumida exclusivamente por el futuro Back Office y está protegida de manera estricta por Cloudflare Access.

## 1. Seguridad General
- **Cloudflare Access Obligatorio**: Todas las peticiones a `/api/admin/*` deben incluir el header `Cf-Access-Jwt-Assertion` con un token JWT válido emitido por Cloudflare. Si no hay token, es inválido o falla la conexión al JWKS, se devuelve `401 Unauthorized`.
- **SQL Parametrizado**: Todas las interacciones con Cloudflare D1 se realizan utilizando consultas preparadas (`.prepare().bind()`). Está estrictamente prohibido el uso de concatenación de strings para construir queries.

## 2. Convenciones de Respuestas de Error
La API utiliza códigos de estado estándar para reflejar el resultado de la operación:
- `400 Bad Request`: Errores de validación de entrada (rutas inseguras, `sha256` no hexadecimal, `total_size` negativo, claves de settings prohibidas, `version` que no es SemVer válido).
- `401 Unauthorized`: Fallo en la autenticación JWT (falta de token o token inválido).
- `404 Not Found`: Recurso no encontrado, o intento de modificar un recurso que no pertenece al padre (`id` vs `release_id`).
- `409 Conflict`: Intentos de crear registros duplicados (versión y canal ya existentes, rutas de archivo duplicadas, índices de partes repetidos) o intentar modificar un recurso cuyo ciclo de vida no lo permite (ej: parchear un release publicado).

## 3. Endpoints de Releases

### `GET /api/admin/releases`
Obtiene la lista de releases administrativos (incluye drafts).

### `GET /api/admin/releases/:id`
Obtiene el detalle completo de un release administrativo.

### `POST /api/admin/releases`
Crea un nuevo release.
- Restricciones: El campo `version` debe ser un SemVer válido. El `channel` debe ser `stable` o `beta`. El `release_type` debe ser `launcher` o `modpack`.
- Ciclo de Vida: El release nace obligatoriamente en estado `draft`.

### `PATCH /api/admin/releases/:id`
Actualiza metadatos de un release.
- **Sólo Draft Modificable**: Si el status del release es `published` o `deprecated`, esta operación devolverá `409 Conflict`.
- **Publish**: Mover el estado a `published` está reservado temporalmente (se implementará en la Fase 6).

### `DELETE /api/admin/releases/:id`
Elimina un release y todos sus archivos asociados.
- Sólo permitido si el release está en estado `draft`.

## 4. Endpoints de Archivos (Release Files)

### `GET /api/admin/releases/:releaseId/files`
Obtiene los archivos del release.

### `POST /api/admin/releases/:releaseId/files`
Añade un archivo lógico a un release (que debe estar en estado `draft`).
- **Filename derivado server-side**: El campo `filename` nunca se lee desde el cliente. El backend lo extrae de manera segura desde el último segmento del `path` final.
- **Validación Path**: Se rechazan rutas absolutas, traversals (`../`), y backslashes para `path` y `logical_path`.
- **Validación SHA-256**: Los hashes deben tener 64 caracteres exactos en formato hexadecimal válido (excepto para `operation: delete`, que no requiere hash).
- **Multipart (Archivos divididos)**: Es posible enviar archivos fraccionados indicando `part_index`, `part_count` y `final_sha256`.
- **NO uploads todavía**: Este endpoint solo registra la metadata del archivo en la base de datos D1, no procesa ni almacena blobs reales todavía.

### `PATCH /api/admin/releases/:releaseId/files/:fileId`
Actualiza metadatos individuales del archivo. Sólo permitido en `draft`. Requiere coincidencia estricta de `id` y `release_id`.

### `DELETE /api/admin/releases/:releaseId/files/:fileId`
Elimina el archivo lógicamente de la base de datos D1. Sólo permitido en `draft`.

### `GET /api/admin/releases/:id/validation`
*Ready-to-publish validation*: Evalúa si un release en draft cumple con todos los requisitos estructurales para poder ser publicado.
Valida consistencia multipart (ej. que las partes 1..N estén presentes sin huecos) y obligatoriedad de campos.

## 5. Endpoints de Noticias (News)

### `GET /api/admin/news`
Lista todas las noticias, incluyendo las marcadas como `published: false` (drafts).

### `POST /api/admin/news`
Crea una noticia. Las URLs (`target_url`, `image_url`) son validadas severamente para permitir solo protocolos web y denegar intentos maliciosos como `javascript:`, `data:` o `file:`.

### `PATCH /api/admin/news/:id`
Actualiza la noticia. Se puede utilizar para pasar una noticia de draft a `published: true`.

### `DELETE /api/admin/news/:id`
Elimina una noticia permanentemente.

## 6. Endpoints de Configuración (Settings)

### `GET /api/admin/settings`
Obtiene toda la configuración global, sea pública o privada.

### `PUT /api/admin/settings/:key`
Crea o actualiza el valor de una clave de configuración.
- **Protección de settings sensibles**: La API rechaza obligatoriamente operaciones sobre claves que contengan o sugieran el almacenamiento de secretos (ej: `github_token`, `password`, `secret`, `jwt`, `api_key`, `credential`, etc). Los secretos reales de infraestructura viven en las `vars` o `secrets` del Worker, NUNCA en la base de datos de metadata pública.
