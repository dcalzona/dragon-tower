"""Genera l'icona e la schermata d'avvio dell'app Android.

Disegna un Frammento di Cristallo — l'oggetto che nel gioco carica la
trasformazione in drago — su fondo scuro, con un alone caldo alle spalle.
Forme semplici e contrastate, perche' l'icona deve restare leggibile anche
a 48 pixel nel cassetto delle applicazioni.

    python tools/genera_icone.py

Produce assets/icon.png e assets/splash.png, da cui @capacitor/assets ricava
tutte le densita' necessarie.
"""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

FONDO = (8, 11, 18)
TEAL = (78, 205, 196)
TEAL_CHIARO = (168, 240, 234)
ARANCIO = (255, 159, 69)
ARANCIO_CUPO = (255, 94, 58)
ORO = (255, 212, 59)
PIETRA = (30, 40, 66)


def alone(dimensione, centro, raggio, colore, intensita):
    """Bagliore morbido da sommare al fondo: un cerchio pieno molto sfocato."""
    strato = Image.new("RGB", (dimensione, dimensione), (0, 0, 0))
    disegno = ImageDraw.Draw(strato)
    cx, cy = centro
    disegno.ellipse([cx - raggio, cy - raggio, cx + raggio, cy + raggio], fill=colore)
    strato = strato.filter(ImageFilter.GaussianBlur(raggio * 0.55))
    return Image.eval(strato, lambda v: int(v * intensita))


def cristallo(draw, cx, cy, mezza_larghezza, mezza_altezza):
    """Rombo a due facce: quella di sinistra piu' chiara, per dare volume."""
    punte = [
        (cx, cy - mezza_altezza),
        (cx + mezza_larghezza, cy),
        (cx, cy + mezza_altezza),
        (cx - mezza_larghezza, cy),
    ]
    draw.polygon(punte, fill=TEAL)
    draw.polygon(
        [(cx, cy - mezza_altezza), (cx, cy + mezza_altezza), (cx - mezza_larghezza, cy)],
        fill=TEAL_CHIARO,
    )
    draw.line(punte + [punte[0]], fill=TEAL_CHIARO, width=max(2, mezza_larghezza // 13))


def disegna(dimensione, scala_cristallo, con_torre):
    img = Image.new("RGB", (dimensione, dimensione), FONDO)
    cx = dimensione // 2
    cy = dimensione // 2

    # Il fuoco del drago dietro al cristallo: un nucleo acceso che sfuma.
    for raggio, colore, intensita in (
        (int(dimensione * 0.44), ARANCIO_CUPO, 0.40),
        (int(dimensione * 0.22), ARANCIO, 0.85),
    ):
        img = ImageChops.add(img, alone(dimensione, (cx, cy), raggio, colore, intensita))

    draw = ImageDraw.Draw(img)

    if con_torre:
        # Tre blocchi che accennano alla torre, sotto il cristallo.
        larghezza = int(dimensione * 0.46)
        altezza = int(dimensione * 0.052)
        base_y = int(dimensione * 0.78)
        for i in range(3):
            w = larghezza - i * int(dimensione * 0.07)
            y = base_y - i * int(altezza * 1.45)
            draw.rounded_rectangle(
                [cx - w // 2, y, cx + w // 2, y + altezza],
                radius=altezza // 3,
                fill=PIETRA,
            )

    mezza_altezza = int(dimensione * scala_cristallo)
    cristallo(draw, cx, cy, int(mezza_altezza * 0.70), mezza_altezza)

    # Scintilla dorata sulla punta
    r = max(3, dimensione // 110)
    draw.ellipse([cx - r, cy - mezza_altezza - r, cx + r, cy - mezza_altezza + r], fill=ORO)
    return img


def main():
    radice = Path(__file__).resolve().parent.parent
    out = radice / "assets"
    out.mkdir(exist_ok=True)

    icona = disegna(1024, 0.33, con_torre=False)
    icona.save(out / "icon.png")

    # La schermata d'avvio viene ritagliata al centro su schermi di ogni forma:
    # il soggetto resta piccolo e centrato per non finire tagliato.
    splash = disegna(2732, 0.11, con_torre=False)
    splash.save(out / "splash.png")
    splash.save(out / "splash-dark.png")

    print(f"icon.png    {icona.size[0]}x{icona.size[1]}")
    print(f"splash.png  {splash.size[0]}x{splash.size[1]}")


if __name__ == "__main__":
    main()
