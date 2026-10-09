# Jara Studio — utilidades locales

Las cuatro mesas de Utilidades permanecen abiertas al cambiar entre pestañas o volver a la escena. Sus archivos no se incorporan al proyecto 3D `.jara`: exporta cada mesa antes de cerrar el programa. Si una mesa contiene archivos locales, capas o un mapa importado, el cierre nativo pide confirmar el descarte o cancelar. La advertencia se mantiene mientras la mesa contenga datos, incluso después de exportar, para proteger ediciones posteriores. No se suben archivos ni se necesita una cuenta.

## Handling Studio

1. Abre uno o varios `handling.meta` / XML UTF-8 con raíz `CHandlingDataMgr`.
2. Selecciona el coche en la columna Vehículos. El inspector muestra solo campos numéricos existentes en su base.
3. Modifica valores y pulsa **Aplicar cambios**. Masa, fuerza de motor, frenada, tracción y suspensión tienen límites; marchas exige un entero.
4. Marca varias filas para aplicar Calle, Deportivo, Drift u Off-road a todos los coches marcados. Un perfil solo modifica campos existentes y es un punto de partida, no una simulación física.
5. **XML del archivo activo** conserva todos los coches de ese archivo. **ZIP de todos los archivos** incluye todas las bases, `fxmanifest.lua` y una declaración `HANDLING_FILE` por archivo.

Los cambios sustituyen únicamente el contenido de los atributos `value` indicados. Se conservan campos desconocidos, flags, vectores, comentarios, entradas de otros coches y `SubHandlingData`. Restaurar archivo devuelve el archivo completo a su estado importado. No exportes dos bases con el mismo `handlingName`.

La base de práctica enseña el flujo y no incluye un modelo de vehículo. El handling debe estar vinculado desde un `vehicles.meta` compatible. La velocidad nominal no equivale a una medición exacta en km/h: prueba aceleración, frenada y agarre dentro de tu servidor FiveM.

## Texture Lab

- Importación: imágenes, DDS 2D y YTD Legacy `RSC7` versión 13. Límite: 128 MB por archivo; una importación, 64 archivos y 256 MB. Mesa: 2048 texturas y un presupuesto de 384 MB para píxeles y datos codificados.
- Selecciona una textura para ver RGB, R, G, B o alfa. Los botones Mip decodifican los niveles existentes en el archivo; no crean una imagen reducida falsa. Una imagen PNG/JPG no tiene mipmaps nativos hasta recodificarla.
- Marca las texturas a procesar, elige BC1, BC3 o RGBA8, lado máximo y mipmaps; pulsa **Recodificar**. BC1 tiene transparencia de un bit; BC3 mantiene alfa gradual; RGBA8 ocupa más memoria.
- **Ajustar lados para YTD** es explícito: adapta dimensiones a potencias de dos para un diccionario Legacy con mipmaps. Sin activar esta opción no se cambia la proporción por obligación de YTD.
- **DDS + XML seleccionados** genera un ZIP para las filas marcadas. **PNG de textura activa** exporta la textura activa a su resolución, sin pintar los canales de inspección sobre el resultado.
- **YTD completo de la mesa** incluye también entradas no marcadas. Conserva exactamente sus datos DDS codificados y metadatos; los punteros internos se relocalizan al reconstruir el diccionario. Los nombres/hash deben ser únicos.

BC7 se conserva sin recodificación ni vista previa. No se abren archivos escrow `FXAP`, Enhanced/Gen9 `RSC8`, cubemaps ni texturas volumétricas. El procesamiento se ejecuta en un worker; conserva siempre tus archivos originales y valida el YTD en FiveM.

Motor MIT: <https://github.com/JaramiyoSM/jara-texture-engine>.

## Map Studio

El mapa incluido es una cartografía original de Jara: carreteras dibujadas a partir de coordenadas factuales. No es una textura extraída de GTA. Sus bounds de referencia son X −5000…7000 e Y −4000…8000; las coordenadas de edición se normalizan a 0…1000.

