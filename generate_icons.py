#!/usr/bin/env python3
import struct, zlib, math, os

def make_rgba_png(width, height, pixels):
    def chunk(name, data):
        c = struct.pack('>I', len(data)) + name + data
        return c + struct.pack('>I', zlib.crc32(name + data) & 0xffffffff)

    sig = b'\x89PNG\r\n\x1a\n'
    # 8 bit depth, color type 6 (RGBA)
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))

    raw = b''
    for y in range(height):
        # 0 filter byte
        raw += b'\x00'
        for x in range(width):
            r, g, b, a = pixels[y][x]
            raw += bytes([r, g, b, a])

    idat = chunk(b'IDAT', zlib.compress(raw, 9))
    iend = chunk(b'IEND', b'')
    return sig + ihdr + idat + iend

out_dir = './assets/gtr-4.r'
os.makedirs(out_dir, exist_ok=True)

size = 32
def empty_pixels():
    return [[(0, 0, 0, 0)] * size for _ in range(size)]

def set_px(pixels, x, y, col):
    x, y = int(x), int(y)
    if 0 <= x < size and 0 <= y < size:
        pixels[y][x] = col

def draw_circle(pixels, cx, cy, r, col):
    for y in range(size):
        for x in range(size):
            if (x - cx)**2 + (y - cy)**2 <= r**2:
                set_px(pixels, x, y, col)

def save_icon(name, pixels):
    with open(f"{out_dir}/{name}.png", 'wb') as f:
        f.write(make_rgba_png(size, size, pixels))
    print(f"Generated {name}.png")

# 1. Heart (Red) - 0xFF4757 (255, 71, 87)
p = empty_pixels()
c = (255, 71, 87, 255)
draw_circle(p, 10, 10, 6, c)
draw_circle(p, 22, 10, 6, c)
for y in range(12, 28):
    w = 28 - y
    for x in range(16 - w, 16 + w + 1):
        set_px(p, x, y, c)
save_icon('heart', p)

# 2. Steps (Orange foot) - 0xFFA502 (255, 165, 2)
p = empty_pixels()
c = (255, 165, 2, 255)
for y in range(10, 24):
    for x in range(8, 20):
        if (x-14)**2/20 + (y-17)**2/40 <= 1:
            set_px(p, x, y, c)
draw_circle(p, 11, 7, 2, c)
draw_circle(p, 16, 5, 2, c)
draw_circle(p, 21, 6, 2, c)
save_icon('steps', p)

# 3. Calories (Flame) - 0xFF6348 (255, 99, 72)
p = empty_pixels()
c = (255, 99, 72, 255)
for y in range(6, 26):
    for x in range(8, 24):
        # A rough flame shape
        w = (y - 6) * 0.8 if y < 18 else (26 - y) * 1.5
        if abs(x - 16) <= w:
            set_px(p, x, y, c)
# inner hole
for y in range(18, 24):
    for x in range(14, 19):
        if (x-16)**2 + (y-21)**2 <= 4:
            set_px(p, x, y, (0,0,0,0))
save_icon('cal', p)

# 4. Distance (Pin) - 0x2ED573 (46, 213, 115)
p = empty_pixels()
c = (46, 213, 115, 255)
draw_circle(p, 16, 12, 8, c)
for y in range(16, 28):
    w = (28 - y) / 1.5
    for x in range(int(16 - w), int(16 + w) + 1):
        set_px(p, x, y, c)
draw_circle(p, 16, 12, 3, (0,0,0,0))
save_icon('dist', p)

# 5. Stress (Lightning) - 0xECCC68 (236, 204, 104)
p = empty_pixels()
c = (236, 204, 104, 255)
for y in range(4, 16):
    for x in range(14 - (y-4)//2, 22 - (y-4)//2):
        set_px(p, x, y, c)
for y in range(14, 28):
    for x in range(18 - (y-14), 24 - (y-14)):
        set_px(p, x, y, c)
save_icon('stress', p)

# 6. SpO2 (Blood Drop) - 0x5352ED (83, 82, 237)
p = empty_pixels()
c = (83, 82, 237, 255)
from math import sin, pi
for y in range(6, 26):
    if y < 16:
        w = ((y - 6) / 10) * 8
    else:
        w = math.sqrt(64 - (y - 16)**2) if y <= 24 else 0
    for x in range(int(16 - w), int(16 + w) + 1):
        set_px(p, x, y, c)
# little shine
for y in range(16, 20):
    for x in range(10, 12):
        set_px(p, x, y, (255, 255, 255, 200))
save_icon('spo2', p)
