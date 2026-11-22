#!/usr/bin/env python3
"""Serve the OPVYN wasm build on the LAN for iPhone testing."""
import http.server, socket, socketserver, os

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(os.path.join(ROOT, "web"))
PORT = 8790


def ips():
    out = set()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80)); out.add(s.getsockname()[0]); s.close()
    except OSError:
        pass
    try:
        for i in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            out.add(i[4][0])
    except OSError:
        pass
    return sorted(i for i in out if not i.startswith("127."))


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      ".wasm": "application/wasm", ".webmanifest": "application/manifest+json"}


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
    print("OPVYN WASM — serving", os.getcwd())
    print(f"  local:  http://localhost:{PORT}/")
    for ip in ips():
        print(f"  iPhone: http://{ip}:{PORT}/")
    print("\nOpen the iPhone URL in Safari, tap TAP TO START, then Share -> Add to Home Screen.")
    print("Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
