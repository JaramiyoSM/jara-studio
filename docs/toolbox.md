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

Esta mesa reúne los archivos de un recurso para que no tengas que escribir el manifest a mano. Trabaja con recursos Legacy ya compilados: YDR, YDD, YFT, YTD, YTYP, YMAP, YBN, YCD, YMT y metadatos reconocidos. También admite YMAP/YTYP XML raw con raíz `CMapData` / `CMapTypes` y extensión `.ymap` / `.ytyp`.

### Elegir la receta correcta

| Receta                       | Archivos comprobados                                                      | Lo que debes revisar en FiveM                                         |
| ---------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Paquete libre                | Cualquier nativo o metadato reconocido                                    | Dependencias, nombres y propósito de cada archivo                     |
| Vehículo add-on              | YFT y `vehicles.meta`; YTD, handling y `_hi` recomendados según el modelo | LODs, ruedas, puertas, asientos, luces, física y colisión             |
| Livery / textura de vehículo | YTD y nombre exacto del diccionario destino                               | Nombres internos, UV, material, slots y flags del vehículo            |
| Ropa · colección add-on      | YDD, YTD, YMT y XML `ShopPedApparel`                                      | Prefijos `collection^component`, rig, drawable y texture indices      |
| Ropa · reemplazo             | YDD y YTD de la pieza original                                            | Nombres exactos, ped destino y recursos que reemplazan la misma pieza |
| Prop / objeto add-on         | YDR y YTYP                                                                | Archetype, bounds, LODs y colisión; YBN separado si corresponde       |
| Ped add-on                   | YDD, YFT, YMT y `peds.meta`; YTD o base revisada                          | Rig GTA, variaciones, movimiento, animaciones y ragdoll               |
| Arma add-on                  | YDR, `weapons.meta` y `weaponarchetypes.meta`; YTD o base revisada        | Modelo en la mano, muzzle, cargador, componentes y animaciones        |
| Mapa / colocación            | YMAP; YTYP si utiliza archetypes propios                                  | Archetypes externos, bounds y colisión                                |

Una receta orienta la preparación de una entrega concreta. Los archivos marcados como **Revisar** pueden depender del juego base o no ser necesarios para tu modelo. Los archivos requeridos ausentes bloquean **Crear recurso ZIP**; puedes guardar el informe para completar el trabajo. **Listo para probar** significa que la estructura de la receta pasó estas comprobaciones, no que el recurso haya sido probado en el motor del juego.

### Preparar y comprobar una entrega

1. Elige la receta y pulsa **Añadir archivos**. Puedes añadir varias tandas. Si una tanda tiene un nombre duplicado, un archivo cifrado o una cabecera no compatible, se rechaza completa y conserva lo que ya tenías en la mesa.
2. Revisa cada ruta de destino. Los binarios se colocan en `stream/`, los metadatos XML en `data/`. Los nombres originales, incluido `^` en ropa, se conservan exactamente.
3. Lee las referencias por revisar. En `vehicles.meta`, `modelName` debe tener un YFT, `txdName` un YTD y `handlingId` una entrada de `handling.meta`. Una textura con el mismo nombre nunca cuenta como modelo. También se comprueban los modelos de `carvariations.meta`, `weaponarchetypes.meta`, `weapons.meta` y los archetypes de YTYP raw.
4. Si hay YTD, pulsa **Comprobar YTD**. Esta comprobación abre de verdad el diccionario en un worker local y muestra nombres internos, resolución, codec, mipmaps y memoria. No crea vistas previas ni modifica el diccionario. Un YTD inválido bloquea el ZIP después de inspeccionarlo; corrígelo en Texture Lab o importa una base válida. Antes de esta operación solo se ha comprobado la cabecera.
5. Elige el nombre de recurso: 3–64 letras minúsculas, números o guiones bajos, empezando por letra. Por ejemplo, `jara_car_livery`.
6. Abre **Dependencias y build** si el paquete necesita un recurso que debe cargarse antes. Escribe sus nombres reales separados por comas. Opcionalmente indica la build mínima probada. Estas opciones generan `dependencies`, incluida `/gameBuild:...`, sin inventar nombres de otros recursos.
7. **Guardar informe** escribe un JSON independiente con rutas, comprobaciones, referencias, receta y resultados de diccionarios. No guarda ni sustituye los archivos originales.
8. Revisa dependencias y permisos de distribución, marca la casilla y pulsa **Crear recurso ZIP**. El ZIP contiene archivos originales, `fxmanifest.lua`, `validation.json` y `README.txt` en el idioma del programa. El manifest declara solo metadatos presentes y añade YTYP tanto a `files` como a `DLC_ITYP_REQUEST`.