1. Selecciona **Dibujar zona**. Haz clic para añadir vértices; Enter, doble clic o el primer vértice cierran el polígono. Esc cancela el trazado.
2. En Seleccionar, arrastra el interior de una zona para moverla o sus puntos para editar vértices. Abre Vértices precisos para escribir X/Y o borrar un punto; cada polígono requiere tres puntos.
3. Selecciona **Postal / etiqueta** y pulsa sobre el mapa. Escribe un código único de 1–16 letras, números, guiones o guiones bajos. Desactiva Postal GPS para convertirlo en una etiqueta visual.
4. Usa color, opacidad, bloqueo, duplicado y orden de capas. Deshacer/repetir conserva hasta 50 estados. Rueda amplía sobre el cursor; botón central o Mover vista desplazan la vista.
5. Exporta PNG, zonas JSON, postales XY o el ZIP `/jaragps`. El PNG siempre usa el mapa completo y excluye zoom, selección y cuadrícula.

El recurso `jara_postals` incluye `postals.json`, `client.lua` y `fxmanifest.lua`. Añade `ensure jara_postals` y prueba `/jaragps 3030`; solo coloca un waypoint local. Comprueba cada postal en el juego. Este ZIP no reemplaza los tiles del radar: prepara las texturas nativas aparte.

Puedes abrir un mapa PNG/JPG/WebP propio, cuadrado y de hasta 16 MP. Al no conocer sus bounds, se desactiva la exportación GPS. Importar capas JSON nunca activa coordenadas no verificadas para un fondo propio.

## Resource Pack

Añade recursos Legacy ya compilados: YDR, YDD, YFT, YTD, YTYP, YMAP, YBN, YCD, YMT y metadatos reconocidos. Se comprueba la cabecera RSC7, versión 13 para YTD, sintaxis/raíz XML y colisiones de nombres. Máximo: 512 archivos, 128 MB por archivo y 512 MB de paquete.

Los nativos se sitúan en `stream/`; metadatos en `data/`. El manifest declara solo los `data_file` de metadatos presentes y `DLC_ITYP_REQUEST` para YTYP. Para `vehicles.meta`, el informe avisa de modelos o diccionarios no incluidos; pueden ser dependencias del juego base, que debes revisar. No se compila ni se ejecuta código.

El ZIP conserva los bytes originales, incorpora `validation.json` y explica la instalación. Revisa dependencias y derechos de los archivos antes de empaquetar. Una cabecera correcta no garantiza que la malla, el rig o las referencias funcionen en el juego: valida siempre en FiveM. GLB, OBJ o FBX deben convertirse mediante Blender/Sollumz u otro compilador compatible antes de este paso.

---

# Jara Studio — local utilities

Utility workspaces retain their state while switching tabs or returning to the scene. They are independent from the `.jara` 3D project. Export each workspace before closing. Native close asks you to discard or cancel when a utility contains local data. This conservative warning remains while a workspace is nonempty, including after exports. No account or upload is required.

**Handling:** import UTF-8 `CHandlingDataMgr` bases, select a car, edit existing numeric fields and apply changes. Presets apply to checked cars and preserve unknown fields, flags, vectors and subhandling. Active XML exports every entry in its source file; resource ZIP includes all files and matching `HANDLING_FILE` declarations. Avoid duplicate handling names and test each preset in FiveM.

**Textures:** inspect real RGB/alpha channels and encoded mip levels. Re-encode checked entries in a local worker to BC1, BC3 or RGBA8. Whole-workspace YTD export includes unselected entries and preserves their encoded bytes and metadata, relocating internal pointers. Power-of-two fitting is explicit. BC7 is preserve-only; Legacy RSC7 v13 and 2D DDS are supported. Escrow, Gen9, cubemaps and volumes are not supported. Limits: 128 MB/file, 64 files/256 MB per import, 2048 textures/384 MB workspace budget.

**Maps:** draw editable polygons, place labels/postals, adjust colors/opacity, reorder/lock layers and navigate with cursor-centered zoom and pan. Export the complete image, normalized editable JSON, XY postal JSON or the `/jaragps` client waypoint resource. The original San Andreas road map has known bounds; custom images disable GPS export because their coordinates are unverified. Native radar tiles must be prepared separately.

**Resources:** package already compiled Legacy native files and known metadata into stream/data folders. Headers, XML roots, collisions and selected vehicle references are checked; manifests declare only files present. No mesh compiler or code execution is included. Output retains original file bytes, a validation report and installation notes. Verify dependencies and file permissions, then test in FiveM. Limits: 512 files, 128 MB/file, 512 MB/package.
