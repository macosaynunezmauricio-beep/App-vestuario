# Mi Armario 5.4 beta

Actualización incremental de la app web empaquetada con Capacitor. Conserva
`mx.miarmario.personal`, el origen HTTPS de Capacitor y los almacenes IndexedDB
`armario-local-v1/clothes` y `armario-local-v1/outfits`. Una prenda antigua que
solo tiene la imagen procesada se puede editar hasta el límite de los píxeles
conservados. Las altas nuevas guardan el archivo original junto al PNG editado.

## Uso y versión de prueba

El probador permite añadir prendas por miniatura, ajustarlas con la postura local, retocar su forma, guardar conjuntos por nombre y exportar o compartir el PNG. Inicio reúne el acceso al probador, las prendas recientes, los conjuntos y el respaldo. El APK incluye todos los recursos de ejecución.

[Instalación, controles, pruebas y limitaciones del estudio móvil](docs/estudio-movil.md)

## Auditoría y diseño de segmentación

El editor anterior solo abría después de que un modelo genérico descargado desde
un CDN devolviera un resultado. Su pincel Recuperar estaba limitado por esa
máscara y podía dejar fuera partes de la prenda. La selección por color tampoco
separaba piel, fondo y prendas similares. Esta beta reemplaza esos atajos de
recorte con un editor que abre directamente sobre la foto local.

La segmentación especializada por toque queda pendiente. Para un prototipo,
probar **SegFormer-B2 Clothes** con ONNX Runtime para Android y un puente
Capacitor. El modelo está entrenado en ATR y tiene clases de ropa y partes
corporales. La ficha de pesos indica licencia **other** y el código de
entrenamiento tiene licencia MIT. Confirmar los permisos de redistribución de
pesos por separado antes de empaquetarlos. El orden de magnitud del checkpoint
FP32 es 109 MB y solo los pesos equivalentes en INT8 serían aproximadamente
27 MB antes de metadatos y capas que queden en flotante. La RAM pico y latencia
dependen de las activaciones y del proveedor de ejecución. Quedan por medir.
[Ficha de pesos](https://huggingface.co/mattmdjaga/segformer_b2_clothes/tree/main)
y [código de entrenamiento](https://github.com/mattmdjaga/segformer_b2_clothes).

**FASHN Human Parser** es una alternativa SegFormer-B4 con 18 clases que separan
rostro, brazos y torso de tops, pantalones y otras prendas. Su licencia declarada
es NVIDIA SegFormer y su entrada es 384 × 576. Su encoder más grande lo deja como
referencia de calidad para comparar. [Ficha del modelo](https://huggingface.co/fashn-ai/fashn-human-parser).

El puente nativo debería leer la imagen local, conservar orientación y mapa de
coordenadas, identificar la clase bajo el toque y seleccionar el componente
conectado de esa clase que contiene el punto. Devuelve una máscara alfa al
editor. Dos prendas contiguas de la misma clase pueden requerir un modelo de
instancias o corrección manual. Evaluar cobertura de prenda y fuga de piel con
fotos de camisas puestas, mangas, prendas superpuestas y fondos variados.
Comparar ONNX FP32 e INT8 en el teléfono antes de decidir el formato final,
midiendo latencia en frío y caliente, RAM máxima y tamaño del APK.

## Compilación y verificación

El flujo de GitHub Actions instala dependencias desde el lockfile, ejecuta Node y Chromium, prepara Capacitor con Java 21 y Android SDK 35, integra los plugins nativos y comprueba el hash del modelo de pose. Publica el APK de depuración y lo instala en un emulador para probar el guardado de imágenes. El resultado exacto y los artefactos están en la ejecución correspondiente al commit.

[Configuración reproducible de la compilación](.github/workflows/android-debug.yml)