### Ejemplo: livery de un vehículo propio

Abre un modelo con su UV real en la escena y prepara tu imagen. El nombre de la textura usado por el material es decisivo: muchos modelos utilizan algo como `car_sign_1`, pero ese nombre depende del vehículo. Abre el YTD original en Texture Lab y conserva las demás texturas y mipmaps al reconstruirlo. No exportes solo la livery si el mismo diccionario también contiene carrocería, interior o luces.

En Resource Pack elige **Livery / textura de vehículo**, añade ese YTD y escribe su nombre sin extensión: para `jara_car.ytd`, escribe `jara_car`. Si el coche viene de otro recurso, añade su nombre en Dependencias. Comprueba el YTD, guarda el informe y empaqueta. Esta receta prepara un diccionario de reemplazo; no añade automáticamente slots de livery, materiales nuevos o flags al vehículo.

### Ejemplo: ropa de una colección propia

Mantén juntos el YMT exportado, el XML `ShopPedApparel` y sus YDD/YTD. El `fullDlcName` suele ser el prefijo antes de `^`, por ejemplo `mp_m_freemode_01_jara^jbib_000_u.ydd`. La mesa avisa si el prefijo no coincide con la colección o falta un YMT del mismo nombre. Nunca renombra un archivo binario para intentar arreglar sus referencias internas.

En freemode, `jbib` es componente 11 (tops), `lowr` es 4 (pantalones), `feet` es 6 (calzado) y `uppr` es 3 (torso). El nombre mostrado en menús ESX/QB puede ser distinto: comprueba sus configuraciones e índices. Los pesos del rig y las variaciones deben exportarse mediante un flujo GTA válido; no se generan YMT vacíos para aparentar una colección completa.

### Instalar y comprobar en el servidor

Extrae el ZIP dentro de `resources`. Debe quedar `resources/jara_recurso/fxmanifest.lua`, no una carpeta adicional anidada. Añade `ensure jara_recurso` a `server.cfg`; las dependencias externas también deben existir. Inicia o reinicia el recurso en un servidor de prueba y comprueba los errores de consola.

Para vehículos prueba el modelo por su `modelName`; para props, su archetype. Para ropa y peds comprueba rig, animaciones, variaciones y clipping. Para armas verifica su registro, animaciones, componentes y su integración con el inventario de tu framework, que no se genera automáticamente. No distribuyas una entrega basándote solo en la cabecera correcta.

Límites: 512 archivos, 128 MB por archivo, 512 MB de paquete, 4096 referencias XML. Inspección de diccionarios: 64 YTD / 256 MB y 8192 texturas por tanda. El motor no admite escrow `FXAP` ni Enhanced `RSC8`. El informe avisa cuando la entrega supera 64 MB sin comprimir para que revises texturas y LODs; ese aviso no es un límite técnico de FiveM.

GLB, OBJ o FBX deben convertirse mediante Blender/Sollumz u otro compilador compatible antes de este paso. Los checks no modifican modelos, no pesan huesos, no calculan colisión y no ejecutan Lua importado. La receta no equivale a una validación completa del juego.

