"""Serve the local screenshot gallery without caching changing evidence."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class GalleryHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    directory = Path(__file__).resolve().parent.parent
    server = ThreadingHTTPServer(
        ("127.0.0.1", 4381), partial(GalleryHandler, directory=str(directory))
    )
    print("Screenshot gallery: http://127.0.0.1:4381/admin-form-style-gallery/", flush=True)
    server.serve_forever()
