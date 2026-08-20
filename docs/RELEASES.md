# Modelo de Releases - LauncherXD

## Conceptos Core
Una **Release** es una versión puntual de un componente del ecosistema de LauncherXD (un `launcher` o un `modpack`), en un canal específico (`stable` o `beta`).

Las releases operan en dos fases:
1. **Draft**: Etapa de pruebas/preparación. No es visible públicamente en la API.
2. **Published**: Visible, verificable y con archivos adjuntos validados.

## Archivos y Manifiestos
Cada release contiene una lista de archivos y su comportamiento (`add`, `replace`, `delete`). Esto permite que el cliente calcule la diferencia estructural requerida al momento de actualizar y descargue sólo lo necesario.

Para la integridad técnica:
- Todos los archivos cuentan con un **`sha256`** y **`size`**.
- La base de datos D1 no almacena **ningún binario**. Guarda las reglas y las descargas se refieren a URLs alojadas en la infraestructura externa definida por el `ArtifactStorageProvider` (actualmente GitHub Releases).

## Archivos Divididos (Multipart)
Dada la limitación posible de subida en algunas plataformas, el modelo permite definir fragmentos para archivos masivos.
- Cada archivo dividido tiene un **`logical_path`** que identifica el archivo final en el que se reconstruirá (por ejemplo, `minecraft.zip`), lo que permite agrupar las partes de manera inequívoca.
- Cada sub-archivo registra su `part_index` y `part_count`.
- Contiene un `final_sha256` con el hash del archivo lógico original reconstituido, y el `sha256` individual del fragmento.
- El cliente será responsable de agrupar por `logical_path`, ordenar por `part_index`, verificar los hashes individuales y unir los binarios post-descarga, verificando al final el `final_sha256`.

## Responsabilidades
- **D1 Database**: Responsable única del MANIFEST lógico. Qué actualizar, en qué orden y cómo validar el producto final.
- **GitHub Releases**: Almacenamiento seguro, inmutable e ilimitado de blobs y binarios (`.jar`, `.exe`, archivos divididos).
