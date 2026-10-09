# Guía de Jara Studio

## 1. Instalar y empezar

Descarga el instalador x64 o la versión portátil de la [publicación oficial](https://github.com/JaramiyoSM/jara-studio/releases). Al iniciar el instalador elige **Español** o **English**. Después elige la carpeta y sigue los pasos para crear los accesos directos. No requiere una cuenta de Jara-tools. La aplicación funciona con archivos locales y no sube tus creaciones.

Esta primera versión no tiene firma de editor. Windows puede mostrar una advertencia de editor desconocido. Comprueba el origen de la descarga y su SHA-256 publicado antes de decidir si ejecutarla. No se necesita desactivar la protección de Windows.

Usa un equipo Windows x64 con un controlador gráfico actualizado y soporte WebGL2. Las escenas grandes necesitan memoria RAM y memoria gráfica suficiente. La aplicación limita cada importación a 128 archivos, 128 MiB por archivo y 256 MiB en total; eso no garantiza que tu GPU pueda mostrar una escena de ese tamaño.

En una instalación nueva la interfaz usa el idioma elegido durante la instalación. Una preferencia guardada anteriormente tiene prioridad. La versión portátil elige español o inglés a partir del orden de idiomas del sistema. Cambia el idioma con el selector de la barra superior o **Vista → Idioma**; se recuerda para el próximo inicio. Puedes ampliar la interfaz desde el menú Vista. Abre la guía rápida con F1.

## 2. Tu primera escena

1. Abre un ejemplo de la bandeja inferior: humano articulado, camiseta y vaqueros, coche, caja o arma estilizada. Todos incluyen licencia CC0 y procedencia en `public/samples`.
2. Selecciona el objeto en el árbol de la izquierda. Puedes expandirlo para escoger una malla.
3. Arrastra en el visor para orbitar; la rueda acerca o aleja. Pulsa F para encuadrar.
4. Usa W para mover, E para rotar y R para escalar. El gizmo permite elegir un eje. Puedes escribir medidas exactas en el inspector.
5. Activa Ajuste para desplazamientos por pasos. Cambia entre ejes locales o del mundo. Las posiciones se expresan en metros y las rotaciones en grados.
6. Guarda el proyecto con Ctrl+S. Elige una carpeta tuya y un nombre `.jara`.

Las categorías Ropa, Vehículos, Peds, Props y Armas organizan el trabajo y sugieren ejemplos; comparten la escena. Cambiar de categoría no convierte un modelo en un formato GTA.

## 3. Importar tus modelos

Se admiten GLB, glTF, OBJ con MTL, FBX y STL. Selecciona el modelo y las imágenes o binarios que referencia en una misma importación. GLB con texturas integradas es la opción más sencilla. Un OBJ necesita su MTL y las texturas originales si quieres conservar el aspecto. STL normalmente solo contiene geometría.

Las referencias externas a Internet no se cargan. Los nombres de archivos asociados deben coincidir con las referencias del modelo. Si falta una textura, vuelve a importar el conjunto completo o asígnala desde Material. No se admiten archivos ejecutables como modelos.

El cargador 3D limita cada modelo o dependencia a 96 MiB y cada modelo a cinco millones de vértices. Conserva las unidades originales; un FBX creado en centímetros necesita que compruebes su escala respecto al mundo en metros.

Cada importación crea un objeto en la escena. Puedes combinar varios modelos y primitivas. Duplica con el botón del árbol, oculta temporalmente objetos y bloquea los que quieras proteger de movimientos accidentales. Deshacer y rehacer recuperan las operaciones de edición disponibles en la sesión.

## 4. Materiales y ropa

Selecciona una malla y, si tiene varios materiales, elige la ranura correcta. Cambia color, rugosidad, metal y opacidad desde el inspector. Con Textura de color asignas una imagen a ese material.

Abre Mapa UV para inspeccionar las coordenadas y exportar una plantilla PNG. Con **Diseñar ropa / livery** se abre el Taller de superficies: una textura 2D con sus UV reales, una vista 3D que responde al diseño y capas de pintura, texto, color e imágenes. El material de la malla seleccionada se aísla al aplicar para conservar otros objetos y ranuras.

1. Selecciona la prenda o carrocería, su malla y la ranura de material que contiene la textura de color. Necesitas coordenadas UV existentes; el taller no hace un desplegado automático.
2. Usa Pincel para pintar en la capa seleccionada. Elige color, tamaño y opacidad. Borrador quita solo pintura de esa capa y permite volver a ver la textura original.
3. Añade texto o importa PNG, JPG o WebP como una capa. Con Mover arrastra la capa sobre el lienzo; afina posición, ancho, alto, rotación y opacidad en el panel. Activa **Pintar / colocar en 3D** para pintar directamente en la superficie o colocar una capa de texto/imagen al hacer clic en el modelo. Solo responde la malla y ranura seleccionada. Desactiva ese modo para volver a orbitar. Oculta, reordena o elimina capas para comparar versiones. Deshacer diseño y Rehacer diseño recuperan cambios del taller.
4. La guía UV respeta la orientación y transformación de la textura y filtra la ranura de material. Las islas UV compartidas, espejadas o repetidas reciben el mismo diseño: para una livery única por cara necesitas UV únicas desde tu modelador. Colores sin tinte del material permite revisar el resultado sin multiplicarlo por el color del material.
5. Exportar textura PNG guarda solo los píxeles, sin guía UV ni selección. Aplicar al modelo combina las capas en una textura de color. Guarda `.jara` o exporta GLB para conservar esa imagen integrada; OBJ no incorpora texturas. El historial de capas es de esta sesión del taller: al volver a abrir, editas la textura final aplanada.

La edición usa 512, 1024 o 2048 px según la textura de entrada. Puedes cambiar Resolución; remuestrea la imagen y reinicia el historial del taller, con confirmación si hay cambios. Se admiten hasta 16 capas; las capas de pintura y las imágenes tienen límites de memoria, y el historial reduce sus estados para mantener su presupuesto. Los archivos de imágenes utilizadas se conservan como originales al aplicar. Cerrar sin aplicar descarta el diseño; no cambia el material de la escena. El taller es para texturas de color: mapas normales, costura, topología y rigging se trabajan en un modelador dedicado.

La malla de ropa de ejemplo tiene UV y materiales reales, pero necesita preparación específica para usarse como ropa nativa en GTA.

Para una prenda FiveM, conserva los archivos originales y revisa nombres de componente, variación y textura en Sollumz. Una imagen DDS por sí sola no crea una prenda ni un YDD.

## 5. Peds, huesos y animaciones

Activa Esqueleto para visualizar los huesos existentes de una malla articulada. Selecciona un clip en Animaciones, reproduce o pausa y mueve el control de tiempo para revisar poses. El humano incluido permite explorar una malla con pesos y esqueleto.

El programa reproduce clips que están realmente incluidos en el modelo. No inventa clips si faltan. Tampoco asigna automáticamente pesos compatibles con GTA ni retargetea cualquier esqueleto al de un ped. Comprueba huesos, pesos, límites y nombres en Blender/Sollumz antes de compilar.

## 6. Cámaras y medidas

Usa Perspectiva para inspección libre, y Frente, Derecha o Superior para comparar dimensiones sin distorsión de perspectiva. Puedes mostrar alambre y rejilla. Medir dos puntos muestra la distancia entre dos clics sobre superficies de la escena; comprueba la escala de tu importación antes de interpretar esa medida.

## 7. Proyectos y recuperación

`.jara` es un archivo ZIP versionado: conserva un manifiesto, la escena GLB con geometría/materiales/texturas y los archivos originales importados cuando están disponibles. Es distinto del `.jara.json` de las herramientas web.

Abre con Ctrl+O. Abrir otro proyecto sustituye la escena actual, así que guarda primero tus cambios. El programa verifica estructura, rutas y tamaños del archivo. Un proyecto dañado o que excede los límites se rechaza.

Cuando hay cambios y una escena con objetos, el escritorio guarda una recuperación local aproximadamente cada 45 segundos. Usa Archivo → Recuperar sesión después de un cierre inesperado. La recuperación no sustituye tus guardados ni una copia de seguridad. La vista previa en navegador no tiene la misma persistencia nativa.

Los proyectos y sus archivos expandidos tienen un límite de 256 MiB; la recuperación admite hasta 128 MiB. Una recuperación que excede ese tamaño muestra un error: guarda manualmente. Los archivos exportados desde Utilidades pueden llegar a 512 MiB dentro de los límites de cada mesa.

El proyecto `.jara` guarda la escena 3D. Las mesas de Utilidades tienen exportaciones propias y no se incluyen en ese proyecto. Exporta también handling, texturas y mapas antes de cerrar el programa. Cambiar entre mesas mantiene sus datos durante la sesión.

Al cerrar con cambios o datos de utilidades abiertos, un aviso permite volver al estudio o descartarlos. El aviso no guarda automáticamente las mesas: vuelve y exporta antes de salir si necesitas conservarlas.

## 8. Exportar

| Formato | Contenido                                         | Siguiente paso                                                    |
| ------- | ------------------------------------------------- | ----------------------------------------------------------------- |
| GLB     | Geometría, materiales, texturas y clips admitidos | Abrir en Blender/Sollumz y preparar el formato GTA                |
| OBJ     | Geometría y coordenadas UV                        | Importar en otro editor; materiales e imágenes no están incluidos |
| PNG     | Captura del visor o plantilla UV                  | Presentación o pintura de texturas                                |
| JSON    | Nombres, transformaciones y visibilidad           | Referencia de colocación; no es un YMAP                           |
| `.jara` | Proyecto editable y originales                    | Continuar en Jara Studio                                          |

Ninguna exportación GLB/OBJ se presenta como YDR, YDD, YFT o recurso nativo listo para el juego. Verifica en FiveM el resultado de la compilación externa.

## 9. Utilidades para recursos

**Handling:** importa un `handling.meta` y revisa cada vehículo. Los cambios conservan los campos ajenos a la edición. Exporta el XML o el paquete de recurso y compara cambios antes de reemplazar tu archivo del servidor. Guarda una copia del original.

**Texturas:** abre imágenes, DDS o diccionarios YTD Legacy compatibles. Revisa dimensiones, canales y mipmaps. Los formatos y compresiones no admitidos muestran un error. Al reemplazar una entrada compatible se conservan las demás; valida la exportación antes de instalarla. No todos los YTD de todas las versiones del juego son equivalentes.

**Recursos:** selecciona archivos nativos y metadatos. El validador revisa encabezados, XML, referencias y el manifiesto que empaqueta. Un encabezado válido no demuestra que la geometría esté bien compilada: la comprobación definitiva es cargar el recurso en un servidor de prueba.

**Minimapa:** trabaja sobre la cartografía de ejemplo o tu propia imagen con zonas y postales. Ajusta los límites de coordenadas a tu mapa. Las imágenes, capas y datos de postales sirven para preparar un recurso; no reemplazan automáticamente las texturas nativas del radar.

## 10. Flujo completo recomendado

1. Conserva una carpeta con los originales y sus licencias.
2. Importa, revisa escala, materiales, UV, huesos y clips en Jara Studio.
3. Guarda `.jara` y exporta GLB para la preparación nativa.
4. En Blender/Sollumz crea shaders, colisiones, LOD y esqueleto adecuados; exporta los archivos GTA.
5. Vuelve a Utilidades para organizar archivos, revisar referencias y generar el paquete.
6. Instala en un servidor FiveM de prueba, añade el recurso a `server.cfg` y comprueba consola, apariencia, físicas y rendimiento.
7. Documenta controles, dependencias, permisos y licencia antes de distribuir tu creación.

## 11. Privacidad, soporte y licencias

Los modelos y proyectos se procesan en tu equipo. La aplicación no requiere OAuth, Supabase ni una clave secreta. Los enlaces de ayuda y comunidad abren el navegador y se rigen por las políticas de esas páginas. El código de escritorio tiene licencia MIT; los modelos, tipografías y bibliotecas conservan sus licencias indicadas.

Para comunicar un fallo, usa [Issues](https://github.com/JaramiyoSM/jara-studio/issues) e incluye versión, pasos, mensaje y un archivo mínimo que tengas permiso para compartir. No publiques claves, datos personales ni activos privados. También puedes consultar la [comunidad de Jaramiyo](https://discord.gg/TvDYptEDAj).
