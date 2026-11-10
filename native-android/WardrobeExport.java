package mx.miarmario.personal;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.io.OutputStream;

@CapacitorPlugin(name = "WardrobeExport")
public class WardrobeExport extends Plugin {
    @PluginMethod
    public void savePng(PluginCall call) {
        Intent picker = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        picker.addCategory(Intent.CATEGORY_OPENABLE);
        picker.setType("image/png");
        picker.putExtra(Intent.EXTRA_TITLE, "mi-armario-probador.png");
        startActivityForResult(call, picker, "finishSave");
    }

    @ActivityCallback
    private void finishSave(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK) {
            JSObject response = new JSObject();
            response.put("saved", false);
            call.resolve(response);
            return;
        }
        Uri destination = result.getData() == null ? null : result.getData().getData();
        String png = call.getString("data");
        if (destination == null || png == null) {
            call.reject("No se encontró el archivo de destino.");
            return;
        }
        try (OutputStream stream = getContext().getContentResolver().openOutputStream(destination, "w")) {
            if (stream == null) throw new IOException("Archivo inaccesible");
            stream.write(Base64.decode(png, Base64.DEFAULT));
        } catch (IOException | IllegalArgumentException | SecurityException error) {
            call.reject("No se pudo guardar la imagen.", error);
            return;
        }
        JSObject response = new JSObject();
        response.put("saved", true);
        call.resolve(response);
    }
}
