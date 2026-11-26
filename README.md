# Mi Armario 5.4 beta

Actualización incremental de la app web empaquetada con Capacitor. Conserva
`mx.miarmario.personal`, el origen HTTPS de Capacitor y los almacenes IndexedDB
`armario-local-v1/clothes` y `armario-local-v1/outfits`. Una prenda antigua que
solo tiene la imagen procesada se puede editar hasta el límite de los píxeles
conservados. Las altas nuevas guardan el archivo original junto al PNG editado.

## Uso y versión de prueba

El probador permite añadir prendas por miniatura, ajustarlas con la postura local, retocar su forma, guardar conjuntos por nombre y exportar o compartir el PNG. Inicio reúne el acceso al probador, las prendas recientes, los conjuntos y el respaldo. El APK incluye todos los recursos de ejecución.

[Instalación, controles, pruebas y limitaciones del estudio móvil](docs/estudio-movil.md)

## Combinar tu ropa y probar prendas de tienda

- **Combinar** propone una prenda superior, una inferior y calzado según la
  ocasión, los colores y tus favoritas. Toca **Cambiar** bajo una pieza para
  comparar alternativas sin cambiar las otras.
- El último conjunto guardado aparece en **Inicio**, con prenda y calzado
  juntos aunque todavía no hayas cargado una foto de cuerpo entero.
- Para evaluar una compra, carga una foto en **Añadir prenda**, revisa el
  recorte y la categoría, y pulsa **Combinar sin añadir al armario**. La pieza
  queda marcada como **De tienda** en la vista y, si guardas el conjunto, en
  él. No se agrega al catálogo. Se usa galería o cámara; la recepción directa
  desde el menú Compartir de Android y las sugerencias de tiendas quedan pendientes.
- **Probar conjunto** carga todas las piezas en el mismo probador, sin pedir
  de nuevo tu foto. Si ya estabas editando un conjunto, se confirma antes de
  reemplazar sus capas y el cambio se puede deshacer.

## Registrar varias prendas desde una foto

En Android, entra a **Añadir prenda**, carga una foto de cuerpo entero y toca
**Detectar varias prendas**. El sistema local propone recortes separados de
parte superior, parte inferior y del calzado que pueda distinguir. Puedes
cambiar el nombre, la categoría o el color y desmarcar lo que no quieras
guardar. El lote se guarda junto y solo retiene los recortes confirmados, no
la foto de cuerpo entero. No necesita conexión ni agrega nada antes de que
confirmes.

Una persona de frente, con luz uniforme, cintura visible y contraste entre la
ropa y el fondo da el mejor punto de partida. Evita cruzar los brazos para que no queden huecos en la camisa. Si no se distingue una pieza, no
se fuerza una sugerencia; puedes recortarla a mano desde la foto de origen.
No es un detector general de capas superpuestas, vestidos o accesorios.

La prueba Android usa una [foto de Marlon Schmeiski](https://www.pexels.com/photo/a-man-in-shorts-and-sneakers-standing-in-front-of-a-wall-28079589/)
([licencia Pexels](https://www.pexels.com/license/)) descargada al entorno de
pruebas, no al APK, y la foto preexistente de MediaPipe para descartar pies
descalzos.

## Recortar una prenda en Android

1. Abre la foto en el editor de recorte. Para ropa sobre una mesa o una percha, elige **Prenda suelta**. Si alguien la lleva puesta, elige **Parte superior puesta** o **Parte inferior puesta**.
2. Pulsa **Seleccionar por toque** y toca dentro de la tela. Para añadir la otra pernera o el segundo zapato, usa **Sumar zona** y repite el toque. Usa **Restar zona** o los pinceles para afinar la máscara.
3. Pulsa **Aplicar recorte** para usar el PNG transparente. El original queda disponible al editar la prenda.

MagicTouch selecciona el objeto indicado. En fotos de ropa puesta, Selfie Multiclass identifica las regiones de ropa, pelo y piel. La postura y el borde visible de la tela ayudan a separar camisa y pantalón a la altura de la cintura. Si el borde es ambiguo, el editor permite ajustar la selección con el pincel. Las dos redes se instalan con el APK. [Modelos y licencia](www/assets/MEDIAPIPE-NOTICE.txt)

## Manos y rostro en el probador

Al abrir una foto con postura reconocible, el probador recupera sus píxeles de rostro, cabello y piel cerca de las manos y los antebrazos. Así, una mano cruzada puede pasar por delante de la camisa. En **Manos y brazos delante de la ropa** puedes desactivar la protección o corregirla con el pincel. El conjunto y su respaldo guardan la máscara, y la exportación la aplica a la imagen final. La detección puede omitir manos tapadas o poco visibles. La caída de la tela sigue dependiendo del ajuste geométrico.

## Compilación y verificación

El flujo de GitHub Actions instala dependencias desde el lockfile, ejecuta Node y Chromium, prepara Capacitor con Java 21 y Android SDK 35, integra los plugins nativos y comprueba los hashes de los tres modelos de visión. Publica el APK de depuración y lo instala en un emulador para probar el recorte, el primer plano y el guardado de imágenes con la red desactivada. El resultado exacto y los artefactos están en la ejecución correspondiente al commit.

[Configuración reproducible de la compilación](.github/workflows/android-debug.yml)

### Integración fotográfica del probador

En **Cuello de la camisa → Conservar mi cuello**, Android detecta la piel que ya es visible en la foto original y permite recuperarla para una camisa abierta; no recupera la camisa anterior. El ajuste también usa diferencias suaves de luz del torso y busca la silueta de cada zapato por separado. Si el recorte trae un halo, **Ajustes de las prendas → Limpiar borde del recorte** permite reducirlo sin retocar el catálogo. Las fotos y el cálculo quedan en el dispositivo. Sigue siendo un probador 2D: no reconstruye el fondo, la piel que no se ve ni la caída física de la tela.