Referencias: [manifest de recursos](https://docs.fivem.net/docs/scripting-reference/resource-manifest/), [tipos de metadatos](https://docs.fivem.net/docs/game-references/data-files/) y [guías oficiales de assets 3D](https://docs.fivem.net/docs/assets-manual/).

---

# Jara Studio — local utilities

Utility workspaces retain their state while switching tabs or returning to the scene. They are independent from the `.jara` 3D project. Export each workspace before closing. Native close asks you to discard or cancel when a utility contains local data. This conservative warning remains while a workspace is nonempty, including after exports. No account or upload is required.

**Handling:** import UTF-8 `CHandlingDataMgr` bases, select a car, edit existing numeric fields and apply changes. Presets apply to checked cars and preserve unknown fields, flags, vectors and subhandling. Active XML exports every entry in its source file; resource ZIP includes all files and matching `HANDLING_FILE` declarations. Avoid duplicate handling names and test each preset in FiveM.

**Textures:** inspect real RGB/alpha channels and encoded mip levels. Re-encode checked entries in a local worker to BC1, BC3 or RGBA8. Whole-workspace YTD export includes unselected entries and preserves their encoded bytes and metadata, relocating internal pointers. Power-of-two fitting is explicit. BC7 is preserve-only; Legacy RSC7 v13 and 2D DDS are supported. Escrow, Gen9, cubemaps and volumes are not supported. Limits: 128 MB/file, 64 files/256 MB per import, 2048 textures/384 MB workspace budget.

**Maps:** draw editable polygons, place labels/postals, adjust colors/opacity, reorder/lock layers and navigate with cursor-centered zoom and pan. Export the complete image, normalized editable JSON, XY postal JSON or the `/jaragps` client waypoint resource. The original San Andreas road map has known bounds; custom images disable GPS export because their coordinates are unverified. Native radar tiles must be prepared separately.

## Resource Pack workflow

Choose **General**, **Add-on vehicle**, **Vehicle livery**, **Clothing collection**, **Clothing replacement**, **Prop**, **Ped**, **Weapon**, or **Map**. Add compiled Legacy GTA files and supported metadata. Raw YMAP/YTYP XML is also accepted when it has the expected `CMapData` / `CMapTypes` root and `.ymap` / `.ytyp` extension. Imports preserve original names and bytes; failed batches leave the current workspace intact.

Each named workflow checks required files and shows review items for optional or inherited data. Missing required files block ZIP export. **Ready to test** describes structural readiness only; the program has not run the resource inside FiveM.

Vehicle checks distinguish YFT models from YTD textures and resolve `handlingId` against imported handling entries. They also inspect model references in weapon metadata, vehicle variations and raw YTYP archetypes. ShopPedApparel XML can use its exported filename; it receives the `SHOP_PED_APPAREL_META_FILE` declaration. Collection prefixes and the expected variation YMT are checked without renaming files.

Click **Check YTD** to inspect actual dictionary entries in a local worker. It lists texture names, resolution, codec, mip levels and memory without previews or re-encoding. If inspection fails, fix the dictionary or import a valid original before exporting. Until this operation, only the RSC7 header has been checked. BC7 entries remain supported for inspection/preservation, with no recoding claim.

For liveries, enter the exact target dictionary name without `.ytd`; it must match an imported file. Preserve the texture name sampled by the vehicle material and all other entries in that dictionary. This workflow does not create new vehicle materials, livery slots or flags. For clothing, keep YMT, ShopPedApparel and collection-prefixed YDD/YTD together; verify rig, clipping and drawable/texture indices in-game.

Set real external resource names under **Dependencies and build** only when those resources must load first. An optional minimum build produces a `/gameBuild:...` manifest constraint. Save the JSON report, review dependencies and redistribution rights, then create the ZIP. Output contains `stream/`, `data/`, a manifest declaring only present files, `validation.json` and instructions in the program language. YTYP is listed in `files` and registered with `DLC_ITYP_REQUEST`.

Extract the resource folder directly under the server's `resources`, add `ensure resource_name` to `server.cfg` and test in a development server. Check console errors, spawning, textures, rigs, animations, collisions and framework integrations. No code, native mesh compiler, GTA auto-rig or inventory setup is generated.

Limits: 512 files, 128 MB/file, 512 MB/package and 4096 XML references. Dictionary inspection: 64 YTD/256 MB and 8192 textures per batch. Escrow and Enhanced RSC8 are unsupported. The 64 MB uncompressed package warning is a practical download-budget suggestion, not a FiveM platform limit. GLB/OBJ/FBX must be compiled externally with a compatible GTA workflow.
