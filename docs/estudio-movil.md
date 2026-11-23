# Mi Armario · Estudio móvil

## Probar la versión

Descarga y descomprime el artefacto `mi-armario-debug-apk` de la ejecución de esta rama e instala `app-debug.apk`. Se utiliza el identificador `mx.miarmario.personal` y el mismo IndexedDB de las versiones anteriores. Android requiere el mismo certificado para actualizar una instalación. Si Android rechaza la actualización por firma, exporta primero tu copia en Inicio desde la versión instalada. Desinstalar elimina los datos locales.

1. En Inicio, abre el probador y elige una foto frontal de cuerpo entero.
2. Toca las miniaturas de tu armario. Los hombros, caderas, rodillas y tobillos visibles guían el ajuste inicial. Selecciona una prenda en la foto o por nombre para retocarla. Si la detección falla, marca dos esquinas.
3. Con un único zapato recortado, usa **Probar también en el otro pie**. Crea una segunda capa reflejada, que puedes ajustar por separado.
4. Nombra el conjunto y guárdalo. Puedes reabrirlo en Inicio, guardar cambios o guardar una copia.
5. **Guardar imagen** exporta el conjunto visible como PNG. En Android 10 o posterior aparece en Imágenes / Mi Armario. En versiones anteriores se elige el archivo de destino. **Compartir** abre el menú de Android.

## Procesamiento local

- MediaPipe Pose Landmarker Lite se incluye en el APK. El ajuste articula las prendas con una malla de 25 puntos y permite volver a abrir conjuntos con mallas de nueve puntos. Una postura lateral, cruzada u oculta puede requerir retoques. El resultado es una composición fotográfica 2D.
- La categoría se sugiere con el nombre disponible o con un clasificador de diez clases entrenado con Fashion-MNIST. Los pesos cuantizados y el código de inferencia se instalan con la app. El reconocedor visual necesita una prenda aislada y se abstiene ante resultados dudosos. Fondos complejos, prendas puestas y accesorios fuera de esas diez clases requieren revisión. En Android, el editor ofrece selección local por toque, borrado de fondo por color y corrección manual.
- La prueba de referencia del clasificador cuantizado dio 8.388 aciertos entre 10.000 imágenes del conjunto oficial de prueba. Mide clasificación de productos de catálogo. Para reproducirla, instala NumPy y scikit-learn en un entorno de desarrollo y ejecuta `python tools/train-fashion.py RUTA_A_LOS_CUATRO_GZ`. La app no necesita Python.
- El clasificador de color trabaja en CIELAB sobre la silueta y excluye la transparencia. Admite un segundo color y un color principal personalizado.
- El PNG se compone en un lienzo independiente de hasta 1280 píxeles en su lado mayor. El puente mueve bloques de 96 KiB a la caché privada. Android copia por streaming y publica la fila de MediaStore tras cerrar el archivo. Al compartir, un FileProvider concede lectura temporal. Los archivos compartidos se purgan en una exportación posterior tras un día.

## Verificación

`npm test` ejecuta pruebas unitarias y `npm run test:browser` recorre el editor y el catálogo en Chromium. El segundo trabajo de Actions instala el APK en un emulador Android y ejercita la detección de pose y la exportación usando una foto pública de MediaPipe. Comprueba la resolución y los bytes de los PNG leídos desde MediaStore, los colores de fondo y prenda, la continuidad del proceso y la apertura del menú para compartir. El resultado de cada ejecución figura en GitHub Actions.

En el teléfono de destino conviene comprobar cámara y galería del fabricante, ajuste de una camisa y un pantalón reales, interacción con dos dedos y compatibilidad de firma al actualizar.

## Recursos incluidos

Fotografía de portada de Priscilla Du Preez, publicada bajo la licencia Unsplash. [Fotografía](https://unsplash.com/photos/dlxLGIy-2VU) · [Licencia](https://unsplash.com/license)

Instrument Serif se distribuye bajo SIL Open Font License. [Aviso incluido](../www/assets/FONT-LICENSE.txt)

Fashion-MNIST de Zalando SE se distribuye bajo MIT. [Fuente y datos](https://github.com/zalandoresearch/fashion-mnist) · [Aviso incluido](../www/assets/FASHION-LICENSE.txt)

La prenda de prueba `checks/fixtures/pantalon.png` procede del primer pantalón del conjunto oficial de prueba de Fashion-MNIST. Se amplió con vecino más próximo y se hizo transparente el fondo para probar el registro de una prenda PNG.

En una foto de calzado blanco prueba **Recorte delicado** antes de quitar el fondo. Restringe el borrado cuando la diferencia de color es pequeña y conserva piezas separadas de tamaño significativo. Dos zonas con píxeles idénticos pueden requerir el pincel. En el probador puedes tocar a través del hueco entre las piernas de un pantalón o de otro espacio transparente para seleccionar la prenda que se ve detrás.
