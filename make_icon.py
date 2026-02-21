#!/usr/bin/env python3
"""Generate a minimal 100x100 PNG icon for the SpiderWeb Health watchface."""
import struct, zlib, math

def make_png(width, height, pixels):
    def chunk(name, data):
        c = struct.pack('>I', len(data)) + name + data
        return c + struct.pack('>I', zlib.crc32(name + data) & 0xffffffff)

    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))

    raw = b''
    for y in range(height):
        raw += b'\x00'
        for x in range(width):
            r, g, b = pixels[y][x]
            raw += bytes([r, g, b])

    idat = chunk(b'IDAT', zlib.compress(raw, 9))
    iend = chunk(b'IEND', b'')
    return sig + ihdr + idat + iend

W = H = 100

# Draw spider web icon
pixels = [[(8, 11, 20)] * W for _ in range(H)]

cx, cy = W // 2, H // 2
N = 6  # axes
MAX_R = 36
RINGS = 4

def setpx(x, y, col):
    if 0 <= x < W and 0 <= y < H:
        pixels[y][x] = col

def draw_line(x0, y0, x1, y1, col):
    dx = abs(x1 - x0); dy = abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx - dy
    while True:
        setpx(x0, y0, col)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 > -dy:
            err -= dy; x0 += sx
        if e2 < dx:
            err += dx; y0 += sy

def ax_angle(i):
    return -math.pi / 2 + i * 2 * math.pi / N

# Draw grid rings
for ring in range(1, RINGS + 1):
    r = round(ring / RINGS * MAX_R)
    col = (56, 56, 112) if ring == RINGS else (26, 29, 58)
    pts = [(round(cx + r * math.cos(ax_angle(i))), round(cy + r * math.sin(ax_angle(i)))) for i in range(N)]
    for i in range(N):
        draw_line(pts[i][0], pts[i][1], pts[(i+1) % N][0], pts[(i+1) % N][1], col)

# Draw axes
for i in range(N):
    ex = round(cx + MAX_R * math.cos(ax_angle(i)))
    ey = round(cy + MAX_R * math.sin(ax_angle(i)))
    draw_line(cx, cy, ex, ey, (37, 40, 80))

# Data polygon (roughly 70% fill)
norm = [0.75, 0.6, 0.8, 0.55, 0.7, 0.65]
data_pts = [(round(cx + norm[i] * MAX_R * math.cos(ax_angle(i))), round(cy + norm[i] * MAX_R * math.sin(ax_angle(i)))) for i in range(N)]

# Fill data polygon (simple scanline)
for y in range(H):
    inside = []
    for i in range(N):
        x0, y0 = data_pts[i]
        x1, y1 = data_pts[(i+1) % N]
        if (y0 <= y < y1) or (y1 <= y < y0):
            xi = int(x0 + (y - y0) / (y1 - y0) * (x1 - x0))
            inside.append(xi)
    inside.sort()
    for k in range(0, len(inside) - 1, 2):
        for x in range(inside[k], inside[k+1]):
            setpx(x, y, (8, 32, 48))

# Stroke data polygon cyan
for i in range(N):
    draw_line(data_pts[i][0], data_pts[i][1], data_pts[(i+1) % N][0], data_pts[(i+1) % N][1], (0, 212, 255))

# Colored dots at each axis tip
dot_cols = [(255, 71, 87), (255, 165, 2), (255, 99, 72), (46, 213, 115), (236, 204, 104), (83, 82, 237)]
for i in range(N):
    x, y = data_pts[i]
    for dy in range(-3, 4):
        for dx in range(-3, 4):
            if dx*dx + dy*dy <= 9:
                setpx(x+dx, y+dy, dot_cols[i])

# Center dot
for dy in range(-2, 3):
    for dx in range(-2, 3):
        if dx*dx + dy*dy <= 4:
            setpx(cx+dx, cy+dy, (48, 188, 213))

with open('/home/marc/projects/spiderweb-watchface/icon.png', 'wb') as f:
    f.write(make_png(W, H, pixels))

print('icon.png written successfully')
