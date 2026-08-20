package com.dcalzona.dragontower;

import android.os.Bundle;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Il gioco occupa tutto lo schermo: barra di stato e barra di navigazione
 * vengono nascoste, e il disegno arriva fino ai bordi, foro della fotocamera
 * compreso. L'interfaccia non ci finisce sotto perché si tiene dentro i margini
 * di sicurezza, che la pagina legge da CSS con env(safe-area-inset-*).
 *
 * Le barre restano richiamabili con una strisciata dal bordo, poi tornano a
 * nascondersi da sole: per questo l'operazione viene ripetuta quando la
 * finestra riprende il fuoco.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        aSchermoIntero();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            aSchermoIntero();
        }
    }

    private void aSchermoIntero() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            controller.hide(WindowInsetsCompat.Type.systemBars());
            controller.setSystemBarsBehavior(
                    WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        }
    }
}
