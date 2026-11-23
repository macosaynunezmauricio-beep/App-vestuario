package mx.miarmario.personal;

import android.app.Activity;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.UUID;

@CapacitorPlugin(name = "WardrobeExport")
public class WardrobeExport extends Plugin {
    private static final int CHUNK = 96 * 1024;
    private static final long DAY = 86400000L;

    private File directory() { return new File(getContext().getCacheDir(), "wardrobe-export"); }

    private File fileFor(PluginCall call) throws IOException {
        String token = call.getString("token", "");
        if (!token.matches("[a-f0-9-]{36}\\.(png|json)")) throw new IOException("Archivo inválido");
        File file = new File(directory(), token);
        if (!file.isFile()) throw new IOException("Archivo temporal no disponible");
        return file;
    }

    @PluginMethod
    public void begin(PluginCall call) {
        try {
            File dir = directory();
            if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("No hay espacio temporal");
            File[] previous = dir.listFiles();
            if (previous != null) for (File old : previous) {
                if (System.currentTimeMillis() - old.lastModified() > DAY) old.delete();
            }
            String token = UUID.randomUUID() + ("backup".equals(call.getString("kind")) ? ".json" : ".png");
            if (!new File(dir, token).createNewFile()) throw new IOException("No se pudo preparar el archivo");
            JSObject result = new JSObject(); result.put("token", token); call.resolve(result);
        } catch (Exception e) { call.reject("No se pudo preparar el archivo en el teléfono.", e); }
    }

    @PluginMethod
    public void append(PluginCall call) {
        try {
            File file = fileFor(call);
            String encoded = call.getString("data", "");
            if (encoded.length() > CHUNK * 4 / 3 || file.length() != call.getInt("offset", -1))
                throw new IOException("Bloque incompleto");
            byte[] data = Base64.decode(encoded, Base64.NO_WRAP);
            long limit = file.getName().endsWith(".png") ? 8L << 20 : 256L << 20;
            if (file.length() + data.length > limit) throw new IOException("El archivo supera el límite de exportación");
            try (OutputStream out = new FileOutputStream(file, true)) { out.write(data); }
            call.resolve();
        } catch (Exception e) { call.reject("No se pudo preparar el archivo. " + e.getMessage(), e); }
    }

    @PluginMethod
    public void discard(PluginCall call) {
        try { fileFor(call).delete(); } catch (IOException ignored) { }
        call.resolve();
    }

    private static void copy(File file, ContentResolver resolver, Uri destination) throws IOException {
        try (FileInputStream in = new FileInputStream(file);
             OutputStream out = resolver.openOutputStream(destination, "wt")) {
            if (out == null) throw new IOException("Destino inaccesible");
            byte[] buffer = new byte[32768];
            int count;
            while ((count = in.read(buffer)) != -1) out.write(buffer, 0, count);
        }
    }

    private Uri saveInGallery(File file, String name) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, name);
        values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
        values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Mi Armario");
        values.put(MediaStore.Images.Media.IS_PENDING, 1);
        Uri uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
        if (uri == null) throw new IOException("Galería inaccesible");
        boolean published = false;
        try {
            copy(file, resolver, uri);
            values.clear();
            values.put(MediaStore.Images.Media.IS_PENDING, 0);
            if (resolver.update(uri, values, null, null) != 1) throw new IOException("No se pudo publicar la imagen");
            published = true;
            return uri;
        } finally { if (!published) resolver.delete(uri, null, null); }
    }

    @PluginMethod
    public void finish(PluginCall call) {
        try {
            File file = fileFor(call);
            if (file.length() == 0 || file.length() != call.getInt("size", -1)) throw new IOException("Archivo incompleto");
            boolean png = file.getName().endsWith(".png");
            if (png) {
                BitmapFactory.Options options = new BitmapFactory.Options(); options.inJustDecodeBounds = true;
                BitmapFactory.decodeFile(file.getPath(), options);
                if (!"image/png".equals(options.outMimeType) || options.outWidth < 1 || options.outHeight < 1)
                    throw new IOException("PNG inválido");
            }
            String mime = png ? "image/png" : "application/json";
            String name = png ? "Mi-Armario-" + file.getName() : "mi-armario-respaldo.json";
            if (png && "share".equals(call.getString("mode"))) {
                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
                Intent send = new Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM, uri);
                send.setClipData(ClipData.newRawUri("Mi Armario", uri));
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                getActivity().runOnUiThread(() -> {
                    try { getActivity().startActivity(Intent.createChooser(send, "Compartir conjunto")); call.resolve(); }
                    catch (Exception e) { call.reject("No se pudo abrir el menú para compartir.", e); }
                });
            } else if (png && Build.VERSION.SDK_INT >= 29) {
                Uri uri = saveInGallery(file, name);
                file.delete();
                JSObject result = new JSObject(); result.put("saved", true); result.put("gallery", true);
                result.put("uri", uri.toString()); call.resolve(result);
            } else {
                // Only a short file token survives the picker and Activity recreation.
                Intent picker = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                    .setType(mime).putExtra(Intent.EXTRA_TITLE, name);
                getActivity().runOnUiThread(() -> {
                    try { startActivityForResult(call, picker, "finishSave"); }
                    catch (Exception e) { call.reject("No se pudo abrir el selector de archivos.", e); }
                });
            }
        } catch (Exception e) { call.reject("No se pudo exportar el archivo. " + e.getMessage(), e); }
    }

    @ActivityCallback
    private void finishSave(PluginCall call, ActivityResult result) {
        if (call == null) return;
        execute(() -> {
            File file = null;
            try {
                file = fileFor(call);
                boolean saved = result.getResultCode() == Activity.RESULT_OK;
                if (saved) {
                    Uri uri = result.getData() == null ? null : result.getData().getData();
                    if (uri == null) throw new IOException("Destino inaccesible");
                    copy(file, getContext().getContentResolver(), uri);
                }
                JSObject response = new JSObject(); response.put("saved", saved); call.resolve(response);
            } catch (Exception e) { call.reject("No se pudo escribir el archivo.", e); }
            finally { if (file != null) file.delete(); }
        });
    }
}
