# Probador fotográfico local

Esta revisión retira FASHN, los formularios CatVTON y sus controladores de envío de fotos. Conserva el reconocimiento opcional de categorías que descarga CLIP; es independiente del probador. El modelo de pose MediaPipe se incluye en el APK durante la compilación y su inferencia se ejecuta localmente.

## Funciones

- Deformación por una cuadrícula de nueve puntos por prenda. Arrastrar un punto modifica esa región; terminar el modo vuelve a habilitar mover, ampliar y rotar toda la prenda.
- La malla se representa en coordenadas normalizadas y se renderiza con triángulos. Se rechazan pliegues invertidos y desplazamientos fuera de límites.
- Deshacer/rehacer conserva copias independientes de la malla y las pinceladas.
- Pincel que revela zonas de la fotografía original por delante del conjunto. Es manual: puede recuperar también ropa original presente en esa zona. Se puede borrar esa máscara y retocar de nuevo.
- Controles de luminosidad y opacidad por prenda, comparación con la foto original y restauración de la forma.
- Guardar/reabrir y respaldar conjuntos incluye deformaciones y máscara. Los conjuntos anteriores sin estos campos siguen siendo válidos. No cambia la versión de IndexedDB ni el identificador Android.
- El ajuste geométrico de pantalones admite proporciones más alargadas y tiene en cuenta la separación de los tobillos.
- La exportación omite guías y comparación con el original. Se conserva oculta la descarga en Android: esta revisión no declara resuelto el fallo previo del guardado nativo.

No implementa reconstrucción 3D, simulación física de telas, inferencia de talla ni segmentación automática de brazos. La geometría de nueve puntos permite correcciones de silueta, no articulación completa de cada manga o pernera.

## Validación

`npm test` comprueba geometría, transformaciones, límites de las pinceladas, importación compatible, datos corruptos, persistencia y operaciones existentes. `npm run test:browser` usa un navegador real en CI con conexión desactivada: añade camisa naranja, pantalón gris y tenis negros sintéticos, arrastra la malla, prueba historial y pincel, guarda/reabre y valida el respaldo. Estas imágenes sintéticas prueban comportamiento, no fidelidad con ropa real.

El navegador local no arranca por restricciones de sockets; las pruebas de navegador se ejecutan en GitHub Actions. El resultado definitivo debe consultarse en la ejecución del commit correspondiente. No hay dispositivo Android físico conectado.

## Revisión en Android

1. Exportar una copia del armario antes de instalar la actualización y comprobar conservación de prendas y conjuntos.
2. En modo avión, abrir una foto frontal de cuerpo entero y agregar camisa naranja, pantalón gris y tenis negros.
3. Ajustar la posición general y usar «Dar forma a la prenda» para adaptar hombros/cintura/largo; comprobar que no se inviertan los puntos y que el resto de las prendas permanezca estable.
4. Entrar en «Manos y brazos delante de la ropa», pintar las zonas originales, borrar parte del retoque y probar deshacer/rehacer.
5. Guardar, cerrar/reabrir la aplicación y abrir el conjunto. Exportar/importar respaldo y verificar que las correcciones se conservan.
6. Repetir con una foto de alta resolución y revisar fluidez y consumo de memoria. Verificar pose real de MediaPipe: CI no sustituye esta prueba.
