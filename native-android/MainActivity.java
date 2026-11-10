package mx.miarmario.personal;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WardrobeExport.class);
        super.onCreate(savedInstanceState);
    }
}
