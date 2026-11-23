package mx.miarmario.personal;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mediapipe.framework.image.BitmapImageBuilder;
import com.google.mediapipe.framework.image.ByteBufferExtractor;
import com.google.mediapipe.framework.image.MPImage;
import com.google.mediapipe.tasks.components.containers.NormalizedKeypoint;
import com.google.mediapipe.tasks.core.BaseOptions;
import com.google.mediapipe.tasks.vision.imagesegmenter.ImageSegmenter;
import com.google.mediapipe.tasks.vision.interactivesegmenter.InteractiveSegmenter;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;

@CapacitorPlugin(name = "WardrobeVision")
public class WardrobeVision extends Plugin {
    private BaseOptions model(String asset) {
        return BaseOptions.builder().setModelAssetPath(asset).build();
    }

    private JSObject packConfidence(MPImage mask) {
        int width = mask.getWidth(), height = mask.getHeight();
        float scale = Math.min(1f, 384f / Math.max(width, height));
        int w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
        var bytes = ByteBufferExtractor.extract(mask).order(ByteOrder.nativeOrder());
        var floats = bytes.asFloatBuffer();
        byte[] samples = new byte[w * h];
        for (int y = 0; y < h; y++) {
            int row = (int)((y + .5f) * height / h) * width;
            for (int x = 0; x < w; x++) {
                int index = row + (int)((x + .5f) * width / w);
                samples[y * w + x] = (byte)Math.round(255 * floats.get(index));
            }
        }
        return samplesResult(w, h, samples);
    }

    private JSObject samplesResult(int w, int h, byte[] samples) {
        JSObject result = new JSObject();
        result.put("w", w);
        result.put("h", h);
        result.put("data", Base64.encodeToString(samples, Base64.NO_WRAP));
        return result;
    }

    private JSObject select(MPImage image, float x, float y) {
        var options = InteractiveSegmenter.InteractiveSegmenterOptions.builder()
            .setBaseOptions(model("magic_touch.tflite")).setOutputConfidenceMasks(true).build();
        try (var segmenter = InteractiveSegmenter.createFromOptions(getContext(), options)) {
            var roi = InteractiveSegmenter.RegionOfInterest.create(NormalizedKeypoint.create(x, y));
            var masks = segmenter.segment(image, roi).confidenceMasks().get();
            try {
                return packConfidence(masks.get(masks.size() - 1));
            } finally {
                masks.forEach(MPImage::close);
            }
        }
    }

    private JSObject classify(MPImage image) {
        var options = ImageSegmenter.ImageSegmenterOptions.builder()
            .setBaseOptions(model("selfie_multiclass.tflite"))
            .setOutputConfidenceMasks(true).setOutputCategoryMask(false).build();
        float scale = Math.min(1f, 384f / Math.max(image.getWidth(), image.getHeight()));
        int width = Math.max(1, Math.round(image.getWidth() * scale));
        int height = Math.max(1, Math.round(image.getHeight() * scale));
        var output = ImageSegmenter.SegmentationOptions.builder()
            .setOutputWidth(width).setOutputHeight(height).build();
        try (var segmenter = ImageSegmenter.createFromOptions(getContext(), options)) {
            var masks = segmenter.segment(image, output).confidenceMasks().get();
            try {
                if (masks.size() != 6) throw new IllegalStateException("Se esperaban seis clases.");
                FloatBuffer[] channels = new FloatBuffer[masks.size()];
                for (int i = 0; i < channels.length; i++) {
                    channels[i] = ByteBufferExtractor.extract(masks.get(i)).order(ByteOrder.nativeOrder()).asFloatBuffer();
                }
                byte[] classes = new byte[width * height];
                for (int i = 0; i < classes.length; i++) {
                    int best = 0;
                    float max = channels[0].get(i);
                    for (int c = 1; c < channels.length; c++) {
                        float value = channels[c].get(i);
                        if (value > max) { best = c; max = value; }
                    }
                    classes[i] = (byte)best;
                }
                return samplesResult(width, height, classes);
            } finally {
                masks.forEach(MPImage::close);
            }
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
            MPImage image = new BitmapImageBuilder(bitmap).build();
            try {
                JSObject result = new JSObject();
                if ("select".equals(mode)) {
                    double x = call.getDouble("x", -1.0), y = call.getDouble("y", -1.0);
                    if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) throw new IllegalArgumentException();
                    result.put("subject", select(image, (float)x, (float)y));
                    if (call.getBoolean("worn", false)) result.put("classes", classify(image));
                } else if ("person".equals(mode)) {
                    result.put("classes", classify(image));
                } else throw new IllegalArgumentException();
                call.resolve(result);
            } finally {
                image.close();
            }
        } catch (Exception e) {
            Log.e("WardrobeVision", "Fallo en modo " + mode, e);
            call.reject("No se pudo analizar esta foto en el dispositivo.", e);
        } finally {
            if (bitmap != null) bitmap.recycle();
        }
    }
}
