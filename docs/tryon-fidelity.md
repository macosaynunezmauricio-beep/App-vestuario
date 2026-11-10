# Probador generativo: corrección de entradas

La generación anterior enviaba `item.original || item.image`, ignorando el recorte que el usuario había corregido. También fijaba 25 pasos, semilla 42 y `segmentation_free=true` para todas las fotos.

Esta revisión usa la imagen editada por defecto, elimina únicamente márgenes transparentes y compone explícitamente el canal alfa sobre blanco, conservando colores y proporciones dentro de un lienzo 768 × 1152. La lectura de píxeles se limita a 1536 px por lado. No se vuelve a segmentar por color ni se modifica la foto guardada. Se puede elegir la foto original si el recorte está incompleto, y especificar si la prenda está sola o puesta en otra persona.

Se usan 50 pasos, guidance 1.5 y ajuste con segmentación por defecto, conforme al contrato público del demo. El modo holgado activa segmentation_free. Cada solicitud usa una semilla nueva. Esto no garantiza fidelidad: se mantiene el estado experimental y el aviso de transmisión a terceros.

Referencias verificadas:
- https://huggingface.co/spaces/fashn-ai/fashn-vton-1.5/blob/main/app.py
- https://huggingface.co/spaces/fashn-ai/fashn-vton-1.5/blob/main/tips.html
- https://fashn-ai-fashn-vton-1-5.hf.space/gradio_api/info

## Validación

- `npm test`: 11 pruebas aprobadas, incluyendo payload real del adaptador con transporte simulado, límites alfa, rechazo de cuota y URL de salida ajena al servicio.
- Comprobación adicional con Canvas nativo: PNG 768 × 1152, fondo blanco opaco, preservación de píxeles blancos y rojos. No equivale a prueba en Android.
- Chromium no pudo arrancar en este entorno (socket no permitido). No se afirma validación visual de WebView.
- No se enviaron fotos personales a terceros durante estas pruebas.

## Prueba pendiente en teléfono

1. Instalar el APK sobre la versión anterior, conservando el identificador y datos.
2. Elegir la foto frontal y camisa naranja. Revisar el recorte guardado antes de generar.
3. Generar con opciones por defecto y comprobar que la miniatura enviada corresponde a la camisa recortada.
4. Comparar cuello, botones, bolsillo y mangas con la prenda real. Una respuesta HTTP exitosa no prueba fidelidad.
5. Probar otra variante y comparar. Repetir con pantalón gris; calzado sigue fuera del alcance del modelo.
6. Cancelar, cambiar de foto durante la generación y simular falta de conexión. Los conjuntos guardados deben permanecer intactos.

Las cuotas y disponibilidad pertenecen al demo gratuito. No hay garantía de servicio ni de que estos cambios resuelvan las alucinaciones observadas; hace falta comparación visual con el caso del usuario.
