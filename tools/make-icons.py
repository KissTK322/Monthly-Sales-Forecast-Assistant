#!/usr/bin/env python3
"""
Generate the five PWA icon PNGs for Monthly Sales Forecast Assistant.

Standard library only (zlib, struct). No Pillow, no dependency.
Run:  python3 tools/make-icons.py        # writes ../icons/*.png relative to repo root

The mark is generic on purpose: a roof chevron over three rising bars.
It carries the project's brand palette but no element of the client's logo,
so it can be committed to a public repository before prd.md S13 Q6
(permission to use the client's logo and company name) is answered.

Palette (see CLAUDE.md S5 / prd.md theme tokens):
  roof   #3E6B2C   bar1 #B8667A   bar2 #6F86E0   bar3 #9CC57A   base #8E8C93
"""

import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "icons")

ROOF = (0x3E, 0x6B, 0x2C)
BAR1 = (0xB8, 0x66, 0x7A)
BAR2 = (0x6F, 0x86, 0xE0)
BAR3 = (0x9C, 0xC5, 0x7A)
BASE = (0x8E, 0x8C, 0x93)
WHITE = (0xFF, 0xFF, 0xFF)

SS = 4  # supersampling factor for anti-aliasing


def write_png(path, w, h, rgba_rows):
    """rgba_rows: list of h bytearrays, each 4*w bytes."""
    raw = b"".join(b"\x00" + bytes(row) for row in rgba_rows)

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


class Canvas:
    """Supersampled RGBA canvas; shapes are drawn in unit coordinates (0..1)."""

    def __init__(self, size):
        self.n = size * SS
        self.size = size
        self.px = [[(0, 0, 0, 0)] * self.n for _ in range(self.n)]

    def _set(self, x, y, colour):
        if 0 <= x < self.n and 0 <= y < self.n:
            self.px[y][x] = (colour[0], colour[1], colour[2], 255)

    def fill_all(self, colour):
        for y in range(self.n):
            self.px[y] = [(colour[0], colour[1], colour[2], 255)] * self.n

    def rounded_rect(self, x0, y0, x1, y1, r, colour):
        n = self.n
        X0, Y0, X1, Y1 = (int(v * n) for v in (x0, y0, x1, y1))
        R = int(r * n)
        for y in range(Y0, Y1):
            for x in range(X0, X1):
                dx = dy = 0
                if x < X0 + R:
                    dx = X0 + R - x
                elif x >= X1 - R:
                    dx = x - (X1 - R - 1)
                if y < Y0 + R:
                    dy = Y0 + R - y
                elif y >= Y1 - R:
                    dy = y - (Y1 - R - 1)
                if dx and dy and dx * dx + dy * dy > R * R:
                    continue
                self._set(x, y, colour)

    def circle(self, cx, cy, r, colour):
        n = self.n
        CX, CY, R = int(cx * n), int(cy * n), int(r * n)
        for y in range(CY - R, CY + R + 1):
            for x in range(CX - R, CX + R + 1):
                if (x - CX) ** 2 + (y - CY) ** 2 <= R * R:
                    self._set(x, y, colour)

    def chevron(self, cx, apex_y, half_w, drop, thick, colour):
        """Roof shape: two strokes from the apex down-left and down-right."""
        n = self.n
        steps = int(half_w * n * 2)
        for i in range(steps + 1):
            t = i / steps
            dx = half_w * t
            dy = drop * t
            for sign in (-1, 1):
                x = (cx + sign * dx) * n
                y = (apex_y + dy) * n
                self._disc(x, y, thick * n / 2, colour)

    def _disc(self, x, y, r, colour):
        r = max(r, 1)
        for yy in range(int(y - r), int(y + r) + 1):
            for xx in range(int(x - r), int(x + r) + 1):
                if (xx - x) ** 2 + (yy - y) ** 2 <= r * r:
                    self._set(xx, yy, colour)

    def downsample(self):
        """Box-filter SS x SS back to size x size, over a transparent ground."""
        rows = []
        for y in range(self.size):
            row = bytearray()
            for x in range(self.size):
                r = g = b = a = 0
                for sy in range(SS):
                    for sx in range(SS):
                        p = self.px[y * SS + sy][x * SS + sx]
                        r += p[0] * p[3]
                        g += p[1] * p[3]
                        b += p[2] * p[3]
                        a += p[3]
                if a:
                    row += bytes((r // a, g // a, b // a, a // (SS * SS)))
                else:
                    row += b"\x00\x00\x00\x00"
            rows.append(row)
        return rows


def draw_mark(c, scale=1.0, cx=0.5, cy=0.5):
    """Roof chevron over three rising bars, scaled about (cx, cy)."""

    def sx(v):
        return cx + (v - 0.5) * scale

    def sy(v):
        return cy + (v - 0.5) * scale

    # roof
    c.chevron(cx, sy(0.20), 0.30 * scale, 0.22 * scale, 0.085 * scale, ROOF)

    # bars, rising left to right
    base_y = sy(0.78)
    bars = [(0.30, 0.135, BAR1), (0.445, 0.205, BAR2), (0.59, 0.275, BAR3)]
    for bx, bh, col in bars:
        c.rounded_rect(
            sx(bx), base_y - bh * scale, sx(bx) + 0.11 * scale, base_y,
            0.018 * scale, col,
        )

    # base line
    c.rounded_rect(sx(0.25), base_y, sx(0.75), base_y + 0.032 * scale, 0.016 * scale, BASE)


def build():
    os.makedirs(OUT, exist_ok=True)

    # icon-512: white rounded tile, mark at full size
    c = Canvas(512)
    c.rounded_rect(0.0, 0.0, 1.0, 1.0, 0.18, WHITE)
    draw_mark(c, 1.0)
    write_png(os.path.join(OUT, "icon-512.png"), 512, 512, c.downsample())

    # icon-maskable-512: opaque edge to edge (maskable icons must not have
    # transparent corners: a square or squircle launcher mask would show
    # them), mark at 62% so it survives any mask shape
    c = Canvas(512)
    c.fill_all(WHITE)
    draw_mark(c, 0.62)
    write_png(os.path.join(OUT, "icon-maskable-512.png"), 512, 512, c.downsample())

    # icon-192
    c = Canvas(192)
    c.rounded_rect(0.0, 0.0, 1.0, 1.0, 0.18, WHITE)
    draw_mark(c, 1.0)
    write_png(os.path.join(OUT, "icon-192.png"), 192, 192, c.downsample())

    # apple-touch-icon: iOS masks it itself, so the tile is square and opaque
    c = Canvas(180)
    c.fill_all(WHITE)
    draw_mark(c, 0.88)
    write_png(os.path.join(OUT, "apple-touch-icon.png"), 180, 180, c.downsample())

    # favicon-32: no tile, mark only, so it reads on any tab colour
    c = Canvas(32)
    draw_mark(c, 1.0)
    write_png(os.path.join(OUT, "favicon-32.png"), 32, 32, c.downsample())

    for name in sorted(os.listdir(OUT)):
        p = os.path.join(OUT, name)
        print("%-28s %6d bytes" % (name, os.path.getsize(p)))


if __name__ == "__main__":
    build()
