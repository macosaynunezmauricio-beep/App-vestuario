# Mi Armario para Android — proyecto de APK (beta)

Proyecto Capacitor basado en Mi Armario 5.3. Incluye la interfaz, armario local con IndexedDB, generador de outfits, editor táctil de máscaras, probador manual y conexión configurable a un backend CatVTON externo.

## Estado real

Este ZIP contiene el **proyecto fuente**, NO un APK compilado. No se ha probado en Android ni se ha validado la ejecución de los modelos IA dentro de WebView. El recorte y reconocimiento dependen de bibliotecas y pesos descargados de internet. El probador generativo NO funciona sin un backend compatible, que aún no está desplegado.

## Compilar con GitHub Actions (sin computadora)

1. Crea un repositorio **privado** en GitHub.
2. Sube **el contenido descomprimido** de esta carpeta a la raíz del repositorio, incluida la carpeta `.github/workflows` (en Android, activa mostrar archivos ocultos). No subas fotos personales.
3. En el repositorio entra a **Actions → Compilar APK de prueba → Run workflow**. El workflow también se ejecuta al hacer push a `main`.
4. Cuando termine correctamente, descarga el artefacto `mi-armario-debug-apk`, descomprímelo e instala `app-debug.apk` en Android.
5. La primera instalación puede solicitar permiso para instalar aplicaciones de esa fuente. Es un APK de **depuración**, no apto para publicar en Play Store.

El workflow usa herramientas y servicios de terceros (GitHub Actions, Android SDK, npm). La disponibilidad gratuita y el éxito de la compilación no están garantizados.

## Compilar en PC (alternativa)

Instala Node.js 22, JDK 17 y Android SDK; ejecuta `npm install`, `npx cap add android`, `npx cap sync android` y `cd android && ./gradlew assembleDebug`.

## Limitaciones y privacidad

- Los datos de la versión web alojada en Hugging Face **no se transfieren automáticamente** al APK: usan almacenamiento local diferente.
- Desinstalar la app o borrar sus datos puede eliminar prendas guardadas. No existe todavía copia de seguridad ni sincronización.
- Los modelos de IA local requieren descargas y pueden fallar por compatibilidad o memoria del teléfono.
- La función CatVTON necesita un servidor HTTPS propio; nunca introduzcas claves permanentes de proveedores directamente en una app distribuida.
- Para fotografías personales, utiliza únicamente un servidor de confianza y consulta su política de conservación.
