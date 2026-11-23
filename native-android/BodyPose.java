package mx.miarmario.personal;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mediapipe.framework.image.BitmapImageBuilder;
import com.google.mediapipe.framework.image.ByteBufferExtractor;
import java.nio.ByteOrder;
import com.google.mediapipe.framework.image.MPImage;
import com.google.mediapipe.tasks.core.BaseOptions;
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker;
import org.json.JSONArray;

@CapacitorPlugin(name = "BodyPose")
public class BodyPose extends Plugin {
    private JSObject compactSilhouette(MPImage mask) {
        int width = mask.getWidth(), height = mask.getHeight();
        float scale = 160f / Math.max(width, height);
        int w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
        var confidence = ByteBufferExtractor.extract(mask).order(ByteOrder.nativeOrder()).asFloatBuffer();
        byte[] samples = new byte[w * h];
        for (int y = 0; y < h; y++) {
            int row = Math.min(height - 1, (int)((y + .5f) * height / h)) * width;
            for (int x = 0; x < w; x++) {
                int col = Math.min(width - 1, (int)((x + .5f) * width / w));
                samples[y * w + x] = (byte)(confidence.get(row + col) >= .60f ? 1 : 0);
            }
        }
        JSObject result = new JSObject();
        result.put("w", w);
        result.put("h", h);
        result.put("data", Base64.encodeToString(samples, Base64.NO_WRAP));
        return result;
    }

    @PluginMethod
    public void detect(PluginCall call) {
        String encoded = call.getString("image");
        if (encoded == null || encoded.length() > 5000000) {
            call.reject("La fotografía supera el tamaño admitido.");
            return;
        }
        Bitmap bitmap = null;
        try {
            byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
            bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            if (bitmap == null) {
                call.reject("No se pudo leer la foto.");
                return;
            }
            var options = PoseLandmarker.PoseLandmarkerOptions.builder()
                .setOutputSegmentationMasks(true)
                .setBaseOptions(BaseOptions.builder().setModelAssetPath("pose_landmarker_lite.task").build())
                .build();
            MPImage image = new BitmapImageBuilder(bitmap).build();
            try (PoseLandmarker model = PoseLandmarker.createFromOptions(getContext(), options)) {
                var detection = model.detect(image);
                var poses = detection.landmarks();
                JSONArray points = new JSONArray();
                if (!poses.isEmpty()) {
                    for (var point : poses.get(0)) {
                        JSObject entry = new JSObject();
                        entry.put("x", point.x());
                        entry.put("y", point.y());
                        entry.put("visibility", point.visibility().orElse(0f));
                        points.put(entry);
                    }
                }
                JSObject result = new JSObject();
                result.put("points", points);
                detection.segmentationMasks().ifPresent(masks -> {
                    try {
                        if (!masks.isEmpty()) result.put("outline", compactSilhouette(masks.get(0)));
                    } finally {
                        masks.forEach(MPImage::close);
                    }
                });
                call.resolve(result);
            } finally {
                image.close();
            }
        } catch (Exception error) {
            call.reject("No se pudo analizar la postura.", error);
        } finally {
            if (bitmap != null) bitmap.recycle();
        }
    }
}
