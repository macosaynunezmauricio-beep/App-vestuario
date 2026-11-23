package mx.miarmario.personal;

import android.content.res.AssetFileDescriptor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.FileInputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.nio.MappedByteBuffer;
import java.nio.channels.FileChannel;
import org.tensorflow.lite.Interpreter;

@CapacitorPlugin(name = "WardrobeVision")
public class WardrobeVision extends Plugin {
    private MappedByteBuffer mapModel(String name) throws IOException {
        try (AssetFileDescriptor asset = getContext().getAssets().openFd(name);
             FileInputStream input = asset.createInputStream()) {
            return input.getChannel().map(FileChannel.MapMode.READ_ONLY, asset.getStartOffset(), asset.getDeclaredLength());
        }
    }

    private ByteBuffer inputTensor(Bitmap photo, int size, boolean interactive, double tapX, double tapY) {
        Bitmap square = Bitmap.createScaledBitmap(photo, size, size, true);
        int[] rgb = new int[size * size];
        try {
            square.getPixels(rgb, 0, size, 0, 0, size, size);
        } finally {
            if (square != photo) square.recycle();
        }
        int channels = interactive ? 4 : 3;
        ByteBuffer buffer = ByteBuffer.allocateDirect(size * size * channels * 4).order(ByteOrder.nativeOrder());
        FloatBuffer floats = buffer.asFloatBuffer();
        // Model metadata specifies [0,1] RGB + tap for MagicTouch, [-1,1] RGB for Selfie.
        float mean = interactive ? 0f : 127.5f, std = interactive ? 255f : 127.5f;
        double radius = Math.max(1, Math.round(Math.max(photo.getWidth(), photo.getHeight()) / (double)size));
        int tapCol = Math.min(size - 1, (int)(tapX * size)), tapRow = Math.min(size - 1, (int)(tapY * size));
        for (int i = 0; i < rgb.length; i++) {
            int pixel = rgb[i];
            floats.put((((pixel >> 16) & 255) - mean) / std);
            floats.put((((pixel >> 8) & 255) - mean) / std);
            floats.put(((pixel & 255) - mean) / std);
            if (interactive) {
                int x = i % size, y = i / size;
                double dx = ((x + .5) / size - tapX) * photo.getWidth();
                double dy = ((y + .5) / size - tapY) * photo.getHeight();
                boolean seed = (x == tapCol && y == tapRow) || dx * dx + dy * dy <= radius * radius;
                floats.put(seed ? 1f : 0f);
            }
        }
        return buffer;
    }

    private JSObject mask(FloatBuffer pixels, int gridW, int gridH, int channels, int w, int h) {
        byte[] data = new byte[w * h];
        for (int y = 0; y < h; y++) {
            float v = Math.max(0, (y + .5f) * gridH / h - .5f);
            int y0 = (int)v, y1 = Math.min(gridH - 1, y0 + 1);
            float fy = v - y0;
            for (int x = 0; x < w; x++) {
                float u = Math.max(0, (x + .5f) * gridW / w - .5f);
                int x0 = (int)u, x1 = Math.min(gridW - 1, x0 + 1);
                float fx = u - x0, maximum = Float.NEGATIVE_INFINITY;
                int label = 0;
                for (int c = 0; c < channels; c++) {
                    float a = pixels.get((y0 * gridW + x0) * channels + c);
                    float b = pixels.get((y0 * gridW + x1) * channels + c);
                    float d = pixels.get((y1 * gridW + x0) * channels + c);
                    float e = pixels.get((y1 * gridW + x1) * channels + c);
                    float top = a + fx * (b - a), bottom = d + fx * (e - d);
                    float score = top + fy * (bottom - top);
                    if (score > maximum) { maximum = score; label = c; }
                }
                data[y*w+x] = channels == 1 ? (byte)Math.round(255f * Math.max(0f, Math.min(1f, maximum))) : (byte)label;
            }
        }
        JSObject result = new JSObject();
        result.put("w", w);
        result.put("h", h);
        result.put("data", Base64.encodeToString(data, Base64.NO_WRAP));
        return result;
    }

    private JSObject infer(Bitmap photo, boolean interactive, double x, double y) throws IOException {
        String asset = interactive ? "magic_touch.tflite" : "selfie_multiclass.tflite";
        int size = interactive ? 512 : 256;
        float scale = Math.min(1f, 384f / Math.max(photo.getWidth(), photo.getHeight()));
        int w = Math.max(1, Math.round(photo.getWidth() * scale)), h = Math.max(1, Math.round(photo.getHeight() * scale));
        // CPU-only inference and mask conversion also work on devices without compute shaders.
        try (Interpreter interpreter = new Interpreter(mapModel(asset), new Interpreter.Options().setNumThreads(2))) {
            int[] shape = interpreter.getOutputTensor(0).shape();
            if (shape.length != 4 || shape[3] != (interactive ? 1 : 6)) throw new IllegalStateException("Modelo incompatible.");
            ByteBuffer output = ByteBuffer.allocateDirect(interpreter.getOutputTensor(0).numBytes()).order(ByteOrder.nativeOrder());
            interpreter.run(inputTensor(photo, size, interactive, x, y), output);
            output.rewind();
            return mask(output.asFloatBuffer(), shape[2], shape[1], shape[3], w, h);
        }
    }

    @PluginMethod
    public void analyze(PluginCall call) {
        String encoded = call.getString("image"), mode = call.getString("mode", "");
        Bitmap bitmap = null;
        try {
            if (encoded == null || encoded.length() > 6000000) throw new IllegalArgumentException();
            byte[] data = Base64.decode(encoded, Base64.DEFAULT);
            BitmapFactory.Options opts = new BitmapFactory.Options();
            opts.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(data, 0, data.length, opts);
            if (opts.outWidth < 1 || opts.outHeight < 1) throw new IllegalArgumentException();
            while (Math.max(opts.outWidth, opts.outHeight) / Math.max(opts.inSampleSize, 1) > 1024)
                opts.inSampleSize = 2 * Math.max(1, opts.inSampleSize);
            opts.inJustDecodeBounds = false;
            bitmap = BitmapFactory.decodeByteArray(data, 0, data.length, opts);
            if (bitmap == null) throw new IllegalArgumentException();
            JSObject result = new JSObject();
            if ("select".equals(mode)) {
                double x = call.getDouble("x", -1.0), y = call.getDouble("y", -1.0);
                if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) throw new IllegalArgumentException();
                result.put("subject", infer(bitmap, true, x, y));
                if (call.getBoolean("worn", false)) result.put("classes", infer(bitmap, false, 0, 0));
            } else if ("person".equals(mode)) {
                result.put("classes", infer(bitmap, false, 0, 0));
            } else throw new IllegalArgumentException();
            call.resolve(result);
        } catch (Exception e) {
            Log.e("WardrobeVision", "Fallo en modo " + mode, e);
            call.reject("No se pudo analizar esta foto en el dispositivo.", e);
        } finally {
            if (bitmap != null) bitmap.recycle();
        }
    }
}
