# Dragon Tower

Action-roguelike gotico a 30 piani, ispirato ai dungeon crawler per console portatili
dei primi anni '90. Scendi di piano in piano, raccogli i Frammenti di Cristallo,
trasformati in drago e abbatti i tre guardiani che sbarrano le scale.

Scritto in JavaScript puro: **nessuna dipendenza, nessun passo di compilazione**.
Moduli ES nativi e Canvas 2D. Grafica e musica sono generate dal codice — nel
progetto non c'è nemmeno un file di immagine o di audio.

## Come giocarci

```bash
python dragon-tower/serve.py
```

Poi apri <http://localhost:5180>.

Il server serve i file disabilitando la cache del browser: con il normale
`python -m http.server` le modifiche ai moduli ES non si vedono al ricaricamento.

## Comandi

| Azione | Tastiera | Controller |
| --- | --- | --- |
| Muoversi | WASD o frecce | Stick sinistro o D-Pad |
| Attaccare | Spazio | X o ◻ |
| Bere una pozione | Q | ◯ |
| Trasformarsi in drago | E | △ |
| Pausa | P o Esc | OPTIONS |
| Audio | M | M |

## Com'è fatto

| File | Ruolo |
| --- | --- |
| `src/main.js` | Ciclo di gioco, stati dell'applicazione, telecamera |
| `src/game.js` | Regole: movimento, combattimento, boss, esplorazione, statistiche |
| `src/dungeon.js` | Generazione procedurale dei piani e delle arene dei boss |
| `src/entities.js` | Giocatore, mostri, boss, proiettili, oggetti |
| `src/render.js` | Disegno del mondo e delle creature, tutto vettoriale |
| `src/hud.js` | Interfaccia, notifiche, schermata di fine partita |
| `src/audio.js` | Tre colonne sonore chiptune e gli effetti, sintetizzati dal vivo |
| `src/input.js` | Tastiera e gamepad, con lettura analogica dello stick |
| `src/menu.js` | Schermata iniziale: comandi, difficoltà, audio |

## Qualche dettaglio

- **Campo visivo** a raycast, con i muri che delimitano le stanze illuminate.
- **Boss ogni 10 piani**, con cariche telegrafate e arene garantite di almeno 9×7 caselle.
- **Musica** in minore armonica, un brano diverso ogni dieci piani, che cambia in dissolvenza.
- **Boost di velocità** man mano che scopri la mappa, per rendere meno noioso il ritorno alle scale.

## Licenza

Progetto personale, a scopo di studio. Non contiene codice, grafica, suoni o
marchi di terzi.
