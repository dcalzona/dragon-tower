"""Server di sviluppo per Dragon Tower.

Identico a `python -m http.server`, ma dice al browser di non mettere nulla in
cache. Senza questo, dopo una modifica ai sorgenti il browser continua a servire
i vecchi moduli ES anche dopo un ricaricamento, e sembra che le modifiche non
abbiano avuto effetto.

    python serve.py [porta]
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Silenzia il log per ogni richiesta: interessano solo gli errori.
        if not args or not str(args[0]).startswith(("GET", "HEAD")):
            super().log_message(fmt, *args)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5180
    root = Path(__file__).resolve().parent
    handler = partial(NoCacheHandler, directory=str(root))
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    print(f"Dragon Tower su http://localhost:{port}  (cache disattivata)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer fermato.")


if __name__ == "__main__":
    main()
