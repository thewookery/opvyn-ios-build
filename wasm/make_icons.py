#!/usr/bin/env python3
"""Generate OPVYN WASM icons without external dependencies."""
import struct, zlib, os, math

OUT = os.path.join(os.path.dirname(__file__), "web", "icons")
os.makedirs(OUT, exist_ok=True)


def png(path, size, draw):
    px = [[(0, 0, 0)] * size for _ in range(size)]
    draw(px, size)
    raw = b""
    for y in range(size):
        raw += b"\x00" + b"".join(bytes(tuple(max(0, min(255, int(c))) for c in p[:3])) for p in px[y])

    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)

    data = (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9))
            + chunk(b"IEND", b""))
    open(path, "wb").write(data)


def draw(px, S):
    cx = cy = S / 2
    r = S * 0.34
    for y in range(S):
        for x in range(S):
            d = math.hypot(x - cx, y - cy)
            if d < r:
                t = (x - cx) / r
                px[y][x] = (int(58 + 30 * t), int(168 - 60 * t), int(255 - 120 * t))
            elif d < r * 1.45:
                px[y][x] = (14, 20, 27)
            else:
                px[y][x] = (8, 9, 12)
    # waveform cut through the ring
    for x in range(int(cx - r), int(cx + r)):
        u = (x - (cx - r)) / (2 * r)
        amp = math.sin(u * math.pi * 3) * S * 0.055
        y = int(cy + amp)
        for dy in range(-2, 3):
            if 0 <= y + dy < S:
                px[y + dy][x] = (8, 9, 12)


for s in (180, 192, 512):
    png(os.path.join(OUT, f"icon-{s}.png"), s, draw)
print("icons:", os.listdir(OUT))
