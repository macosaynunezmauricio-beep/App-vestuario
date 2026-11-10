# Mi Armario 5.4 beta

Actualización incremental de la app web empaquetada con Capacitor. Conserva
`mx.miarmario.personal`, el origen HTTPS de Capacitor y los almacenes IndexedDB
`armario-local-v1/clothes` y `armario-local-v1/outfits`. Una prenda antigua que
solo tiene la imagen procesada se puede editar hasta el límite de los píxeles
conservados. Las altas nuevas guardan el archivo original junto al PNG editado.

## Uso

- En **Añadir prenda**, elige Cámara o Galería. Prueba **Quitar fondo** si la prenda está centrada sobre un fondo liso. En **Editar recorte**, borra el
  fondo y recupera zonas con el pincel. Ajusta el tamaño y suavizado, aplica el
  recorte, revisa los campos y guarda.
- En **Armario** puedes buscar, filtrar y volver a editar los datos y la imagen.
- En **Inicio** están los outfits favoritos y la exportación/importación JSON.
  La importación combina los almacenes en una transacción y respeta los
  registros con identificadores que ya existen. El JSON incluye fotografías
  personales. Guárdalo en un lugar privado.
- En Android, **Descargar imagen** del probador manual abre el selector del sistema para guardar el PNG.
- El editor manual, el armario, las combinaciones y el probador manual se
  ejecutan localmente. La sugerencia opcional de categoría con CLIP necesita
  conexión para cargar dependencias. El envío opcional al servidor CatVTON
  solicita confirmación para las dos fotos.

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

## Compilación

GitHub Actions ejecuta `npm ci` y `npm test`, prepara Java 21 y Android
SDK 35, genera el proyecto Android de Capacitor 7 y compila `assembleDebug`.
El workflow se ejecuta en PR hacia `main`, en push a `main` o manualmente.
El disparador manual requiere que el workflow esté disponible en la rama
predeterminada. Descarga `mi-armario-debug-apk` desde el resumen de la ejecución.

Para compilar localmente con Node 22, Java 21 y Android SDK 35:

```sh
npm ci
npm test
npx cap add android
cp native-android/*.java android/app/src/main/java/mx/miarmario/personal/
npx cap sync android
cd android
./gradlew assembleDebug --no-daemon --stacktrace
```

El APK se genera en `android/app/build/outputs/apk/debug/app-debug.apk`.
Para actualizar sobre un APK existente se requiere el mismo certificado de
firma. Los runners desechables pueden generar una clave debug distinta. Usa
la clave original para probar una actualización en sitio y conserva una copia
antes de instalar.

## Estado de validación

- Cinco pruebas Node cubren sintaxis, validación de respaldos, color blanco,
  operaciones alfa del pincel e importación con IndexedDB simulado.
- Dependencias resueltas con lockfile y generación/sincronización de Capacitor
  7.6.10 comprobada.
- La compilación local se detuvo durante la descarga de Gradle 8.11.1 por falta
  de acceso de red. El entorno tampoco dejó iniciar Chromium para la prueba
  integral. Quedan por comprobar instalación, cámara, exportación en WebView y
  el flujo completo con fotografías de prendas sobre personas.
